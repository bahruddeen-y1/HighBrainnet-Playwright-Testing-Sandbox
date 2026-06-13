const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const userSelect = {
  id: true, email: true, phone: true, fullName: true, nickname: true,
  role: true, pdpaConsent: true, pdpaConsentAt: true,
  isSuspended: true, isDeleted: true, deletedAt: true,
  lastLoginAt: true, lastLoginIp: true, deviceLabel: true,
  createdAt: true,
};

async function list({ q, role, includeSuspended, includeDeleted, take = 50, skip = 0 }) {
  const where = {};
  if (!includeDeleted) where.isDeleted = false;
  if (!includeSuspended) where.isSuspended = false;
  if (role) where.role = role;
  if (q) {
    where.OR = [
      { email:    { contains: q, mode: 'insensitive' } },
      { fullName: { contains: q, mode: 'insensitive' } },
      { phone:    { contains: q, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, select: userSelect, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.user.count({ where }),
  ]);
  return { items, total, take, skip };
}

async function getDetail(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...userSelect,
      enrollments: {
        where: { isDeleted: false },
        select: {
          id: true, enrolledAt: true, isLifetime: true, expiresAt: true,
          course: { select: { id: true, slug: true, title: true } },
          version: { select: { id: true, versionLabel: true } },
        },
      },
      orders: {
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true, orderNumber: true, status: true, amount: true,
          paymentMethod: true, createdAt: true,
        },
      },
    },
  });
  if (!user) throw ApiError.notFound('User ไม่พบ');
  return user;
}

async function suspend(id, adminId) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw ApiError.notFound('User ไม่พบ');
  if (user.role === 'ADMIN') throw ApiError.badRequest('ระงับ admin ไม่ได้');

  // Kill active session as well
  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { isSuspended: true, sessionToken: null, deviceFingerprint: null },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId: id, action: 'user.suspend', entity: 'User', entityId: id,
        metadata: { suspendedBy: adminId },
      },
    }),
  ]);
  return { ok: true };
}

async function unsuspend(id, adminId) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw ApiError.notFound('User ไม่พบ');
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { isSuspended: false } }),
    prisma.auditLog.create({
      data: {
        userId: id, action: 'user.unsuspend', entity: 'User', entityId: id,
        metadata: { unsuspendedBy: adminId },
      },
    }),
  ]);
  return { ok: true };
}

async function unlockDevice(id, adminId) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw ApiError.notFound('User ไม่พบ');

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { sessionToken: null, deviceFingerprint: null, deviceLabel: null },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId: id, action: 'user.device_unlock', entity: 'User', entityId: id,
        metadata: { unlockedBy: adminId },
      },
    }),
  ]);
  return { ok: true, message: 'อุปกรณ์ถูกปลดล็อค — นักเรียน login ใหม่ได้ทันที' };
}

module.exports = { list, getDetail, suspend, unsuspend, unlockDevice };
