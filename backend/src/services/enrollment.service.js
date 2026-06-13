const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const enrollmentSelect = {
  id: true,
  userId: true,
  courseId: true,
  versionId: true,
  orderId: true,
  isLifetime: true,
  expiresAt: true,
  enrolledAt: true,
  isDeleted: true,
  course: {
    select: {
      id: true, slug: true, title: true, subtitle: true,
      coverImageUrl: true, price: true,
      currentVersionId: true,
      level: { select: { id: true, key: true, name: true } },
    },
  },
  version: {
    select: { id: true, versionLabel: true, upgradePrice: true },
  },
};

function annotate(e) {
  const hasUpgradeAvailable = Boolean(
    e.course?.currentVersionId &&
    e.course.currentVersionId !== e.versionId
  );
  const isActive = !e.isDeleted && (e.isLifetime || !e.expiresAt || e.expiresAt > new Date());
  return { ...e, hasUpgradeAvailable, isActive };
}

async function listForStudent(userId) {
  const rows = await prisma.enrollment.findMany({
    where: { userId, isDeleted: false },
    select: enrollmentSelect,
    orderBy: { enrolledAt: 'desc' },
  });

  // Fetch upgrade prices for those with an upgrade available
  const upgradeVersionIds = rows
    .filter((e) => e.course?.currentVersionId && e.course.currentVersionId !== e.versionId)
    .map((e) => e.course.currentVersionId);

  let upgradeVersions = {};
  if (upgradeVersionIds.length) {
    const versions = await prisma.courseVersion.findMany({
      where: { id: { in: upgradeVersionIds } },
      select: { id: true, versionLabel: true, upgradePrice: true },
    });
    upgradeVersions = Object.fromEntries(versions.map((v) => [v.id, v]));
  }

  return rows.map((e) => {
    const a = annotate(e);
    if (a.hasUpgradeAvailable) {
      a.upgrade = upgradeVersions[e.course.currentVersionId] || null;
    }
    return a;
  });
}

async function listForAdmin({ userId, courseId, take = 50, skip = 0 }) {
  const where = { isDeleted: false };
  if (userId) where.userId = userId;
  if (courseId) where.courseId = courseId;

  const [rows, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      select: {
        ...enrollmentSelect,
        user: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { enrolledAt: 'desc' },
      take, skip,
    }),
    prisma.enrollment.count({ where }),
  ]);
  return { items: rows.map(annotate), total, take, skip };
}

async function adminCreate(input) {
  // verify user
  const user = await prisma.user.findFirst({
    where: { id: input.userId, isDeleted: false },
  });
  if (!user) throw ApiError.badRequest('User ไม่พบ');

  // verify course + resolve version
  const course = await prisma.course.findFirst({
    where: { id: input.courseId, isDeleted: false },
    select: { id: true, currentVersionId: true },
  });
  if (!course) throw ApiError.badRequest('Course ไม่พบ');

  const versionId = input.versionId || course.currentVersionId;
  if (!versionId) throw ApiError.badRequest('Course ไม่มี version');

  const version = await prisma.courseVersion.findFirst({
    where: { id: versionId, courseId: course.id, isDeleted: false },
  });
  if (!version) throw ApiError.badRequest('Version ไม่พบ');

  // upsert (re-grant if previously soft-deleted)
  const enrollment = await prisma.$transaction(async (tx) => {
    const e = await tx.enrollment.upsert({
      where: {
        userId_courseId_versionId: {
          userId: input.userId, courseId: course.id, versionId,
        },
      },
      create: {
        userId: input.userId,
        courseId: course.id,
        versionId,
        isLifetime: input.isLifetime ?? true,
        expiresAt: input.expiresAt ?? null,
      },
      update: {
        isDeleted: false,
        deletedAt: null,
        isLifetime: input.isLifetime ?? true,
        expiresAt: input.expiresAt ?? null,
      },
      select: enrollmentSelect,
    });
    await tx.studentVersionAccess.upsert({
      where: { userId_versionId: { userId: input.userId, versionId } },
      update: {},
      create: { userId: input.userId, versionId },
    });
    await tx.auditLog.create({
      data: {
        userId: input.userId,
        action: 'enrollment.gift',
        entity: 'Enrollment',
        entityId: e.id,
        metadata: { grantedBy: input.adminId, expiresAt: input.expiresAt },
      },
    });
    return e;
  });

  return annotate(enrollment);
}

async function adminUpdate(id, patch) {
  const existing = await prisma.enrollment.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Enrollment ไม่พบ');

  const data = {};
  if (typeof patch.isLifetime === 'boolean') {
    data.isLifetime = patch.isLifetime;
    if (patch.isLifetime) data.expiresAt = null;
  }
  if (patch.expiresAt !== undefined) {
    data.expiresAt = patch.expiresAt;
    if (patch.expiresAt) data.isLifetime = false;
  }

  const e = await prisma.enrollment.update({
    where: { id }, data, select: enrollmentSelect,
  });
  return annotate(e);
}

async function adminRevoke(id, adminId) {
  const existing = await prisma.enrollment.findFirst({
    where: { id, isDeleted: false },
  });
  if (!existing) throw ApiError.notFound('Enrollment ไม่พบหรือถูก revoke แล้ว');

  await prisma.$transaction([
    prisma.enrollment.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId: existing.userId,
        action: 'enrollment.revoke',
        entity: 'Enrollment',
        entityId: id,
        metadata: { revokedBy: adminId },
      },
    }),
  ]);
  return { ok: true };
}

module.exports = {
  listForStudent, listForAdmin, adminCreate, adminUpdate, adminRevoke,
};
