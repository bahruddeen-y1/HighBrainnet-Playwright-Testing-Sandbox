const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const versionSelect = {
  id: true, courseId: true, versionLabel: true, releaseNotes: true,
  upgradePrice: true, publishedAt: true, isDeleted: true,
  createdAt: true, updatedAt: true,
};

async function ensureCourse(courseId) {
  const c = await prisma.course.findFirst({
    where: { id: courseId, isDeleted: false },
    select: { id: true, currentVersionId: true },
  });
  if (!c) throw ApiError.notFound('Course ไม่พบ');
  return c;
}

async function list(courseId) {
  await ensureCourse(courseId);
  return prisma.courseVersion.findMany({
    where: { courseId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: versionSelect,
  });
}

async function create(courseId, input) {
  await ensureCourse(courseId);

  const dup = await prisma.courseVersion.findFirst({
    where: { courseId, versionLabel: input.versionLabel, isDeleted: false },
  });
  if (dup) throw ApiError.conflict('versionLabel ซ้ำในคอร์สนี้');

  return prisma.$transaction(async (tx) => {
    const version = await tx.courseVersion.create({
      data: {
        courseId,
        versionLabel: input.versionLabel,
        releaseNotes: input.releaseNotes,
        upgradePrice: input.upgradePrice,
        publishedAt: input.publish ? new Date() : null,
      },
      select: versionSelect,
    });

    if (input.publish) {
      await tx.course.update({
        where: { id: courseId },
        data: { currentVersionId: version.id },
      });
    }

    return version;
  });
}

async function publish(versionId) {
  const v = await prisma.courseVersion.findFirst({
    where: { id: versionId, isDeleted: false },
  });
  if (!v) throw ApiError.notFound('Version ไม่พบ');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.courseVersion.update({
      where: { id: versionId },
      data: { publishedAt: v.publishedAt ?? new Date() },
      select: versionSelect,
    });
    await tx.course.update({
      where: { id: v.courseId },
      data: { currentVersionId: versionId },
    });
    return updated;
  });
}

async function update(versionId, patch) {
  const existing = await prisma.courseVersion.findFirst({
    where: { id: versionId, isDeleted: false },
  });
  if (!existing) throw ApiError.notFound('Version ไม่พบ');

  return prisma.courseVersion.update({
    where: { id: versionId },
    data: patch,
    select: versionSelect,
  });
}

async function remove(versionId) {
  const v = await prisma.courseVersion.findFirst({
    where: { id: versionId, isDeleted: false },
    include: { _count: { select: { enrollments: true } } },
  });
  if (!v) throw ApiError.notFound('Version ไม่พบ');
  if (v._count.enrollments > 0) {
    throw ApiError.conflict('ลบ version ไม่ได้: มีนักเรียนซื้อ version นี้แล้ว');
  }

  const course = await prisma.course.findUnique({ where: { id: v.courseId } });
  if (course?.currentVersionId === versionId) {
    throw ApiError.conflict('ลบ version ไม่ได้: เป็น current version ของคอร์ส');
  }

  await prisma.courseVersion.update({
    where: { id: versionId },
    data: { isDeleted: true, deletedAt: new Date() },
  });
  return { ok: true };
}

module.exports = { list, create, publish, update, remove };
