const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const lessonSelect = {
  id: true, chapterId: true, title: true, description: true,
  sortOrder: true, isVisible: true,
  bunnyVideoId: true, videoDuration: true, videoStatus: true,
  isDeleted: true, deletedAt: true,
  createdAt: true, updatedAt: true,
};

async function ensureChapter(chapterId, { allowDeleted = false } = {}) {
  const where = { id: chapterId };
  if (!allowDeleted) where.isDeleted = false;
  const chapter = await prisma.chapter.findFirst({
    where,
    select: { id: true },
  });
  if (!chapter) throw ApiError.notFound('Chapter ไม่พบ');
}

async function nextSortOrder(chapterId) {
  const last = await prisma.lesson.findFirst({
    where: { chapterId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  return (last?.sortOrder ?? -1) + 1;
}

async function list(chapterId, { asAdmin } = {}) {
  // Admin can view lessons even of a soft-deleted chapter (consistent with
  // chapter.list returning deleted chapters to admins).
  await ensureChapter(chapterId, { allowDeleted: asAdmin });
  const where = { chapterId };
  if (!asAdmin) {
    where.isDeleted = false;
    where.isVisible = true;
  }
  return prisma.lesson.findMany({
    where, orderBy: { sortOrder: 'asc' }, select: lessonSelect,
  });
}

async function create(chapterId, input) {
  await ensureChapter(chapterId);
  const sortOrder = input.sortOrder ?? (await nextSortOrder(chapterId));
  return prisma.lesson.create({
    data: {
      chapterId,
      title: input.title,
      description: input.description,
      sortOrder,
      isVisible: input.isVisible ?? true,
      bunnyVideoId: input.bunnyVideoId,
      videoDuration: input.videoDuration,
      videoStatus: input.videoStatus,
    },
    select: lessonSelect,
  });
}

async function update(id, patch) {
  const existing = await prisma.lesson.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw ApiError.notFound('Lesson ไม่พบ');
  return prisma.lesson.update({ where: { id }, data: patch, select: lessonSelect });
}

async function softDelete(id) {
  const existing = await prisma.lesson.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw ApiError.notFound('Lesson ไม่พบ');
  await prisma.lesson.update({
    where: { id }, data: { isDeleted: true, deletedAt: new Date() },
  });
  return { ok: true };
}

async function restore(id) {
  const existing = await prisma.lesson.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Lesson ไม่พบ');
  if (!existing.isDeleted) throw ApiError.badRequest('Lesson นี้ยังไม่ถูกซ่อน');
  return prisma.lesson.update({
    where: { id }, data: { isDeleted: false, deletedAt: null }, select: lessonSelect,
  });
}

async function reorder(chapterId, items) {
  await ensureChapter(chapterId);
  const lessons = await prisma.lesson.findMany({
    where: { id: { in: items.map((i) => i.id) } },
    select: { id: true, chapterId: true },
  });
  if (lessons.length !== items.length) {
    throw ApiError.badRequest('มี lesson id บางตัวไม่พบ');
  }
  for (const l of lessons) {
    if (l.chapterId !== chapterId) {
      throw ApiError.badRequest('Lesson ไม่ได้อยู่ใน chapter นี้');
    }
  }
  await prisma.$transaction(
    items.map((i) =>
      prisma.lesson.update({ where: { id: i.id }, data: { sortOrder: i.sortOrder } }),
    ),
  );
  return list(chapterId, { asAdmin: true });
}

module.exports = { list, create, update, softDelete, restore, reorder };
