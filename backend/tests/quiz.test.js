const {
  app, prisma, request, resetDb, seedLevels, registerUser, registerAdmin, createCourse,
} = require('./helpers');

let levels, admin, adminToken, course, lessonId, student, studentH;

beforeAll(async () => {
  await resetDb();
  levels = await seedLevels();
  admin = await registerAdmin();
  adminToken = admin.accessToken;

  course = await createCourse(adminToken, {
    levelId: levels[0].id, title: 'คอร์สมี quiz', price: 500,
  });
  const ch = (await request(app).post(`/api/v1/admin/courses/${course.id}/chapters`)
    .set('authorization', `Bearer ${adminToken}`).send({ title: 'บท 1' })).body.chapter;
  lessonId = (await request(app).post(`/api/v1/admin/chapters/${ch.id}/lessons`)
    .set('authorization', `Bearer ${adminToken}`).send({ title: 'หัวข้อ 1.1' })).body.lesson.id;

  student = await registerUser();
  studentH = ['authorization', `Bearer ${student.accessToken}`];
  await request(app).post('/api/v1/admin/enrollments')
    .set('authorization', `Bearer ${adminToken}`)
    .send({ userId: student.user.id, courseId: course.id });
});
afterAll(async () => { await prisma.$disconnect(); });

const adminH = () => ['authorization', `Bearer ${adminToken}`];

async function makeQuiz(overrides = {}, { target = 'lesson' } = {}) {
  const path = target === 'lesson'
    ? `/api/v1/admin/lessons/${lessonId}/quizzes`
    : `/api/v1/admin/courses/${course.id}/quizzes`;
  const res = await request(app).post(path).set(...adminH())
    .send({ title: 'Quiz ทดสอบ', ...overrides });
  expect(res.status).toBe(201);
  return res.body.quiz;
}

async function addQuestions(quizId) {
  await request(app).post(`/api/v1/admin/quizzes/${quizId}/questions`).set(...adminH()).send({
    type: 'MULTIPLE_CHOICE',
    prompt: '1 + 1 = ?',
    options: [{ key: 'A', text: '1' }, { key: 'B', text: '2' }, { key: 'C', text: '3' }],
    correctAnswer: 'B',
    explanation: 'หนึ่งบวกหนึ่งเท่ากับสอง',
    points: 2,
  });
  await request(app).post(`/api/v1/admin/quizzes/${quizId}/questions`).set(...adminH()).send({
    type: 'TRUE_FALSE',
    prompt: '2 เป็นจำนวนเฉพาะ',
    correctAnswer: true,
    explanation: '2 หารลงตัวด้วย 1 และตัวเองเท่านั้น',
  });
  await request(app).post(`/api/v1/admin/quizzes/${quizId}/questions`).set(...adminH()).send({
    type: 'SHORT_ANSWER',
    prompt: 'รากที่สองของ 9 คือ?',
    correctAnswer: '3',
  });
}

