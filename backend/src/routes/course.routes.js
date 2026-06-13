const express = require('express');
const validate = require('../middleware/validate');
const controller = require('../controllers/course.controller');
const {
  listCoursesQuerySchema,
  slugParamSchema,
} = require('../validators/course.validators');

const router = express.Router();

router.get('/', validate(listCoursesQuerySchema, 'query'), controller.listPublic);
router.get('/:slug', validate(slugParamSchema, 'params'), controller.getPublicBySlug);
router.get('/:slug/tree', validate(slugParamSchema, 'params'), controller.getPublicTree);

module.exports = router;
