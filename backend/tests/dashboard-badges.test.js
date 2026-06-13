const {
  app, prisma, request, resetDb, seedLevels, registerUser, registerAdmin, createCourse,
} = require('./helpers');

let levels, admin, adminToken, course, lessonId, quizId, questionIds, student, studentH;

beforeAll(async () => {
  await resetDb();
  levels = await seedLevels();
  admin = await registerAdmin();
  adminToken = admin.accessToken;

  course = await createCourse(adminToken, {
    levelId: levels[0].id, title: 'คอร์ส dashboard', price: 300,
  });
  const ch = (await request(app).post(`/api/v1/admin/courses/${course.id}/chapters`)
    .set('authorization', `Bearer ${adminToken}`).send({ title: 'บท 1' })).body.chapter;
  const lesson = (await request(app).post(`/api/v1/admin/chapters/${ch.id}/lessons`)
    .set('authorization', `Bearer ${adminToken}`)
    .send({ title: '1.1', videoDuration: 100 })).body.lesson;
  lessonId = lesson.id;

  const quiz = (await request(app).post(`/api/v1/admin/lessons/${lessonId}/quizzes`)
    .set('authorization', `Bearer ${adminToken}`).send({ title: 'quiz เก็บ badge' })).body.quiz;
  quizId = quiz.id;
  const q1 = (await request(app).post(`/api/v1/admin/quizzes/${quizId}/questions`)
    .set('authorization', `Bearer ${adminToken}`)
    .send({ type: 'TRUE_FALSE', prompt: '1=1', correctAnswer: true })).body.question;
  questionIds = [q1.id];

  student = await registerUser();
  studentH = ['authorization', `Bearer ${student.accessToken}`];
  await request(app).post('/api/v1/admin/enrollments')
    .set('authorization', `Bearer ${adminToken}`)
    .send({ userId: student.user.id, courseId: course.id });
});
afterAll(async () => { await prisma.$disconnect(); });

describe('Student dashboard + badges', () => {
  test('dashboard เริ่มต้น: ไม่มี badge, progress 0%', async () => {
    const res = await request(app).get('/api/v1/me/dashboard').set(...studentH);
    expect(res.status).toBe(200);
    expect(res.body.summary.courses).toBe(1);
    expect(res.body.summary.lessonsCompleted).toBe(0);
    expect(res.body.badges).toHaveLength(0);
    expect(res.body.badgeCatalog.length).toBeGreaterThanOrEqual(8);
    expect(res.body.courses[0].progress).toEqual({ completed: 0, total: 1, percent: 0 });
    expect(res.body.continueWatching).toBeNull();
  });

  test('เรียนจบบท + ทำ quiz เต็ม → ได้ badges ใหม่พร้อม isNew', async () => {
    // ดูจบ (95/100 ≥ 90%)
    await request(app).post(`/api/v1/lessons/${lessonId}/watch`)
      .set(...studentH).send({ positionSeconds: 95 });

    // quiz คะแนนเต็ม
    const { attemptId } = (await request(app)
      .post(`/api/v1/quizzes/${quizId}/start`).set(...studentH)).body;
    await request(app).post(`/api/v1/quizzes/${quizId}/submit`).set(...studentH)
      .send({ attemptId, answers: [{ questionId: questionIds[0], answer: true }] });

    const res = await request(app).get('/api/v1/me/dashboard').set(...studentH);
    const codes = res.body.badges.map((b) => b.code).sort();
    expect(codes).toEqual(expect.arrayContaining(
      ['FIRST_LESSON', 'FIRST_QUIZ', 'QUIZ_PERFECT'],
    ));
    expect(res.body.badges.every((b) => b.isNew)).toBe(true);
    expect(res.body.summary.lessonsCompleted).toBe(1);
    expect(res.body.courses[0].progress.percent).toBe(100);
    expect(res.body.continueWatching.lessonId).toBe(lessonId);
    expect(res.body.recentQuizzes).toHaveLength(1);
    expect(res.body.recentQuizzes[0].percentage).toBe(100);
  });

  test('โหลดซ้ำ → badge เดิม isNew=false ไม่ award ซ้ำ', async () => {
    const res = await request(app).get('/api/v1/me/dashboard').set(...studentH);
    expect(res.body.badges.every((b) => b.isNew === false)).toBe(true);

    const count = await prisma.userBadge.count({ where: { userId: student.user.id } });
    expect(count).toBe(res.body.badges.length);
  });

  test('claim certificate → badge CERTIFICATE โผล่', async () => {
    await request(app).post(`/api/v1/certificates/claim/${course.id}`).set(...studentH);
    const res = await request(app).get('/api/v1/me/dashboard').set(...studentH);
    const cert = res.body.badges.find((b) => b.code === 'CERTIFICATE');
    expect(cert).toBeDefined();
    expect(cert.isNew).toBe(true);
    expect(res.body.certificates).toHaveLength(1);
  });
});
