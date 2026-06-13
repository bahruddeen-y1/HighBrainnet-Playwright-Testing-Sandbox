const express = require('express');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const courseCtrl = require('../controllers/course.controller');
const chapterCtrl = require('../controllers/chapter.controller');
const lessonCtrl = require('../controllers/lesson.controller');
const {
  createCourseSchema,
  updateCourseSchema,
  listCoursesQuerySchema,
  idParamSchema,
} = require('../validators/course.validators');
const {
  createChapterSchema,
  updateChapterSchema,
  reorderSchema,
  courseIdParam,
  chapterIdParam: chapterIdParamForChapter,
} = require('../validators/chapter.validators');
const {
  createLessonSchema,
  updateLessonSchema,
  chapterIdParam,
  lessonIdParam,
} = require('../validators/lesson.validators');
const videoCtrl = require('../controllers/video.controller');
const versionCtrl = require('../controllers/version.controller');
const orderCtrl = require('../controllers/order.controller');
const paymentCtrl = require('../controllers/payment.controller');
const packageCtrl = require('../controllers/package.controller');
const enrollmentCtrl = require('../controllers/enrollment.controller');
const dashboardCtrl = require('../controllers/dashboard.controller');
const userAdminCtrl = require('../controllers/userAdmin.controller');
const examCreditCtrl = require('../controllers/examCredit.controller');
const {
  listQuerySchema: usersListQuery,
  idParam: userIdParam,
} = require('../validators/userAdmin.validators');
const {
  createSchema: creditCreateSchema,
  updateSchema: creditUpdateSchema,
  listQuerySchema: creditListQuery,
  idParam: creditIdParam,
} = require('../validators/examCredit.validators');
const quizCtrl = require('../controllers/quiz.controller');
const exportCtrl = require('../controllers/export.controller');
const {
  dateRangeQuery,
  quizScoresQuery,
  creditsQuery,
} = require('../validators/export.validators');
const {
  createQuizSchema,
  updateQuizSchema,
  createQuestionSchema,
  updateQuestionSchema,
  reorderSchema: quizReorderSchema,
  idParam: quizIdParam,
  lessonIdParam: quizLessonIdParam,
  courseIdParam: quizCourseIdParam,
} = require('../validators/quiz.validators');
const {
  listOrdersQuerySchema,
  orderIdParam,
  approveSchema,
} = require('../validators/order.validators');
const {
  createPackageSchema,
  updatePackageSchema,
  setCoursesSchema,
  idParamSchema: packageIdParam,
  listQuerySchema: packageListQuery,
} = require('../validators/package.validators');
const {
  adminCreateSchema: enrollmentCreateSchema,
  adminUpdateSchema: enrollmentUpdateSchema,
  adminListQuery: enrollmentListQuery,
  idParam: enrollmentIdParam,
} = require('../validators/enrollment.validators');
const {
  createVersionSchema,
  updateVersionSchema,
  versionIdParam,
  courseIdParam: versionCourseIdParam,
} = require('../validators/version.validators');

const router = express.Router();

router.use(requireAuth, requireRole('ADMIN'));

// ----- Courses -----
router.get('/courses', validate(listCoursesQuerySchema, 'query'), courseCtrl.listAdmin);
router.post('/courses', validate(createCourseSchema), courseCtrl.create);
router.get('/courses/:id', validate(idParamSchema, 'params'), courseCtrl.getAdminById);
router.patch('/courses/:id',
  validate(idParamSchema, 'params'),
  validate(updateCourseSchema),
  courseCtrl.update,
);
router.delete('/courses/:id', validate(idParamSchema, 'params'), courseCtrl.remove);
router.post('/courses/:id/restore', validate(idParamSchema, 'params'), courseCtrl.restore);

