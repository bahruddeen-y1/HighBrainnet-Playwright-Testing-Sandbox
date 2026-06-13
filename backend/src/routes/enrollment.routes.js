const express = require('express');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/enrollment.controller');

const router = express.Router();

router.get('/', requireAuth, ctrl.listMine);

module.exports = router;
