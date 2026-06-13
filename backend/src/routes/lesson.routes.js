const express = require('express');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/video.controller');
const { watchProgressSchema, lessonIdParam } = require('../validators/video.validators');

const router = express.Router();

router.use(requireAuth);

router.get('/:id/play',     validate(lessonIdParam, 'params'), ctrl.getPlayback);
router.get('/:id/progress', validate(lessonIdParam, 'params'), ctrl.getProgress);
router.post('/:id/watch',
  validate(lessonIdParam, 'params'),
  validate(watchProgressSchema),
  ctrl.postWatch,
);

module.exports = router;