describe('Quiz + Mock Exam', () => {
  test('validation: MC ที่ correctAnswer ไม่อยู่ใน options → 400', async () => {
    const quiz = await makeQuiz();
    const res = await request(app).post(`/api/v1/admin/quizzes/${quiz.id}/questions`)
      .set(...adminH()).send({
        type: 'MULTIPLE_CHOICE',
        prompt: 'x?',
        options: [{ key: 'A', text: '1' }, { key: 'B', text: '2' }],
        correctAnswer: 'Z',
      });
    expect(res.status).toBe(400);
  });

  test('hasTimer ไม่ระบุ timeLimitMinutes → 400', async () => {
    const res = await request(app).post(`/api/v1/admin/lessons/${lessonId}/quizzes`)
      .set(...adminH()).send({ title: 'no limit', hasTimer: true });
    expect(res.status).toBe(400);
  });

  test('student เห็นคำถามแต่ไม่เห็นเฉลย', async () => {
    const quiz = await makeQuiz();
    await addQuestions(quiz.id);

    const res = await request(app).get(`/api/v1/quizzes/${quiz.id}`).set(...studentH);
    expect(res.status).toBe(200);
    expect(res.body.quiz.questions).toHaveLength(3);
    const json = JSON.stringify(res.body);
    expect(json).not.toContain('correctAnswer');
    expect(json).not.toContain('explanation');
  });

  test('student ไม่มี enrollment → 403', async () => {
    const outsider = await registerUser();
    const quiz = await makeQuiz();
    const res = await request(app).get(`/api/v1/quizzes/${quiz.id}`)
      .set('authorization', `Bearer ${outsider.accessToken}`);
    expect(res.status).toBe(403);
  });

  test('full flow: start → submit → ตรวจอัตโนมัติ + เฉลย + บันทึกผล', async () => {
    const quiz = await makeQuiz({ passScore: 60 });
    await addQuestions(quiz.id);
    const qs = (await request(app).get(`/api/v1/quizzes/${quiz.id}`).set(...studentH))
      .body.quiz.questions;

    const start = await request(app).post(`/api/v1/quizzes/${quiz.id}/start`).set(...studentH);
    expect(start.status).toBe(201);
    const { attemptId } = start.body;

    // ตอบถูก 2 จาก 3: MC ถูก (2pt), TF ถูก (1pt), SHORT ผิด (0/1pt) → 3/4 = 75%
    const submit = await request(app).post(`/api/v1/quizzes/${quiz.id}/submit`)
      .set(...studentH).send({
        attemptId,
        answers: [
          { questionId: qs[0].id, answer: 'B' },
          { questionId: qs[1].id, answer: true },
          { questionId: qs[2].id, answer: '99' },
        ],
      });
    expect(submit.status).toBe(200);
    expect(submit.body.score).toBe(3);
    expect(submit.body.maxScore).toBe(4);
    expect(submit.body.percentage).toBe(75);
    expect(submit.body.isPassed).toBe(true);

    // เฉลย + คำอธิบายมาทันที
    const review = submit.body.review;
    expect(review[0].correctAnswer).toBe('B');
    expect(review[0].explanation).toContain('หนึ่งบวกหนึ่ง');
    expect(review[2].correct).toBe(false);

    // ประวัติถูกบันทึก
    const hist = await request(app).get(`/api/v1/quizzes/${quiz.id}/results`).set(...studentH);
    expect(hist.body.results).toHaveLength(1);
    expect(hist.body.results[0].percentage).toBe(75);
  });

  test('SHORT_ANSWER ตรวจแบบ normalize (trim + case-insensitive)', async () => {
    const quiz = await makeQuiz();
    await request(app).post(`/api/v1/admin/quizzes/${quiz.id}/questions`).set(...adminH()).send({
      type: 'SHORT_ANSWER', prompt: 'ตอบ ABC', correctAnswer: 'ABC',
    });
    const qs = (await request(app).get(`/api/v1/quizzes/${quiz.id}`).set(...studentH)).body.quiz.questions;
    const { attemptId } = (await request(app).post(`/api/v1/quizzes/${quiz.id}/start`).set(...studentH)).body;

    const submit = await request(app).post(`/api/v1/quizzes/${quiz.id}/submit`)
      .set(...studentH).send({ attemptId, answers: [{ questionId: qs[0].id, answer: '  abc ' }] });
    expect(submit.body.percentage).toBe(100);
  });

  test('submit โดยไม่ start → 400, submit ซ้ำ → 409', async () => {
    const quiz = await makeQuiz();
    await addQuestions(quiz.id);

    const noStart = await request(app).post(`/api/v1/quizzes/${quiz.id}/submit`)
      .set(...studentH).send({
        attemptId: '00000000-0000-0000-0000-000000000000', answers: [],
      });
    expect(noStart.status).toBe(400);

    const { attemptId } = (await request(app).post(`/api/v1/quizzes/${quiz.id}/start`).set(...studentH)).body;
    await request(app).post(`/api/v1/quizzes/${quiz.id}/submit`)
      .set(...studentH).send({ attemptId, answers: [] });
    const again = await request(app).post(`/api/v1/quizzes/${quiz.id}/submit`)
      .set(...studentH).send({ attemptId, answers: [] });
    expect(again.status).toBe(409);
  });

  test('mock exam หมดเวลา → score 0 + timedOut + ยังเห็นเฉลย', async () => {
    const quiz = await makeQuiz(
      { title: 'Mock Exam จับเวลา', isMockExam: true, hasTimer: true, timeLimitMinutes: 30 },
      { target: 'course' },
    );
    await addQuestions(quiz.id);
    const qs = (await request(app).get(`/api/v1/quizzes/${quiz.id}`).set(...studentH)).body.quiz.questions;

    const { attemptId } = (await request(app).post(`/api/v1/quizzes/${quiz.id}/start`).set(...studentH)).body;

    // ย้อนเวลา startedAt ให้เกิน limit (31 นาที)
    await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: { startedAt: new Date(Date.now() - 31 * 60 * 1000) },
    });

    const submit = await request(app).post(`/api/v1/quizzes/${quiz.id}/submit`)
      .set(...studentH).send({
        attemptId,
        answers: [{ questionId: qs[0].id, answer: 'B' }],
      });
    expect(submit.status).toBe(200);
    expect(submit.body.timedOut).toBe(true);
    expect(submit.body.score).toBe(0);
    expect(submit.body.isPassed).toBe(false);
    expect(submit.body.review[0].correctAnswer).toBe('B'); // ยังเรียนรู้จากเฉลยได้
  });

  test('ทำซ้ำได้ไม่จำกัด — บันทึกทุกครั้ง', async () => {
    const quiz = await makeQuiz();
    await addQuestions(quiz.id);
    const qs = (await request(app).get(`/api/v1/quizzes/${quiz.id}`).set(...studentH)).body.quiz.questions;

    for (let i = 0; i < 3; i += 1) {
      const { attemptId } = (await request(app).post(`/api/v1/quizzes/${quiz.id}/start`).set(...studentH)).body;
      await request(app).post(`/api/v1/quizzes/${quiz.id}/submit`)
        .set(...studentH).send({ attemptId, answers: [{ questionId: qs[0].id, answer: 'B' }] });
    }
    const hist = await request(app).get(`/api/v1/quizzes/${quiz.id}/results`).set(...studentH);
    expect(hist.body.results).toHaveLength(3);

    const meta = await request(app).get(`/api/v1/quizzes/${quiz.id}`).set(...studentH);
    expect(meta.body.quiz.myAttempts).toBe(3);
  });

  test('list quizzes: lesson + course (mock exams)', async () => {
    const lessonList = await request(app).get(`/api/v1/quizzes/lesson/${lessonId}`).set(...studentH);
    expect(lessonList.status).toBe(200);
    expect(lessonList.body.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(lessonList.body)).not.toContain('correctAnswer');

    const courseList = await request(app).get(`/api/v1/quizzes/course/${course.id}`).set(...studentH);
    expect(courseList.status).toBe(200);
    expect(courseList.body.items.some((q) => q.isMockExam)).toBe(true);
  });

  test('admin เห็นเฉลยเต็มใน GET /admin/quizzes/:id', async () => {
    const quiz = await makeQuiz();
    await addQuestions(quiz.id);
    const res = await request(app).get(`/api/v1/admin/quizzes/${quiz.id}`).set(...adminH());
    expect(res.body.quiz.questions[0].correctAnswer).toBe('B');
    expect(res.body.quiz.questions[0].explanation).toBeTruthy();
  });
});
