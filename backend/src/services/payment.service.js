const prisma = require('../config/prisma');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const gbp = require('./gbprimepay.service');
const promptpay = require('./promptpay.service');
const slipVerify = require('./slipVerify.service');
const settingsService = require('./settings.service');
const lineNotify = require('./lineNotify.service');
const orderService = require('./order.service');

async function startPayment(userId, orderId) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId, isDeleted: false },
    include: { payments: true },
  });
  if (!order) throw ApiError.notFound('Order ไม่พบ');
  if (order.status === 'PAID') throw ApiError.conflict('Order นี้ชำระแล้ว');
  if (order.paymentMethod !== 'QR_PROMPTPAY') {
    throw ApiError.badRequest('Order นี้ไม่ใช่ QR_PROMPTPAY — ใช้ /payment/slip แทน');
  }

  const settings = await settingsService.get();

  // Re-use existing pending Payment if any (avoid creating duplicate QRs).
  // For locally-generated PromptPay QRs we can re-derive the same payload.
  const pending = order.payments.find((p) => p.status === 'PENDING');
  if (pending && settings.qrSource !== 'PROMPTPAY') {
    return { paymentId: pending.id, gatewayRef: pending.gatewayRef, qr: null, reused: true };
  }

  // ---- PromptPay: generate the QR locally from the admin's id ----
  if (settings.qrSource === 'PROMPTPAY') {
    if (!settings.promptpayId) {
      throw new ApiError(503, 'ร้านยังไม่ได้ตั้งค่าเลขพร้อมเพย์ — ติดต่อผู้ดูแล');
    }
    const rawData = promptpay.generatePayload({
      promptpayId: settings.promptpayId,
      type: settings.promptpayType,
      amount: Number(order.amount),
    });

    const payment = pending || (await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          orderId: order.id,
          status: 'PENDING',
          amount: order.amount,
          gateway: 'promptpay',
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'AWAITING_PAYMENT' },
      });
      return p;
    }));

    return {
      paymentId: payment.id,
      gatewayRef: null,
      qr: { rawData, image: null, amount: Number(order.amount) },
      mode: settings.paymentMode, // MANUAL | AUTO — tells the client whether to ask for a slip
      reused: Boolean(pending),
    };
  }

  // ---- GB Prime Pay gateway ----
  const backgroundUrl = `${env.APP_URL}/api/v1/webhooks/gbprimepay`;
  const qr = await gbp.createQrCode({
    referenceNo: order.orderNumber,
    amount: Number(order.amount),
    detail: `HighBrainnet Order ${order.orderNumber}`,
    backgroundUrl,
  });

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        orderId: order.id,
        status: 'PENDING',
        amount: order.amount,
        gateway: 'gbprimepay',
        gatewayRef: qr.gatewayRef,
      },
    });
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'AWAITING_PAYMENT' },
    });
    return p;
  });

  return {
    paymentId: payment.id,
    gatewayRef: qr.gatewayRef,
    qr: { rawData: qr.qrRawData, image: qr.qrImage, amount: qr.amount },
    mode: settings.paymentMode,
    reused: false,
  };
}

/**
 * Student submits a payment slip for an order.
 * MANUAL mode -> order goes to AWAITING_APPROVAL for the admin to confirm.
 * AUTO mode   -> the slip is checked by the configured provider; if it passes
 *               the order is fulfilled immediately, otherwise it falls back to
 *               AWAITING_APPROVAL so the admin can still approve by hand.
 *
 * @param {object} slip { imageUrl?, imageBase64?, payload?, mock? }
 */
