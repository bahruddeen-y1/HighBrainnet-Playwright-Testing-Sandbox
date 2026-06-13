const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/course.service');

// ----- Public -----
exports.listPublic = asyncHandler(async (req, res) => {
  const result = await service.list(req.query, { asAdmin: false });
  res.json(result);
});

exports.getPublicBySlug = asyncHandler(async (req, res) => {
  const course = await service.getBySlug(req.params.slug, { asAdmin: false });
  res.json({ course });
});

exports.getPublicTree = asyncHandler(async (req, res) => {
  const course = await service.getTree(req.params.slug, { asAdmin: false });
  res.json({ course });
});

// ----- Admin -----
exports.listAdmin = asyncHandler(async (req, res) => {
  const result = await service.list(req.query, { asAdmin: true });
  res.json(result);
});

exports.getAdminById = asyncHandler(async (req, res) => {
  const course = await service.getById(req.params.id, { asAdmin: true });
  res.json({ course });
});

exports.create = asyncHandler(async (req, res) => {
  const course = await service.create(req.body, req.user.id);
  res.status(201).json({ course });
});

exports.update = asyncHandler(async (req, res) => {
  const course = await service.update(req.params.id, req.body);
  res.json({ course });
});

exports.remove = asyncHandler(async (req, res) => {
  const result = await service.softDelete(req.params.id);
  res.json({ ok: true, ...result });
});

exports.restore = asyncHandler(async (req, res) => {
  const course = await service.restore(req.params.id);
  res.json({ course });
});
