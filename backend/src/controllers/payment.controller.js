const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/payment.service');
const gbp = require('../services/gbprimepay.service');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

exports.start = asyncHandler(async (req, res) => {
  const result = await service.startPayment(req.user.id, req.params.id);
  res.json(result);
});

exports.webhook = asyncHandler(async (req, res) => {
  const signature = req.get('x-gbpay-signature') || req.body?.signature || '';
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));

  const verified = gbp.verifyWebhook({ rawBody, signatureHeader: signature });
  if (!verified) {
    logger.warn(`Webhook signature invalid (sig=${signature.slice(0, 20)})`);
    throw ApiError.unauthorized('Invalid webhook signature');
  }

  const result = await service.processWebhook(req.body);
  res.json(result);
});

exports.adminApprove = asyncHandler(async (req, res) => {
  const order = await service.approveManual(
    req.params.id,
    req.user.id,
    req.body.notes,
  );
  res.json({ order });
});