async function submitSlip(userId, orderId, slip = {}) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId, isDeleted: false },
    include: { payments: true },
  });
  if (!order) throw ApiError.notFound('Order ไม่พบ');
  if (order.status === 'PAID') throw ApiError.conflict('Order นี้ชำระแล้ว');

  const settings = await settingsService.get();
  const slipImageUrl = slip.imageUrl || slip.imageBase64 || null;

  // Ensure a Payment row exists to attach the slip to.
  let payment = order.payments.find((p) => p.status === 'PENDING')
    || order.payments[order.payments.length - 1];
  if (!payment) {
    payment = await prisma.payment.create({
      data: { orderId: order.id, status: 'PENDING', amount: order.amount, gateway: 'promptpay' },
    });
  }
  await prisma.payment.update({
    where: { id: payment.id },
    data: { slipImageUrl },
  });

  // ---- AUTO: verify the slip with the provider ----
  if (settings.paymentMode === 'AUTO') {
    const result = await slipVerify.verify({
      provider: settings.slipProvider,
      apiKey: settings.slipApiKey,
      slip,
      expected: {
        amount: Number(order.amount),
        promptpayId: settings.promptpayId,
        promptpayName: settings.promptpayName,
      },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { slipVerifyResult: result.raw || result },
    });

    if (result.verified) {
      const { order: paid } = await orderService.fulfill(order.id, {
        paymentId: payment.id,
        gatewayRef: result.transRef || `slip_${payment.id}`,
        note: 'auto-verified slip',
      });
      await lineNotify.send(
        `\n💰 ชำระเงินสำเร็จ (auto)\nOrder: ${paid.orderNumber}\n` +
        `ยอด: ฿${Number(paid.amount).toLocaleString('th-TH')}`,
      );
      return { status: 'PAID', verified: true, orderId: paid.id };
    }

    // Verification failed — hand off to the admin instead of rejecting outright.
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'AWAITING_APPROVAL' },
    });
    await lineNotify.send(
      `\n⚠️ สลิปตรวจไม่ผ่าน (${result.reason || 'unknown'})\n` +
      `Order: ${order.orderNumber} — รอตรวจสอบเอง`,
    );
    return { status: 'AWAITING_APPROVAL', verified: false, reason: result.reason };
  }

  // ---- MANUAL: queue for admin approval ----
  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'AWAITING_APPROVAL' },
  });
  await lineNotify.send(
    `\n📤 มีสลิปใหม่รอตรวจสอบ\nOrder: ${order.orderNumber}\n` +
    `ยอด: ฿${Number(order.amount).toLocaleString('th-TH')}`,
  );
  return { status: 'AWAITING_APPROVAL', verified: false };
}

/**
 * Process incoming gateway webhook.
 * Body (typical GBP):
 *   { referenceNo, gbpReferenceNo, amount, resultCode ("00"=success) }
 */
async function processWebhook(payload) {
  const refOrder = payload.referenceNo;
  const gatewayRef = payload.gbpReferenceNo || payload.gatewayRef;
  const success = String(payload.resultCode || payload.status || '') === '00'
                || String(payload.status || '').toUpperCase() === 'SUCCESS';

  if (!refOrder && !gatewayRef) {
    throw ApiError.badRequest('Webhook missing reference');
  }

  // Idempotency: find payment by gatewayRef first (preferred)
  let payment = null;
  if (gatewayRef) {
    payment = await prisma.payment.findUnique({
      where: { gatewayRef },
      include: { order: true },
    });
  }
  if (!payment && refOrder) {
    const order = await prisma.order.findUnique({
      where: { orderNumber: refOrder },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    payment = order?.payments?.[0]
      ? { ...order.payments[0], order }
      : null;
  }

  if (!payment) {
    logger.warn(`Webhook: payment not found ref=${refOrder} gw=${gatewayRef}`);
    throw ApiError.notFound('Payment not found');
  }

  // Persist raw webhook for audit (immutable log)
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      webhookPayload: payload,
      ...(success ? {} : { status: 'FAILED' }),
    },
  });

  if (!success) {
    return { ok: false, reason: `resultCode=${payload.resultCode}`, paymentId: payment.id };
  }

  // Idempotent: already fulfilled
  if (payment.order.status === 'PAID') {
    logger.info(`Webhook: order already paid ${payment.order.orderNumber}`);
    return { ok: true, alreadyPaid: true, orderId: payment.order.id };
  }

  const { order } = await orderService.fulfill(payment.order.id, {
    paymentId: payment.id,
    gatewayRef,
  });

  // Notify teacher
  const msg = `\n💰 ชำระเงินสำเร็จ\n` +
              `Order: ${order.orderNumber}\n` +
              `ยอด: ฿${Number(order.amount).toLocaleString('th-TH')}\n` +
              `Ref: ${gatewayRef}`;
  await lineNotify.send(msg);

  return { ok: true, orderId: order.id, alreadyPaid: false };
}

async function approveManual(orderId, adminId, notes) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true },
  });
  if (!order) throw ApiError.notFound('Order ไม่พบ');
  if (order.status === 'PAID') throw ApiError.conflict('Order นี้ชำระแล้ว');

  // Make sure there's a Payment record (manual flow may have none yet)
  let payment = order.payments.find((p) => p.status === 'PENDING');
  if (!payment) {
    payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        status: 'PENDING',
        amount: order.amount,
        gateway: 'manual',
      },
    });
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { approvedById: adminId, approvedAt: new Date() },
  });

  const { order: paid } = await orderService.fulfill(orderId, {
    paymentId: payment.id,
    gatewayRef: `manual_${payment.id}`,
    note: notes,
  });

  await lineNotify.send(`✋ Manual approve: ${paid.orderNumber} โดย admin`);
  return paid;
}

module.exports = { startPayment, submitSlip, processWebhook, approveManual };
