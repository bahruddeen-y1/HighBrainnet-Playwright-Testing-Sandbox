const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/order.service');

exports.create = asyncHandler(async (req, res) => {
  const key = req.get('idempotency-key') || undefined;
  const order = await service.create(req.user.id, req.body, key);
  res.status(201).json({ order });
});

exports.list = asyncHandler(async (req, res) => {
  const result = await service.list(req.user.id, req.query, { asAdmin: false });
  res.json(result);
});

exports.get = asyncHandler(async (req, res) => {
  const order = await service.get(req.user.id, req.params.id, { asAdmin: false });
  res.json({ order });
});

// Admin
exports.adminList = asyncHandler(async (req, res) => {
  const result = await service.list(null, req.query, { asAdmin: true });
  res.json(result);
});

exports.adminGet = asyncHandler(async (req, res) => {
  const order = await service.get(null, req.params.id, { asAdmin: true });
  res.json({ order });
});
