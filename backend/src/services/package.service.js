const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { slugify } = require('../utils/slug');

const courseInclude = {
  course: {
    select: {
      id: true, slug: true, title: true, subtitle: true,
      coverImageUrl: true, price: true,
      level: { select: { id: true, key: true, name: true } },
    },
  },
};

const packageInclude = {
  courses: { include: courseInclude, orderBy: { courseId: 'asc' } },
};

async function ensureUniqueSlug(base, ignoreId) {
  let slug = base;
  let n = 1;
  while (true) {
    const existing = await prisma.package.findUnique({ where: { slug } });
    if (!existing || existing.id === ignoreId) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

async function validateCourses(courseIds) {
  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds }, isDeleted: false },
    select: { id: true, price: true, currentVersionId: true },
  });
  if (courses.length !== courseIds.length) {
    throw ApiError.badRequest('มี courseId บางตัวไม่พบหรือถูกซ่อน');
  }
  for (const c of courses) {
    if (!c.currentVersionId) {
      throw ApiError.badRequest(`Course ${c.id} ยังไม่มี current version`);
    }
  }
  return courses;
}

function summarise(pkg) {
  const sum = pkg.courses?.reduce((s, link) => s + Number(link.course.price), 0) ?? 0;
  return {
    ...pkg,
    originalPrice: pkg.originalPrice,
    coursesCount: pkg.courses?.length ?? 0,
    savings: sum - Number(pkg.discountPrice),
  };
}

async function create(input) {
  const courses = await validateCourses(input.courseIds);
  const originalPrice = courses.reduce((s, c) => s + Number(c.price), 0);
  const baseSlug = input.slug || slugify(input.title, { fallbackPrefix: 'package' });
  const slug = await ensureUniqueSlug(baseSlug);

  const pkg = await prisma.package.create({
    data: {
      slug,
      title: input.title,
      description: input.description,
      coverImageUrl: input.coverImageUrl,
      originalPrice,
      discountPrice: input.discountPrice,
      courses: {
        create: courses.map((c) => ({ courseId: c.id })),
      },
    },
    include: packageInclude,
  });
  return summarise(pkg);
}

async function list({ q, includeDeleted, take, skip }, { asAdmin } = {}) {
  const where = {};
  if (!asAdmin || !includeDeleted) where.isDeleted = false;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.package.findMany({
      where, include: packageInclude,
      orderBy: { createdAt: 'desc' }, take, skip,
    }),
    prisma.package.count({ where }),
  ]);

  return { items: rows.map(summarise), total, take, skip };
}

async function getBySlug(slug) {
  const pkg = await prisma.package.findFirst({
    where: { slug, isDeleted: false },
    include: packageInclude,
  });
  if (!pkg) throw ApiError.notFound('Package ไม่พบ');
  return summarise(pkg);
}

async function getById(id, { asAdmin } = {}) {
  const where = { id };
  if (!asAdmin) where.isDeleted = false;
  const pkg = await prisma.package.findFirst({
    where, include: packageInclude,
  });
  if (!pkg) throw ApiError.notFound('Package ไม่พบ');
  return summarise(pkg);
}

async function update(id, patch) {
  const existing = await prisma.package.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw ApiError.notFound('Package ไม่พบ');

  if (patch.slug && patch.slug !== existing.slug) {
    patch.slug = await ensureUniqueSlug(patch.slug, existing.id);
  }

  const pkg = await prisma.package.update({
    where: { id }, data: patch, include: packageInclude,
  });
  return summarise(pkg);
}

async function setCourses(id, courseIds) {
  const existing = await prisma.package.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw ApiError.notFound('Package ไม่พบ');

  const courses = await validateCourses(courseIds);
  const originalPrice = courses.reduce((s, c) => s + Number(c.price), 0);

  const pkg = await prisma.$transaction(async (tx) => {
    await tx.packageCourse.deleteMany({ where: { packageId: id } });
    await tx.packageCourse.createMany({
      data: courses.map((c) => ({ packageId: id, courseId: c.id })),
    });
    return tx.package.update({
      where: { id },
      data: { originalPrice },
      include: packageInclude,
    });
  });
  return summarise(pkg);
}

async function softDelete(id) {
  const existing = await prisma.package.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw ApiError.notFound('Package ไม่พบ');
  await prisma.package.update({
    where: { id }, data: { isDeleted: true, deletedAt: new Date() },
  });
  return { ok: true };
}

async function restore(id) {
  const existing = await prisma.package.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Package ไม่พบ');
  if (!existing.isDeleted) throw ApiError.badRequest('Package ยังไม่ถูกซ่อน');
  const pkg = await prisma.package.update({
    where: { id }, data: { isDeleted: false, deletedAt: null },
    include: packageInclude,
  });
  return summarise(pkg);
}

module.exports = {
  create, list, getBySlug, getById, update,
  setCourses, softDelete, restore,
};
