const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const bunny = require('./bunny.service');

const VIDEO_STATUS = {
  0: 'uploading', 1: 'processing', 2: 'processing',
  3: 'processing', 4: 'ready', 5: 'failed',
};

async function getLesson(lessonId) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, isDeleted: false },
  });
  if (!lesson) throw ApiError.notFound('Lesson ไม่พบ');
  return lesson;
}

async function createVideoForLesson(lessonId) {
  const lesson = await getLesson(lessonId);

  if (lesson.bunnyVideoId) {
    throw ApiError.conflict('Lesson นี้มีวิดีโออยู่แล้ว — ลบก่อนถ้าจะอัปโหลดใหม่');
  }

  const result = await bunny.createVideo(lesson.title);

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      bunnyVideoId: result.guid,
      videoStatus: 'uploading',
    },
  });

  return {
    lessonId,
    bunnyVideoId: result.guid,
    upload: {
      url: result.uploadUrl,
      accessKey: result.uploadAccessKey,
      method: 'PUT',
      contentType: 'application/octet-stream',
      note: 'PUT raw bytes ไปยัง url พร้อม header AccessKey และ Content-Type. รองรับ multipart/TUS resumable',
    },
  };
}

async function syncLessonVideo(lessonId) {
  const lesson = await getLesson(lessonId);
  if (!lesson.bunnyVideoId) throw ApiError.badRequest('Lesson ยังไม่มี Bunny video');

  const info = await bunny.getVideo(lesson.bunnyVideoId);
  const status = VIDEO_STATUS[info.status] || 'unknown';

  const updated = await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      videoStatus: status,
      videoDuration: info.length ?? lesson.videoDuration,
    },
    select: {
      id: true, title: true, bunnyVideoId: true,
      videoDuration: true, videoStatus: true,
    },
  });
  return { lesson: updated, bunny: info };
}

async function deleteLessonVideo(lessonId) {
  const lesson = await getLesson(lessonId);
  if (!lesson.bunnyVideoId) throw ApiError.badRequest('Lesson ยังไม่มี Bunny video');

  await bunny.deleteVideo(lesson.bunnyVideoId);

  await prisma.lesson.update({
    where: { id: lessonId },
    data: { bunnyVideoId: null, videoStatus: null, videoDuration: null },
  });
  return { ok: true };
}

// ----- Student playback -----

// Check whether userId has active access to the lesson's course (and its current version)
async function ensureLessonAccess(userId, lesson) {
  // lesson → chapter → course
  const chapter = await prisma.chapter.findFirst({
    where: { id: lesson.chapterId, isDeleted: false },
    select: { courseId: true },
  });
  if (!chapter) throw ApiError.notFound('Chapter ไม่พบ');

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId,
      courseId: chapter.courseId,
      isDeleted: false,
      OR: [
        { isLifetime: true },
        { expiresAt: { gte: new Date() } },
      ],
    },
  });

  if (!enrollment) {
    throw ApiError.forbidden('คุณยังไม่มีสิทธิ์เข้าถึงคอร์สนี้');
  }
  return enrollment;
}

async function getPlaybackInfo(userId, lessonId, { ip } = {}) {
  const lesson = await getLesson(lessonId);
  if (!lesson.bunnyVideoId) throw ApiError.badRequest('Lesson ยังไม่มีวิดีโอ');
  if (lesson.videoStatus && lesson.videoStatus !== 'ready') {
    throw ApiError.badRequest(`วิดีโอยังไม่พร้อม (สถานะ: ${lesson.videoStatus})`);
  }

  await ensureLessonAccess(userId, lesson);

  const urls = bunny.signPlaybackUrl(lesson.bunnyVideoId, { ip });

  // resume position
  const watch = await prisma.watchHistory.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
    select: { lastPositionSeconds: true },
  });

  return {
    lessonId,
    duration: lesson.videoDuration,
    resumeAt: watch?.lastPositionSeconds ?? 0,
    urls,
  };
}

// ----- Watch history / progress -----

const COMPLETE_THRESHOLD = 0.9;

async function updateWatchPosition(userId, lessonId, positionSeconds) {
  const lesson = await getLesson(lessonId);
  await ensureLessonAccess(userId, lesson);

  const safePos = Math.max(0, Math.floor(positionSeconds || 0));

  const history = await prisma.watchHistory.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: {
      lastPositionSeconds: safePos,
      totalWatchedSeconds: { increment: 0 }, // increments are tracked client-side via separate calls
    },
    create: {
      userId, lessonId,
      lastPositionSeconds: safePos,
      totalWatchedSeconds: safePos,
    },
  });

  // Auto-complete when crossing threshold
  let progress = null;
  if (lesson.videoDuration && lesson.videoDuration > 0) {
    const ratio = safePos / lesson.videoDuration;
    if (ratio >= COMPLETE_THRESHOLD) {
      progress = await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        update: { isWatched: true, isCompleted: true, completedAt: new Date() },
        create: {
          userId, lessonId,
          isWatched: true, isCompleted: true, completedAt: new Date(),
        },
      });
    } else if (safePos > 0) {
      progress = await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        update: { isWatched: true },
        create: { userId, lessonId, isWatched: true },
      });
    }
  }

  return { history, progress };
}

async function getLessonProgress(userId, lessonId) {
  const [history, progress] = await Promise.all([
    prisma.watchHistory.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
      select: { lastPositionSeconds: true, totalWatchedSeconds: true, updatedAt: true },
    }),
    prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
      select: { isWatched: true, isCompleted: true, completedAt: true },
    }),
  ]);

  return {
    lessonId,
    resumeAt: history?.lastPositionSeconds ?? 0,
    totalWatched: history?.totalWatchedSeconds ?? 0,
    isWatched: progress?.isWatched ?? false,
    isCompleted: progress?.isCompleted ?? false,
    completedAt: progress?.completedAt ?? null,
  };
}

module.exports = {
  createVideoForLesson,
  syncLessonVideo,
  deleteLessonVideo,
  getPlaybackInfo,
  updateWatchPosition,
  getLessonProgress,
};
