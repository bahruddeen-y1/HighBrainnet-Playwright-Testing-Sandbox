const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/package.service');

// ----- Public -----
exports.listPublic = asyncHandler(async (req, res) => {
  const result = await service.list(req.query, { asAdmin: false });
  res.json(result);
});

exports.getPublicBySlug = asyncHandler(async (req, res) => {
  const pkg = await service.getBySlug(req.params.slug);
  res.json({ package: pkg });
});

// ----- Admin -----
exports.listAdmin = asyncHandler(async (req, res) => {
  const result = await service.list(req.query, { asAdmin: true });
  res.json(result);
});

exports.getAdminById = asyncHandler(async (req, res) => {
  const pkg = await service.getById(req.params.id, { asAdmin: true });
  res.json({ package: pkg });
});

exports.create = asyncHandler(async (req, res) => {
  const pkg = await service.create(req.body);
  res.status(201).json({ package: pkg });
});

exports.update = asyncHandler(async (req, res) => {
  const pkg = await service.update(req.params.id, req.body);
  res.json({ package: pkg });
});

exports.setCourses = asyncHandler(async (req, res) => {
  const pkg = await service.setCourses(req.params.id, req.body.courseIds);
  res.json({ package: pkg });
});

exports.remove = asyncHandler(async (req, res) => {
  const r = await service.softDelete(req.params.id);
  res.json(r);
});

exports.restore = asyncHandler(async (req, res) => {
  const pkg = await service.restore(req.params.id);
  res.json({ package: pkg });
});
