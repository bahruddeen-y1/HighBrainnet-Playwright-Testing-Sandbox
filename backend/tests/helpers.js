const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

// Wipe all rows between test files (order matters for FKs).
async function resetDb() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.userBadge.deleteMany(),
    prisma.certificate.deleteMany(),
    prisma.examCredit.deleteMany(),
    prisma.quizResult.deleteMany(),
    prisma.quizAttempt.deleteMany(),
    prisma.question.deleteMany(),
    prisma.quiz.deleteMany(),
    prisma.lessonProgress.deleteMany(),
    prisma.watchHistory.deleteMany(),
    prisma.studentVersionAccess.deleteMany(),
    prisma.enrollment.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.packageCourse.deleteMany(),
    prisma.package.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.chapter.deleteMany(),
    // break currentVersion FK before deleting versions
    prisma.course.updateMany({ data: { currentVersionId: null } }),
    prisma.courseVersion.deleteMany(),
    prisma.course.deleteMany(),
    prisma.courseLevel.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function seedLevels() {
  await prisma.courseLevel.createMany({
    data: [
      { key: 'PRIMARY', name: 'ประถมปลาย', sortOrder: 1 },
      { key: 'JUNIOR', name: 'มัธยมต้น', sortOrder: 2 },
      { key: 'SENIOR', name: 'มัธยมปลาย', sortOrder: 3 },
    ],
  });
  return prisma.courseLevel.findMany();
}

let emailCounter = 0;
async function registerUser(overrides = {}) {
  emailCounter += 1;
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email: `user${emailCounter}-${Date.now()}@test.com`,
      password: 'password123',
      fullName: 'Test User',
      pdpaConsent: true,
      ...overrides,
    });
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  return res.body; // { user, accessToken, refreshToken }
}

async function makeAdmin(userId) {
  await prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
}

async function registerAdmin() {
  const u = await registerUser({ fullName: 'Admin User' });
  await makeAdmin(u.user.id);
  // re-login so JWT carries ADMIN role
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: u.user.email, password: 'password123' });
  return res.body;
}

async function createCourse(adminToken, { levelId, title = 'คอร์สทดสอบ', price = 1000, ...rest } = {}) {
  const res = await request(app)
    .post('/api/v1/admin/courses')
    .set('authorization', `Bearer ${adminToken}`)
    .send({ levelId, title, price, ...rest });
  if (res.status !== 201) throw new Error(`createCourse failed: ${JSON.stringify(res.body)}`);
  return res.body.course;
}

module.exports = {
  app, prisma, request,
  resetDb, seedLevels, registerUser, registerAdmin, makeAdmin, createCourse,
};
