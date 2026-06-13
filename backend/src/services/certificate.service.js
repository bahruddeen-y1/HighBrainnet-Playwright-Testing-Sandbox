const crypto = require('crypto');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

function generateCode() {
  return `HBN-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

const certSelect = {
  id: true, certificateCode: true, issuedAt: true, pdfUrl: true,
  course: {
    select: { id: true, slug: true, title: true, level: { select: { name: true } } },
  },
};

/**
 * เงื่อนไขรับใบเซอร์: เรียนจบครบทุก lesson (completed) ของคอร์ส
 * (คำถามค้างใน CONTEXT — default ใช้ "เรียนจบครบ"; ถ้าลูกค้าต้องการ
 *  ให้ผ่าน quiz ด้วย ค่อยเพิ่มเงื่อนไข passScore ที่นี่จุดเดียว)
 */
async function checkEligibility(userId, courseId) {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId, courseId, isDeleted: false,
      OR: [{ isLifetime: true }, { expiresAt: { gte: new Date() } }],
    },
  });
  if (!enrollment) {
    return { eligible: false, reason: 'ไม่มีสิทธิ์เข้าถึงคอร์สนี้', completed: 0, total: 0 };
  }

  const lessons = await prisma.lesson.findMany({
    where: {
      isDeleted: false, isVisible: true,
      chapter: { courseId, isDeleted: false, isVisible: true },
    },
    select: { id: true },
  });
  if (!lessons.length) {
    return { eligible: false, reason: 'คอร์สยังไม่มีบทเรียน', completed: 0, total: 0 };
  }

  const completed = await prisma.lessonProgress.count({
    where: {
      userId, isCompleted: true,
      lessonId: { in: lessons.map((l) => l.id) },
    },
  });

  const eligible = completed >= lessons.length;
  return {
    eligible,
    completed,
    total: lessons.length,
    reason: eligible ? null : `เรียนแล้ว ${completed}/${lessons.length} บทเรียน — ต้องเรียนให้ครบก่อน`,
  };
}

async function claim(userId, courseId) {
  // already issued?
  const existing = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: certSelect,
  });
  if (existing) return { certificate: existing, alreadyIssued: true };

  const status = await checkEligibility(userId, courseId);
  if (!status.eligible) {
    throw ApiError.badRequest(status.reason || 'ยังไม่ผ่านเงื่อนไขรับใบประกาศ');
  }

  const certificate = await prisma.certificate.create({
    data: { userId, courseId, certificateCode: generateCode() },
    select: certSelect,
  });

  await prisma.auditLog.create({
    data: {
      userId, action: 'certificate.issued', entity: 'Certificate',
      entityId: certificate.id, metadata: { courseId },
    },
  });

  return { certificate, alreadyIssued: false };
}

async function listMine(userId) {
  return prisma.certificate.findMany({
    where: { userId },
    orderBy: { issuedAt: 'desc' },
    select: certSelect,
  });
}

// public verification by code (ไม่ต้อง login — ตรวจสอบความถูกต้องของใบ)
async function verify(code) {
  const cert = await prisma.certificate.findUnique({
    where: { certificateCode: code },
    select: {
      certificateCode: true, issuedAt: true,
      user: { select: { fullName: true } },
      course: { select: { title: true } },
    },
  });
  if (!cert) throw ApiError.notFound('ไม่พบใบประกาศรหัสนี้');
  return cert;
}

module.exports = { checkEligibility, claim, listMine, verify };
