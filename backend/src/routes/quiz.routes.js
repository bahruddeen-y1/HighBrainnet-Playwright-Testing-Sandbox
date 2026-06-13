const express = require('express');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/quiz.controller');
const {
  submitSchema, idParam, lessonIdParam, courseIdParam,
} = require('../validators/quiz.validators');

const router = express.Router();

router.use(requireAuth);

router.get('/lesson/:lessonId', validate(lessonIdParam, 'params'), ctrl.listForLesson);
router.get('/course/:courseId', validate(courseIdParam, 'params'), ctrl.listForCourse);

router.get('/:id', validate(idParam, 'params'), ctrl.getForStudent);
router.post('/:id/start', validate(idParam, 'params'), ctrl.start);
router.post('/:id/submit',
  validate(idParam, 'params'),
  validate(submitSchema),
  ctrl.submit,
);
router.get('/:id/results', validate(idParam, 'params'), ctrl.myResults);

module.exports = router;
