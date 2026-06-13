const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { slugify } = require('../utils/slug');

const courseSelect = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  description: true,
  coverImageUrl: true,
  price: true,
  levelId: true,
  isVisible: true,
  isDeleted: true,
  deletedAt: true,
  currentVersionId: true,
  createdAt: true,
  updatedAt: true,
  level: { select: { id: true, key: true, name: true } },
  currentVersion: { select: { id: true, versionLabel: true, upgradePrice: true } },
};

async function ensureUniqueSlug(base, ignoreCourseId) {
  let slug = base;
  let suffix = 1;
  while (true) {
    const existing = await prisma.course.findUnique({ where: { slug } });
    if (!existing || existing.id === ignoreCourseId) return slug;
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
}

async function create(input, adminId) {
  // verify level exists
  const level = await prisma.courseLevel.findFirst({
    where: { id: input.levelId, isDeleted: false },
  });
  if (!level) throw ApiError.badRequest('Course level ไม่พบ');

  const baseSlug = input.slug || slugify(input.title, { fallbackPrefix: 'course' });
  const slug = await ensureUniqueSlug(baseSlug);

  // Create course + initial version + link as currentVersion (transaction)
  const result = await prisma.$transaction(async (tx) => {
    const course = await tx.course.create({
      data: {
        levelId: input.levelId,
        title: input.title,
        subtitle: input.subtitle,
        description: input.description,
        slug,
        coverImageUrl: input.coverImageUrl,
        price: input.price,
        isVisible: input.isVisible ?? true,
        createdById: adminId,
      },
    });

    const version = await tx.courseVersion.create({
      data: {
        courseId: course.id,
        versionLabel: input.initialVersionLabel,
        publishedAt: new Date(),
      },
    });

    return tx.course.update({
      where: { id: course.id },
      data: { currentVersionId: version.id },
      select: courseSelect,
    });
  });

  return result;
}

async function list(query, { asAdmin } = {}) {
  const where = {};

  if (!asAdmin) {
    where.isDeleted = false;
    where.isVisible = true;
  } else {
    if (!query.includeDeleted) where.isDeleted = false;
    if (!query.includeHidden) where.isVisible = true;
  }

  if (query.level) where.levelId = query.level;
  if (query.levelKey) where.level = { key: query.levelKey };
  if (query.q) {
    where.OR = [
      { title:    { contains: query.q, mode: 'insensitive' } },
      { subtitle: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      select: courseSelect,
      orderBy: [{ level: { sortOrder: 'asc' } }, { createdAt: 'desc' }],
      take: query.take,
      skip: query.skip,
    }),
    prisma.course.count({ where }),
  ]);

  return { items, total, take: query.take, skip: query.skip };
}

async function getBySlug(slug, { asAdmin } = {}) {
  const where = { slug };
  if (!asAdmin) {
    where.isDeleted = false;
    where.isVisible = true;
  }

  const course = await prisma.course.findFirst({
    where,
    select: courseSelect,
  });
  if (!course) throw ApiError.notFound('Course ไม่พบ');
  return course;
}

async function getById(id, { asAdmin } = {}) {
  const where = { id };
  if (!asAdmin) {
    where.isDeleted = false;
    where.isVisible = true;
  }
  const course = await prisma.course.findFirst({
    where,
    select: courseSelect,
  });
  if (!course) throw ApiError.notFound('Course ไม่พบ');
  return course;
}

async function update(id, patch) {
  const course = await prisma.course.findFirst({ where: { id, isDeleted: false } });
  if (!course) throw ApiError.notFound('Course ไม่พบ');

  if (patch.levelId) {
    const level = await prisma.courseLevel.findFirst({
      where: { id: patch.levelId, isDeleted: false },
    });
    if (!level) throw ApiError.badRequest('Course level ไม่พบ');
  }

  if (patch.slug && patch.slug !== course.slug) {
    patch.slug = await ensureUniqueSlug(patch.slug, course.id);
  }

  return prisma.course.update({
    where: { id },
    data: patch,
    select: courseSelect,
  });
}

async function softDelete(id) {
  const course = await prisma.course.findFirst({ where: { id, isDeleted: false } });
  if (!course) throw ApiError.notFound('Course ไม่พบ หรือถูกซ่อนไว้แล้ว');

  const activeStudents = await prisma.enrollment.count({
    where: { courseId: id, isDeleted: false },
  });

  await prisma.course.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  return { affectedStudents: activeStudents };
}

async function restore(id) {
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) throw ApiError.notFound('Course ไม่พบ');
  if (!course.isDeleted) throw ApiError.badRequest('Course นี้ยังไม่ถูกซ่อน');

  return prisma.course.update({
    where: { id },
    data: { isDeleted: false, deletedAt: null },
    select: courseSelect,
  });
}

async function getTree(slug, { asAdmin } = {}) {
  const courseWhere = { slug };
  if (!asAdmin) {
    courseWhere.isDeleted = false;
    courseWhere.isVisible = true;
  }

  const course = await prisma.course.findFirst({
    where: courseWhere,
    select: {
      ...courseSelect,
      chapters: {
        where: asAdmin ? {} : { isDeleted: false, isVisible: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          sortOrder: true,
          isVisible: true,
          isDeleted: true,
          lessons: {
            where: asAdmin ? {} : { isDeleted: false, isVisible: true },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              title: true,
              description: true,
              sortOrder: true,
              isVisible: true,
              isDeleted: true,
              bunnyVideoId: asAdmin, // hide bunny id from public
              videoDuration: true,
              videoStatus: asAdmin,
            },
          },
        },
      },
    },
  });

  if (!course) throw ApiError.notFound('Course ไม่พบ');
  return course;
}

module.exports = { create, list, getBySlug, getById, update, softDelete, restore, getTree };
