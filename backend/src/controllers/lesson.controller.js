const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/lesson.service');

exports.listAdmin = asyncHandler(async (req, res) => {
  const items = await service.list(req.params.chapterId, { asAdmin: true });
  res.json({ items });
});

exports.create = asyncHandler(async (req, res) => {
  const lesson = await service.create(req.params.chapterId, req.body);
  res.status(201).json({ lesson });
});

exports.update = asyncHandler(async (req, res) => {
  const lesson = await service.update(req.params.id, req.body);
  res.json({ lesson });
});

exports.remove = asyncHandler(async (req, res) => {
  const r = await service.softDelete(req.params.id);
  res.json(r);
});

exports.restore = asyncHandler(async (req, res) => {
  const lesson = await service.restore(req.params.id);
  res.json({ lesson });
});

exports.reorder = asyncHandler(async (req, res) => {
  const items = await service.reorder(req.params.chapterId, req.body.items);
  res.json({ items });
});
