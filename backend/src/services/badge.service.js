const prisma = require('../config/prisma');

/**
 * Badge catalog — เงื่อนไขคำนวณจากข้อมูลจริง (lazy award ตอนโหลด dashboard)
 * Gamification ปรับตามชั้นเรียนที่ฝั่ง UI: ประถมแสดงเด่น ม.ปลายแสดงเรียบ (CONTEXT 3.8)
 */
const CATALOG = [
  { code: 'FIRST_LESSON',  emoji: '🌱', title: 'ก้าวแรก',            description: 'เรียนจบบทเรียนแรก' },
  { code: 'LESSONS_5',     emoji: '📚', title: 'นักเรียนขยัน',        description: 'เรียนจบ 5 บทเรียน' },
  { code: 'LESSONS_20',    emoji: '🚀', title: 'จรวดความรู้',         description: 'เรียนจบ 20 บทเรียน' },
  { code: 'FIRST_QUIZ',    emoji: '✏️', title: 'ลองสนาม',            description: 'ทำแบบทดสอบครั้งแรก' },
  { code: 'QUIZ_PERFECT',  emoji: '💯', title: 'คะแนนเต็ม!',          description: 'ทำแบบทดสอบได้คะแนนเต็ม' },
  { code: 'QUIZ_PASS_5',   emoji: '🏅', title: 'มือโปร Quiz',         description: 'ผ่านแบบทดสอบ 5 ครั้ง' },
  { code: 'MOCK_EXAM',     emoji: '⏱️', title: 'นักสู้สนามสอบ',       description: 'ทำ Mock Exam ครั้งแรก' },
  { code: 'CERTIFICATE',   emoji: '🎓', title: 'บัณฑิตน้อย',          description: 'ได้รับใบประกาศใบแรก' },
];

const byCode = Object.fromEntries(CATALOG.map((b) => [b.code, b]));

async function collectStats(userId) {
  const [lessonsCompleted, quizResults, mockCount, certCount] = await Promise.all([
    prisma.lessonProgress.count({ where: { userId, isCompleted: true } }),
    prisma.quizResult.findMany({
      where: { userId },
      select: { isPassed: true, percentage: true },
    }),
    prisma.quizResult.count({ where: { userId, quiz: { isMockExam: true } } }),
    prisma.certificate.count({ where: { userId } }),
  ]);

  return {
    lessonsCompleted,
    quizAttempts: quizResults.length,
    quizPassed: quizResults.filter((r) => r.isPassed).length,
    quizPerfect: quizResults.some((r) => r.percentage >= 100),
    mockExams: mockCount,
    certificates: certCount,
  };
}

function qualifiedCodes(stats) {
  const out = [];
  if (stats.lessonsCompleted >= 1) out.push('FIRST_LESSON');
  if (stats.lessonsCompleted >= 5) out.push('LESSONS_5');
  if (stats.lessonsCompleted >= 20) out.push('LESSONS_20');
  if (stats.quizAttempts >= 1) out.push('FIRST_QUIZ');
  if (stats.quizPerfect) out.push('QUIZ_PERFECT');
  if (stats.quizPassed >= 5) out.push('QUIZ_PASS_5');
  if (stats.mockExams >= 1) out.push('MOCK_EXAM');
  if (stats.certificates >= 1) out.push('CERTIFICATE');
  return out;
}

/**
 * คำนวณ + award badge ใหม่ (idempotent — unique constraint กันซ้ำ)
 * คืนทุก badge ของ user พร้อม flag isNew สำหรับอันที่เพิ่งได้รอบนี้
 */
async function computeAndAward(userId) {
  const stats = await collectStats(userId);
  const qualified = qualifiedCodes(stats);

  const existing = await prisma.userBadge.findMany({
    where: { userId },
    select: { code: true, earnedAt: true },
  });
  const existingCodes = new Set(existing.map((b) => b.code));

  const newCodes = qualified.filter((c) => !existingCodes.has(c));
  if (newCodes.length) {
    await prisma.userBadge.createMany({
      data: newCodes.map((code) => ({ userId, code })),
      skipDuplicates: true,
    });
  }

  const all = await prisma.userBadge.findMany({
    where: { userId },
    orderBy: { earnedAt: 'asc' },
  });

  return {
    stats,
    badges: all
      .filter((b) => byCode[b.code])
      .map((b) => ({
        ...byCode[b.code],
        earnedAt: b.earnedAt,
        isNew: newCodes.includes(b.code),
      })),
    catalog: CATALOG, // ให้ UI แสดง badge ที่ยังไม่ได้แบบ locked
  };
}

module.exports = { CATALOG, computeAndAward, collectStats };
