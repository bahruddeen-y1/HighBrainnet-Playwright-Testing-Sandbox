const express = require('express');
const paymentCtrl = require('../controllers/payment.controller');

const router = express.Router();

// No auth (gateway-to-server). Signature is verified inside the controller.
router.post('/gbprimepay', paymentCtrl.webhook);

module.exports = router;
