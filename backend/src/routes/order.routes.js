const express = require('express');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const orderCtrl = require('../controllers/order.controller');
const paymentCtrl = require('../controllers/payment.controller');
const {
  createOrderSchema,
  orderIdParam,
  listOrdersQuerySchema,
  submitSlipSchema,
} = require('../validators/order.validators');

const router = express.Router();

router.use(requireAuth);

router.post('/', validate(createOrderSchema), orderCtrl.create);
router.get('/',  validate(listOrdersQuerySchema, 'query'), orderCtrl.list);
router.get('/:id', validate(orderIdParam, 'params'), orderCtrl.get);

router.post('/:id/payment', validate(orderIdParam, 'params'), paymentCtrl.start);
router.post('/:id/slip',
  validate(orderIdParam, 'params'),
  validate(submitSlipSchema),
  paymentCtrl.submitSlip,
);

const certificateCtrl = require('../controllers/certificate.controller');
router.get('/:id/receipt.pdf', validate(orderIdParam, 'params'), certificateCtrl.receiptPdf);

module.exports = router;
