const prisma = require('../config/prisma');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const gbp = require('./gbprimepay.service');
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

  // Re-use existing pending Payment if any (avoid creating duplicate QRs)
  const pending = order.payments.find((p) => p.status === 'PENDING');
  if (pending) {
    return { paymentId: pending.id, gatewayRef: pending.gatewayRef, qr: null, reused: true };
  }

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
    reused: false,
  };
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

module.exports = { startPayment, processWebhook, approveManual };