// ----- Chapters (nested under course) -----
router.get('/courses/:courseId/chapters',
  validate(courseIdParam, 'params'),
  chapterCtrl.listAdmin,
);
router.post('/courses/:courseId/chapters',
  validate(courseIdParam, 'params'),
  validate(createChapterSchema),
  chapterCtrl.create,
);
router.post('/courses/:courseId/chapters/reorder',
  validate(courseIdParam, 'params'),
  validate(reorderSchema),
  chapterCtrl.reorder,
);
router.patch('/chapters/:id',
  validate(chapterIdParamForChapter, 'params'),
  validate(updateChapterSchema),
  chapterCtrl.update,
);
router.delete('/chapters/:id',
  validate(chapterIdParamForChapter, 'params'),
  chapterCtrl.remove,
);
router.post('/chapters/:id/restore',
  validate(chapterIdParamForChapter, 'params'),
  chapterCtrl.restore,
);

// ----- Lessons (nested under chapter) -----
router.get('/chapters/:chapterId/lessons',
  validate(chapterIdParam, 'params'),
  lessonCtrl.listAdmin,
);
router.post('/chapters/:chapterId/lessons',
  validate(chapterIdParam, 'params'),
  validate(createLessonSchema),
  lessonCtrl.create,
);
router.post('/chapters/:chapterId/lessons/reorder',
  validate(chapterIdParam, 'params'),
  validate(reorderSchema),
  lessonCtrl.reorder,
);
router.patch('/lessons/:id',
  validate(lessonIdParam, 'params'),
  validate(updateLessonSchema),
  lessonCtrl.update,
);
router.delete('/lessons/:id',
  validate(lessonIdParam, 'params'),
  lessonCtrl.remove,
);
router.post('/lessons/:id/restore',
  validate(lessonIdParam, 'params'),
  lessonCtrl.restore,
);

// ----- Lesson video (Bunny.net) -----
router.post('/lessons/:id/video',
  validate(lessonIdParam, 'params'),
  videoCtrl.adminCreateVideo,
);
router.post('/lessons/:id/video/sync',
  validate(lessonIdParam, 'params'),
  videoCtrl.adminSyncVideo,
);
router.delete('/lessons/:id/video',
  validate(lessonIdParam, 'params'),
  videoCtrl.adminDeleteVideo,
);

// ----- Course Versions -----
router.get('/courses/:courseId/versions',
  validate(versionCourseIdParam, 'params'),
  versionCtrl.list,
);
router.post('/courses/:courseId/versions',
  validate(versionCourseIdParam, 'params'),
  validate(createVersionSchema),
  versionCtrl.create,
);
router.patch('/versions/:id',
  validate(versionIdParam, 'params'),
  validate(updateVersionSchema),
  versionCtrl.update,
);
router.post('/versions/:id/publish',
  validate(versionIdParam, 'params'),
  versionCtrl.publish,
);
router.delete('/versions/:id',
  validate(versionIdParam, 'params'),
  versionCtrl.remove,
);

// ----- Orders / Payments (admin) -----
router.get('/orders', validate(listOrdersQuerySchema, 'query'), orderCtrl.adminList);
router.get('/orders/:id', validate(orderIdParam, 'params'), orderCtrl.adminGet);
router.post('/orders/:id/approve',
  validate(orderIdParam, 'params'),
  validate(approveSchema),
  paymentCtrl.adminApprove,
);

// ----- Packages (admin) -----
router.get('/packages',     validate(packageListQuery, 'query'), packageCtrl.listAdmin);
router.post('/packages',    validate(createPackageSchema),       packageCtrl.create);
router.get('/packages/:id', validate(packageIdParam, 'params'),  packageCtrl.getAdminById);
router.patch('/packages/:id',
  validate(packageIdParam, 'params'),
  validate(updatePackageSchema),
  packageCtrl.update,
);
router.put('/packages/:id/courses',
  validate(packageIdParam, 'params'),
  validate(setCoursesSchema),
  packageCtrl.setCourses,
);
router.delete('/packages/:id', validate(packageIdParam, 'params'), packageCtrl.remove);
router.post('/packages/:id/restore', validate(packageIdParam, 'params'), packageCtrl.restore);

