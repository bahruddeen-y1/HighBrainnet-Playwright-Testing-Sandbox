const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/chapter.service');

exports.listAdmin = asyncHandler(async (req, res) => {
  const items = await service.list(req.params.courseId, { asAdmin: true });
  res.json({ items });
});

exports.create = asyncHandler(async (req, res) => {
  const chapter = await service.create(req.params.courseId, req.body);
  res.status(201).json({ chapter });
});

exports.update = asyncHandler(async (req, res) => {
  const chapter = await service.update(req.params.id, req.body);
  res.json({ chapter });
});

exports.remove = asyncHandler(async (req, res) => {
  const r = await service.softDelete(req.params.id);
  res.json(r);
});

exports.restore = asyncHandler(async (req, res) => {
  const chapter = await service.restore(req.params.id);
  res.json({ chapter });
});

exports.reorder = asyncHandler(async (req, res) => {
  const items = await service.reorder(req.params.courseId, req.body.items);
  res.json({ items });
});
