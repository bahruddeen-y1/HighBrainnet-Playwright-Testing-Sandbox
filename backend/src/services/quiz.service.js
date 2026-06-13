const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const TIMER_GRACE_SECONDS = 30;

const quizMetaSelect = {
  id: true, lessonId: true, courseId: true, title: true, description: true,
  isMockExam: true, hasTimer: true, timeLimitMinutes: true,
  passScore: true, isPreLesson: true,
  isDeleted: true, createdAt: true, updatedAt: true,
};

// question fields safe for students (no answers)
const questionPublicSelect = {
  id: true, type: true, prompt: true, options: true, points: true, sortOrder: true,
};

// ===================== ADMIN =====================

async function createForLesson(lessonId, input) {
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, isDeleted: false } });
  if (!lesson) throw ApiError.notFound('Lesson ไม่พบ');
  return prisma.quiz.create({
    data: { ...input, lessonId },
    select: quizMetaSelect,
  });
}

async function createForCourse(courseId, input) {
  const course = await prisma.course.findFirst({ where: { id: courseId, isDeleted: false } });
  if (!course) throw ApiError.notFound('Course ไม่พบ');
  return prisma.quiz.create({
    data: { ...input, courseId },
    select: quizMetaSelect,
  });
}

async function getAdmin(quizId) {
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, isDeleted: false },
    select: {
      ...quizMetaSelect,
      questions: {
        where: { isDeleted: false },
        orderBy: { sortOrder: 'asc' },
        // admin sees everything incl. answers
      },
    },
  });
  if (!quiz) throw ApiError.notFound('Quiz ไม่พบ');
  return quiz;
}

async function update(quizId, patch) {
  const existing = await prisma.quiz.findFirst({ where: { id: quizId, isDeleted: false } });
  if (!existing) throw ApiError.notFound('Quiz ไม่พบ');
  return prisma.quiz.update({ where: { id: quizId }, data: patch, select: quizMetaSelect });
}

async function softDelete(quizId) {
  const existing = await prisma.quiz.findFirst({ where: { id: quizId, isDeleted: false } });
  if (!existing) throw ApiError.notFound('Quiz ไม่พบ');
  await prisma.quiz.update({
    where: { id: quizId }, data: { isDeleted: true, deletedAt: new Date() },
  });
  return { ok: true };
}

async function addQuestion(quizId, input) {
  const quiz = await prisma.quiz.findFirst({ where: { id: quizId, isDeleted: false } });
  if (!quiz) throw ApiError.notFound('Quiz ไม่พบ');

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const last = await prisma.question.findFirst({
      where: { quizId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true },
    });
    sortOrder = (last?.sortOrder ?? -1) + 1;
  }

  return prisma.question.create({
    data: {
      quizId,
      type: input.type,
      prompt: input.prompt,
      options: input.options ?? null,
      correctAnswer: input.correctAnswer,
      explanation: input.explanation,
      points: input.points,
      sortOrder,
    },
  });
}

async function updateQuestion(questionId, patch) {
  const existing = await prisma.question.findFirst({
    where: { id: questionId, isDeleted: false },
  });
  if (!existing) throw ApiError.notFound('Question ไม่พบ');
  return prisma.question.update({ where: { id: questionId }, data: patch });
}

async function deleteQuestion(questionId) {
  const existing = await prisma.question.findFirst({
    where: { id: questionId, isDeleted: false },
  });
  if (!existing) throw ApiError.notFound('Question ไม่พบ');
  await prisma.question.update({
    where: { id: questionId }, data: { isDeleted: true, deletedAt: new Date() },
  });
  return { ok: true };
}

async function reorderQuestions(quizId, items) {
  const quiz = await prisma.quiz.findFirst({ where: { id: quizId, isDeleted: false } });
  if (!quiz) throw ApiError.notFound('Quiz ไม่พบ');

  const questions = await prisma.question.findMany({
    where: { id: { in: items.map((i) => i.id) } },
    select: { id: true, quizId: true },
  });
  if (questions.length !== items.length) throw ApiError.badRequest('มี question id ไม่พบ');
  for (const q of questions) {
    if (q.quizId !== quizId) throw ApiError.badRequest('Question ไม่ได้อยู่ใน quiz นี้');
  }
  await prisma.$transaction(
    items.map((i) => prisma.question.update({ where: { id: i.id }, data: { sortOrder: i.sortOrder } })),
  );
  return getAdmin(quizId);
}

// ===================== ACCESS =====================

// Resolve the course a quiz belongs to (direct or via lesson), then check enrollment.
async function ensureQuizAccess(userId, quiz) {
  let courseId = quiz.courseId;
  if (!courseId && quiz.lessonId) {
    const lesson = await prisma.lesson.findFirst({
      where: { id: quiz.lessonId, isDeleted: false },
      select: { chapter: { select: { courseId: true } } },
    });
    courseId = lesson?.chapter?.courseId;
  }
  if (!courseId) throw ApiError.notFound('Quiz ไม่ได้ผูกกับคอร์ส');

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId, courseId, isDeleted: false,
      OR: [{ isLifetime: true }, { expiresAt: { gte: new Date() } }],
    },
  });
  if (!enrollment) throw ApiError.forbidden('คุณยังไม่มีสิทธิ์เข้าถึงคอร์สนี้');
  return courseId;
}

async function getQuizOrThrow(quizId) {
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, isDeleted: false },
    select: quizMetaSelect,
  });
  if (!quiz) throw ApiError.notFound('Quiz ไม่พบ');
  return quiz;
}

// ===================== STUDENT =====================

