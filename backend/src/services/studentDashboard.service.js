const prisma = require('../config/prisma');
const badgeService = require('./badge.service');

async function getDashboard(userId) {
  // ----- enrollments + per-course progress -----
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, isDeleted: false },
    orderBy: { enrolledAt: 'desc' },
    select: {
      id: true, courseId: true, isLifetime: true, expiresAt: true, enrolledAt: true,
      course: {
        select: {
          id: true, slug: true, title: true, coverImageUrl: true,
          level: { select: { key: true, name: true } },
        },
      },
      version: { select: { versionLabel: true } },
    },
  });

  const courseIds = enrollments.map((e) => e.courseId);

  // lessons per course (visible, not deleted)
  const lessons = courseIds.length ? await prisma.lesson.findMany({
    where: {
      isDeleted: false, isVisible: true,
      chapter: { courseId: { in: courseIds }, isDeleted: false, isVisible: true },
    },
    select: { id: true, chapter: { select: { courseId: true } } },
  }) : [];

  const lessonIds = lessons.map((l) => l.id);
  const completedSet = new Set(
    (lessonIds.length ? await prisma.lessonProgress.findMany({
      where: { userId, isCompleted: true, lessonId: { in: lessonIds } },
      select: { lessonId: true },
    }) : []).map((p) => p.lessonId),
  );

  const lessonsByCourse = {};
  for (const l of lessons) {
    const cid = l.chapter.courseId;
    lessonsByCourse[cid] = lessonsByCourse[cid] || { total: 0, completed: 0 };
    lessonsByCourse[cid].total += 1;
    if (completedSet.has(l.id)) lessonsByCourse[cid].completed += 1;
  }

  const courses = enrollments.map((e) => {
    const p = lessonsByCourse[e.courseId] || { total: 0, completed: 0 };
    const isActive = e.isLifetime || !e.expiresAt || e.expiresAt > new Date();
    return {
      enrollmentId: e.id,
      course: e.course,
      versionLabel: e.version.versionLabel,
      isActive,
      progress: {
        completed: p.completed,
        total: p.total,
        percent: p.total ? Math.round((p.completed / p.total) * 100) : 0,
      },
    };
  });

  // ----- continue watching (ล่าสุดที่ยังไม่จบ) -----
  const recentWatch = await prisma.watchHistory.findFirst({
    where: {
      userId,
      lesson: { isDeleted: false, isVisible: true },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      lastPositionSeconds: true, updatedAt: true,
      lesson: {
        select: {
          id: true, title: true, videoDuration: true,
          chapter: {
            select: { course: { select: { slug: true, title: true } } },
          },
        },
      },
    },
  });

  const continueWatching = recentWatch ? {
    lessonId: recentWatch.lesson.id,
    lessonTitle: recentWatch.lesson.title,
    courseTitle: recentWatch.lesson.chapter.course.title,
    courseSlug: recentWatch.lesson.chapter.course.slug,
    resumeAt: recentWatch.lastPositionSeconds,
    duration: recentWatch.lesson.videoDuration,
    lastWatchedAt: recentWatch.updatedAt,
  } : null;

  // ----- recent quiz results -----
  const recentQuizzes = await prisma.quizResult.findMany({
    where: { userId },
    orderBy: { takenAt: 'desc' },
    take: 5,
    select: {
      id: true, score: true, maxScore: true, percentage: true,
      isPassed: true, takenAt: true,
      quiz: { select: { title: true, isMockExam: true } },
    },
  });

  // ----- certificates -----
  const certificates = await prisma.certificate.findMany({
    where: { userId },
    orderBy: { issuedAt: 'desc' },
    select: {
      id: true, certificateCode: true, issuedAt: true,
      course: { select: { title: true } },
    },
  });

  // ----- badges (award ใหม่ถ้าเข้าเงื่อนไข) -----
  const { stats, badges, catalog } = await badgeService.computeAndAward(userId);

  return {
    summary: {
      courses: courses.length,
      lessonsCompleted: stats.lessonsCompleted,
      quizPassed: stats.quizPassed,
      quizAttempts: stats.quizAttempts,
      certificates: stats.certificates,
      badges: badges.length,
    },
    courses,
    continueWatching,
    recentQuizzes,
    certificates,
    badges,
    badgeCatalog: catalog,
  };
}

module.exports = { getDashboard };
