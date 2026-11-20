const express = require('express');
const { requireAuth } = require('../middleware/auth');
const settingsCtrl = require('../controllers/settings.controller');

const router = express.Router();

router.use(requireAuth);

// Display info for the checkout page (PromptPay name / bank account / mode).
router.get('/info', settingsCtrl.publicInfo);

module.exports = router;