async function getForStudent(userId, quizId) {
  const quiz = await getQuizOrThrow(quizId);
  await ensureQuizAccess(userId, quiz);

  const questions = await prisma.question.findMany({
    where: { quizId, isDeleted: false },
    orderBy: { sortOrder: 'asc' },
    select: questionPublicSelect,
  });

  const attempts = await prisma.quizResult.count({ where: { userId, quizId } });

  return { ...quiz, questions, totalQuestions: questions.length, myAttempts: attempts };
}

async function startAttempt(userId, quizId) {
  const quiz = await getQuizOrThrow(quizId);
  await ensureQuizAccess(userId, quiz);

  // close any dangling attempt (treat as abandoned)
  await prisma.quizAttempt.updateMany({
    where: { userId, quizId, submittedAt: null },
    data: { submittedAt: new Date() },
  });

  const attempt = await prisma.quizAttempt.create({
    data: { userId, quizId },
  });

  return {
    attemptId: attempt.id,
    startedAt: attempt.startedAt,
    hasTimer: quiz.hasTimer,
    timeLimitMinutes: quiz.timeLimitMinutes,
  };
}

function normalize(v) {
  if (typeof v === 'string') return v.trim().toLowerCase();
  return v;
}

function isCorrect(question, given) {
  if (given === null || given === undefined) return false;
  const correct = question.correctAnswer;
  if (question.type === 'TRUE_FALSE') {
    return Boolean(given) === Boolean(correct);
  }
  return normalize(String(given)) === normalize(String(correct));
}

async function submit(userId, quizId, { attemptId, answers }) {
  const quiz = await getQuizOrThrow(quizId);
  await ensureQuizAccess(userId, quiz);

  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, userId, quizId },
  });
  if (!attempt) throw ApiError.badRequest('Attempt ไม่พบ — กด start ก่อนทำข้อสอบ');
  if (attempt.submittedAt) throw ApiError.conflict('Attempt นี้ส่งคำตอบแล้ว');

  const now = new Date();
  const elapsedSeconds = Math.floor((now - attempt.startedAt) / 1000);

  // server-side timer enforcement
  let timedOut = false;
  if (quiz.hasTimer && quiz.timeLimitMinutes) {
    const limit = quiz.timeLimitMinutes * 60 + TIMER_GRACE_SECONDS;
    if (elapsedSeconds > limit) timedOut = true;
  }

  const questions = await prisma.question.findMany({
    where: { quizId, isDeleted: false },
    orderBy: { sortOrder: 'asc' },
  });

  const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]));
  let score = 0;
  let maxScore = 0;
  const graded = questions.map((q) => {
    maxScore += q.points;
    const given = answerMap.has(q.id) ? answerMap.get(q.id) : null;
    // หมดเวลา = ไม่ให้คะแนน แต่ยังแสดงเฉลยให้เรียนรู้
    const correct = !timedOut && isCorrect(q, given);
    if (correct) score += q.points;
    return {
      questionId: q.id,
      prompt: q.prompt,
      type: q.type,
      options: q.options,
      given,
      correct,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      points: q.points,
    };
  });

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;
  const isPassed = quiz.passScore != null ? percentage >= quiz.passScore : percentage >= 50;

  const [result] = await prisma.$transaction([
    prisma.quizResult.create({
      data: {
        userId, quizId, score, maxScore, percentage,
        timeUsedSeconds: elapsedSeconds,
        isPassed: timedOut ? false : isPassed,
        answers: graded.map(({ questionId, given, correct }) => ({ questionId, given, correct })),
      },
    }),
    prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: { submittedAt: now },
    }),
  ]);

  return {
    resultId: result.id,
    score, maxScore, percentage,
    isPassed: result.isPassed,
    timedOut,
    timeUsedSeconds: elapsedSeconds,
    // เฉลยพร้อมคำอธิบายทันทีหลังส่ง (ตาม CONTEXT 3.2)
    review: graded,
  };
}

async function myResults(userId, quizId) {
  const quiz = await getQuizOrThrow(quizId);
  await ensureQuizAccess(userId, quiz);

  const results = await prisma.quizResult.findMany({
    where: { userId, quizId },
    orderBy: { takenAt: 'desc' },
    select: {
      id: true, score: true, maxScore: true, percentage: true,
      timeUsedSeconds: true, isPassed: true, takenAt: true,
    },
  });
  return { quiz: { id: quiz.id, title: quiz.title, passScore: quiz.passScore }, results };
}

// list quizzes attached to a lesson (student view, requires access via lesson)
async function listForLesson(userId, lessonId) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, isDeleted: false },
    select: { id: true, chapter: { select: { courseId: true } } },
  });
  if (!lesson) throw ApiError.notFound('Lesson ไม่พบ');
  await ensureQuizAccess(userId, { lessonId, courseId: null });

  const quizzes = await prisma.quiz.findMany({
    where: { lessonId, isDeleted: false },
    orderBy: { createdAt: 'asc' },
    select: { ...quizMetaSelect, _count: { select: { questions: { where: { isDeleted: false } } } } },
  });
  return quizzes.map((q) => ({ ...q, totalQuestions: q._count.questions, _count: undefined }));
}

// list mock exams of a course (student view)
async function listForCourse(userId, courseId) {
  await ensureQuizAccess(userId, { courseId, lessonId: null });
  const quizzes = await prisma.quiz.findMany({
    where: { courseId, isDeleted: false },
    orderBy: { createdAt: 'asc' },
    select: { ...quizMetaSelect, _count: { select: { questions: { where: { isDeleted: false } } } } },
  });
  return quizzes.map((q) => ({ ...q, totalQuestions: q._count.questions, _count: undefined }));
}

module.exports = {
  // admin
  createForLesson, createForCourse, getAdmin, update, softDelete,
  addQuestion, updateQuestion, deleteQuestion, reorderQuestions,
  // student
  getForStudent, startAttempt, submit, myResults, listForLesson, listForCourse,
};