// ----- Enrollments (admin) -----
router.get('/enrollments',
  validate(enrollmentListQuery, 'query'),
  enrollmentCtrl.adminList,
);
router.post('/enrollments',
  validate(enrollmentCreateSchema),
  enrollmentCtrl.adminCreate,
);
router.patch('/enrollments/:id',
  validate(enrollmentIdParam, 'params'),
  validate(enrollmentUpdateSchema),
  enrollmentCtrl.adminUpdate,
);
router.delete('/enrollments/:id',
  validate(enrollmentIdParam, 'params'),
  enrollmentCtrl.adminRevoke,
);

// ----- Dashboard -----
router.get('/dashboard/summary',      dashboardCtrl.summary);
router.get('/dashboard/sales-chart',  dashboardCtrl.salesChart);
router.get('/dashboard/top-courses',  dashboardCtrl.topCourses);

// ----- User management -----
router.get('/users',                  validate(usersListQuery, 'query'),  userAdminCtrl.list);
router.get('/users/:id',              validate(userIdParam, 'params'),    userAdminCtrl.get);
router.post('/users/:id/suspend',     validate(userIdParam, 'params'),    userAdminCtrl.suspend);
router.post('/users/:id/restore',     validate(userIdParam, 'params'),    userAdminCtrl.unsuspend);
router.post('/users/:id/unlock-device', validate(userIdParam, 'params'),  userAdminCtrl.unlockDevice);

// ----- Exam credits -----
router.get('/exam-credits',           validate(creditListQuery, 'query'), examCreditCtrl.listAdmin);
router.post('/exam-credits',          validate(creditCreateSchema),       examCreditCtrl.create);
router.patch('/exam-credits/:id',
  validate(creditIdParam, 'params'),
  validate(creditUpdateSchema),
  examCreditCtrl.update,
);
router.delete('/exam-credits/:id',    validate(creditIdParam, 'params'),  examCreditCtrl.remove);

// ----- Quizzes -----
router.post('/lessons/:lessonId/quizzes',
  validate(quizLessonIdParam, 'params'),
  validate(createQuizSchema),
  quizCtrl.createForLesson,
);
router.post('/courses/:courseId/quizzes',
  validate(quizCourseIdParam, 'params'),
  validate(createQuizSchema),
  quizCtrl.createForCourse,
);
router.get('/quizzes/:id',    validate(quizIdParam, 'params'), quizCtrl.getAdmin);
router.patch('/quizzes/:id',
  validate(quizIdParam, 'params'),
  validate(updateQuizSchema),
  quizCtrl.update,
);
router.delete('/quizzes/:id', validate(quizIdParam, 'params'), quizCtrl.remove);
router.post('/quizzes/:id/questions',
  validate(quizIdParam, 'params'),
  validate(createQuestionSchema),
  quizCtrl.addQuestion,
);
router.post('/quizzes/:id/questions/reorder',
  validate(quizIdParam, 'params'),
  validate(quizReorderSchema),
  quizCtrl.reorderQuestions,
);
router.patch('/questions/:id',
  validate(quizIdParam, 'params'),
  validate(updateQuestionSchema),
  quizCtrl.updateQuestion,
);
router.delete('/questions/:id', validate(quizIdParam, 'params'), quizCtrl.removeQuestion);

// ----- Exports (Excel) — ครูกด export เท่านั้น (CONTEXT 3.5) -----
router.get('/export/sales.xlsx',        validate(dateRangeQuery, 'query'),  exportCtrl.sales);
router.get('/export/students.xlsx',                                         exportCtrl.students);
router.get('/export/payments.xlsx',     validate(dateRangeQuery, 'query'),  exportCtrl.payments);
router.get('/export/quiz-scores.xlsx',  validate(quizScoresQuery, 'query'), exportCtrl.quizScores);
router.get('/export/exam-credits.xlsx', validate(creditsQuery, 'query'),    exportCtrl.examCredits);

module.exports = router;
