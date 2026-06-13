const express = require('express');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/package.controller');
const {
  listQuerySchema,
  slugParamSchema,
} = require('../validators/package.validators');

const router = express.Router();

router.get('/', validate(listQuerySchema, 'query'), ctrl.listPublic);
router.get('/:slug', validate(slugParamSchema, 'params'), ctrl.getPublicBySlug);

module.exports = router;
