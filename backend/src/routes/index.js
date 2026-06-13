const express = require('express');
const authRoutes = require('./auth.routes');
const courseRoutes = require('./course.routes');
const levelRoutes = require('./level.routes');
const lessonRoutes = require('./lesson.routes');
const orderRoutes = require('./order.routes');
const webhookRoutes = require('./webhook.routes');
const packageRoutes = require('./package.routes');
const enrollmentRoutes = require('./enrollment.routes');
const examCreditRoutes = require('./examCredit.routes');
const quizRoutes = require('./quiz.routes');
const certificateRoutes = require('./certificate.routes');
const meRoutes = require('./me.routes');
const adminRoutes = require('./admin.routes');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'highbrainnet-backend', time: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/levels', levelRoutes);
router.use('/courses', courseRoutes);
router.use('/lessons', lessonRoutes);
router.use('/orders', orderRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/packages', packageRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/exam-credits', examCreditRoutes);
router.use('/quizzes', quizRoutes);
router.use('/certificates', certificateRoutes);
router.use('/me', meRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
