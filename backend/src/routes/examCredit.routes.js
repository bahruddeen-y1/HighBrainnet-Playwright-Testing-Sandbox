const express = require('express');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/examCredit.controller');
const { listQuerySchema } = require('../validators/examCredit.validators');

const router = express.Router();

router.get('/', validate(listQuerySchema, 'query'), ctrl.listPublic);

module.exports = router;
