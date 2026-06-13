const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const fullSelect = {
  id: true, userId: true,
  realName: true, alias: true,
  schoolName: true, examYear: true, examName: true,
  displayType: true, isPublic: true, sortOrder: true,
  isDeleted: true, deletedAt: true,
  createdAt: true, updatedAt: true,
};

function maskForPublic(c) {
  const displayName = c.displayType === 'REAL_NAME' ? c.realName : (c.alias || 'นักเรียน');
  return {
    id: c.id,
    displayName,
    schoolName: c.schoolName,
    examYear: c.examYear,
    examName: c.examName,
    sortOrder: c.sortOrder,
  };
}

async function listPublic({ year, school, q, take, skip }) {
  const where = { isDeleted: false, isPublic: true };
  if (year) where.examYear = year;
  if (school) where.schoolName = { contains: school, mode: 'insensitive' };
  if (q) {
    where.OR = [
      { schoolName: { contains: q, mode: 'insensitive' } },
      { examName:   { contains: q, mode: 'insensitive' } },
      // intentionally NOT searching realName for privacy
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.examCredit.findMany({
      where,
      orderBy: [{ examYear: 'desc' }, { sortOrder: 'asc' }],
      take, skip,
    }),
    prisma.examCredit.count({ where }),
  ]);

  return { items: rows.map(maskForPublic), total, take, skip };
}

async function listAdmin({ year, school, q, take, skip }) {
  const where = { isDeleted: false };
  if (year) where.examYear = year;
  if (school) where.schoolName = { contains: school, mode: 'insensitive' };
  if (q) {
    where.OR = [
      { realName:   { contains: q, mode: 'insensitive' } },
      { alias:      { contains: q, mode: 'insensitive' } },
      { schoolName: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.examCredit.findMany({
      where, select: fullSelect,
      orderBy: [{ examYear: 'desc' }, { sortOrder: 'asc' }],
      take, skip,
    }),
    prisma.examCredit.count({ where }),
  ]);
  return { items, total, take, skip };
}

async function create(input) {
  return prisma.examCredit.create({ data: input, select: fullSelect });
}

async function update(id, patch) {
  const existing = await prisma.examCredit.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw ApiError.notFound('Exam credit ไม่พบ');
  return prisma.examCredit.update({ where: { id }, data: patch, select: fullSelect });
}

async function softDelete(id) {
  const existing = await prisma.examCredit.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw ApiError.notFound('Exam credit ไม่พบ');
  await prisma.examCredit.update({
    where: { id }, data: { isDeleted: true, deletedAt: new Date() },
  });
  return { ok: true };
}

module.exports = { listPublic, listAdmin, create, update, softDelete };
