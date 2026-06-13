const crypto = require('crypto');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

function generateOrderNumber() {
  const ts = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 12);
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `HBN-${ts}-${rand}`;
}

const orderInclude = {
  items: true,
  payments: { orderBy: { createdAt: 'desc' } },
};

async function resolveItem(item) {
  if (item.itemType === 'course') {
    const course = await prisma.course.findFirst({
      where: { id: item.courseId, isDeleted: false, isVisible: true },
      select: { id: true, title: true, price: true, currentVersionId: true },
    });
    if (!course) throw ApiError.badRequest('Course ไม่พบหรือถูกซ่อน');
    if (!course.currentVersionId) throw ApiError.badRequest('Course ไม่มี current version');
    return {
      itemType: 'course',
      courseId: course.id,
      versionId: course.currentVersionId,
      title: course.title,
      unitPrice: course.price,
      quantity: 1,
      amount: course.price,
    };
  }

  if (item.itemType === 'upgrade') {
    const version = await prisma.courseVersion.findFirst({
      where: { id: item.versionId, courseId: item.courseId, isDeleted: false },
      select: { id: true, versionLabel: true, upgradePrice: true,
                course: { select: { id: true, title: true } } },
    });
    if (!version) throw ApiError.badRequest('Version ไม่พบ');
    return {
      itemType: 'upgrade',
      courseId: version.course.id,
      versionId: version.id,
      title: `${version.course.title} — Upgrade ${version.versionLabel}`,
      unitPrice: version.upgradePrice,
      quantity: 1,
      amount: version.upgradePrice,
    };
  }

  if (item.itemType === 'package') {
    const pkg = await prisma.package.findFirst({
      where: { id: item.packageId, isDeleted: false },
      select: { id: true, title: true, discountPrice: true },
    });
    if (!pkg) throw ApiError.badRequest('Package ไม่พบ');
    return {
      itemType: 'package',
      packageId: pkg.id,
      title: pkg.title,
      unitPrice: pkg.discountPrice,
      quantity: 1,
      amount: pkg.discountPrice,
    };
  }

  throw ApiError.badRequest('Unknown itemType');
}

async function ensureNotDuplicate(userId, resolvedItems) {
  // Block duplicate enrollment for the same course+version
  for (const it of resolvedItems) {
    if (it.itemType === 'course' || it.itemType === 'upgrade') {
      const existing = await prisma.enrollment.findFirst({
        where: {
          userId, courseId: it.courseId, versionId: it.versionId,
          isDeleted: false,
        },
      });
      if (existing) {
        throw ApiError.conflict(`คุณซื้อ "${it.title}" ไปแล้ว`);
      }
    }
  }
}

async function create(userId, input, idempotencyKey) {
  // Idempotency: if same key + user → return existing order
  if (idempotencyKey) {
    const dup = await prisma.order.findFirst({
      where: { idempotencyKey, userId },
      include: orderInclude,
    });
    if (dup) return dup;
  }

  const resolved = await Promise.all(input.items.map(resolveItem));
  await ensureNotDuplicate(userId, resolved);

  const subtotal = resolved.reduce((s, it) => s + Number(it.amount), 0);
  const amount = subtotal; // (เผื่อ discount/coupon ในอนาคต)

  return prisma.order.create({
    data: {
      userId,
      orderNumber: generateOrderNumber(),
      status: 'PENDING',
      paymentMethod: input.paymentMethod,
      subtotal,
      discount: 0,
      amount,
      idempotencyKey,
      notes: input.notes,
      items: { create: resolved },
    },
    include: orderInclude,
  });
}

async function get(userId, orderId, { asAdmin } = {}) {
  const where = { id: orderId };
  if (!asAdmin) where.userId = userId;

  const order = await prisma.order.findFirst({ where, include: orderInclude });
  if (!order) throw ApiError.notFound('Order ไม่พบ');
  return order;
}

async function list(userId, query, { asAdmin } = {}) {
  const where = {};
  if (!asAdmin) where.userId = userId;
  if (query.status) where.status = query.status;

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where, include: orderInclude,
      orderBy: { createdAt: 'desc' },
      take: query.take, skip: query.skip,
    }),
    prisma.order.count({ where }),
  ]);
  return { items, total, take: query.take, skip: query.skip };
}

async function fulfill(orderId, { paymentId, gatewayRef, note } = {}) {
  // Idempotency: if already PAID, no-op
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!existing) throw ApiError.notFound('Order ไม่พบ');
  if (existing.status === 'PAID') {
    return { order: existing, enrollments: [], alreadyPaid: true };
  }

  const enrollmentData = [];
  const accessData = [];

  for (const item of existing.items) {
    if (item.itemType === 'course' || item.itemType === 'upgrade') {
      enrollmentData.push({
        userId: existing.userId,
        courseId: item.courseId,
        versionId: item.versionId,
        orderId: existing.id,
        isLifetime: true,
      });
      accessData.push({
        userId: existing.userId,
        versionId: item.versionId,
      });
    } else if (item.itemType === 'package') {
      const links = await prisma.packageCourse.findMany({
        where: { packageId: item.packageId },
        include: { course: { select: { id: true, currentVersionId: true } } },
      });
      for (const link of links) {
        if (!link.course?.currentVersionId) continue;
        enrollmentData.push({
          userId: existing.userId,
          courseId: link.courseId,
          versionId: link.course.currentVersionId,
          orderId: existing.id,
          isLifetime: true,
        });
        accessData.push({
          userId: existing.userId,
          versionId: link.course.currentVersionId,
        });
      }
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: orderId },
      data: { status: 'PAID', notes: note ?? existing.notes },
    });

    if (paymentId) {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'SUCCESS', paidAt: new Date(), gatewayRef },
      });
    }

    const enrollments = [];
    for (const data of enrollmentData) {
      const e = await tx.enrollment.upsert({
        where: {
          userId_courseId_versionId: {
            userId: data.userId,
            courseId: data.courseId,
            versionId: data.versionId,
          },
        },
        update: { isDeleted: false, deletedAt: null, orderId: data.orderId },
        create: data,
      });
      enrollments.push(e);
    }

    for (const data of accessData) {
      await tx.studentVersionAccess.upsert({
        where: {
          userId_versionId: { userId: data.userId, versionId: data.versionId },
        },
        update: {},
        create: data,
      });
    }

    await tx.auditLog.create({
      data: {
        userId: existing.userId,
        action: 'order.fulfilled',
        entity: 'Order',
        entityId: orderId,
        metadata: { gatewayRef, paymentId, note },
      },
    });

    return { order, enrollments };
  });

  return { ...result, alreadyPaid: false };
}

module.exports = { create, get, list, fulfill, generateOrderNumber };
