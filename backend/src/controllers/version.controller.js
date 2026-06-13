const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/version.service');

exports.list = asyncHandler(async (req, res) => {
  const items = await service.list(req.params.courseId);
  res.json({ items });
});

exports.create = asyncHandler(async (req, res) => {
  const version = await service.create(req.params.courseId, req.body);
  res.status(201).json({ version });
});

exports.update = asyncHandler(async (req, res) => {
  const version = await service.update(req.params.id, req.body);
  res.json({ version });
});

exports.publish = asyncHandler(async (req, res) => {
  const version = await service.publish(req.params.id);
  res.json({ version });
});

exports.remove = asyncHandler(async (req, res) => {
  const r = await service.remove(req.params.id);
  res.json(r);
});
