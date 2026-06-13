const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const chapterSelect = {
  id: true, courseId: true, title: true, description: true,
  sortOrder: true, isVisible: true, isDeleted: true, deletedAt: true,
  createdAt: true, updatedAt: true,
};

async function ensureCourse(courseId) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, isDeleted: false },
    select: { id: true },
  });
  if (!course) throw ApiError.notFound('Course ไม่พบ');
}

async function nextSortOrder(courseId) {
  const last = await prisma.chapter.findFirst({
    where: { courseId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  return (last?.sortOrder ?? -1) + 1;
}

async function list(courseId, { asAdmin } = {}) {
  await ensureCourse(courseId);
  const where = { courseId };
  if (!asAdmin) {
    where.isDeleted = false;
    where.isVisible = true;
  }
  return prisma.chapter.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
    select: chapterSelect,
  });
}

async function create(courseId, input) {
  await ensureCourse(courseId);
  const sortOrder = input.sortOrder ?? (await nextSortOrder(courseId));
  return prisma.chapter.create({
    data: {
      courseId,
      title: input.title,
      description: input.description,
      sortOrder,
      isVisible: input.isVisible ?? true,
    },
    select: chapterSelect,
  });
}

async function update(id, patch) {
  const existing = await prisma.chapter.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw ApiError.notFound('Chapter ไม่พบ');
  return prisma.chapter.update({ where: { id }, data: patch, select: chapterSelect });
}

async function softDelete(id) {
  const existing = await prisma.chapter.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw ApiError.notFound('Chapter ไม่พบ');
  await prisma.chapter.update({
    where: { id }, data: { isDeleted: true, deletedAt: new Date() },
  });
  return { ok: true };
}

async function restore(id) {
  const existing = await prisma.chapter.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Chapter ไม่พบ');
  if (!existing.isDeleted) throw ApiError.badRequest('Chapter นี้ยังไม่ถูกซ่อน');
  return prisma.chapter.update({
    where: { id }, data: { isDeleted: false, deletedAt: null },
    select: chapterSelect,
  });
}

async function reorder(courseId, items) {
  await ensureCourse(courseId);

  // Verify all chapters belong to this course
  const chapters = await prisma.chapter.findMany({
    where: { id: { in: items.map((i) => i.id) } },
    select: { id: true, courseId: true },
  });

  if (chapters.length !== items.length) {
    throw ApiError.badRequest('มี chapter id บางตัวไม่พบ');
  }
  for (const c of chapters) {
    if (c.courseId !== courseId) {
      throw ApiError.badRequest('Chapter ไม่ได้อยู่ในคอร์สนี้');
    }
  }

  await prisma.$transaction(
    items.map((i) =>
      prisma.chapter.update({ where: { id: i.id }, data: { sortOrder: i.sortOrder } }),
    ),
  );

  return list(courseId, { asAdmin: true });
}

module.exports = { list, create, update, softDelete, restore, reorder };
