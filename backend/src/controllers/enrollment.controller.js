const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/enrollment.service');

// Student
exports.listMine = asyncHandler(async (req, res) => {
  const items = await service.listForStudent(req.user.id);
  res.json({ items });
});

// Admin
exports.adminList = asyncHandler(async (req, res) => {
  const result = await service.listForAdmin(req.query);
  res.json(result);
});

exports.adminCreate = asyncHandler(async (req, res) => {
  const enrollment = await service.adminCreate({ ...req.body, adminId: req.user.id });
  res.status(201).json({ enrollment });
});

exports.adminUpdate = asyncHandler(async (req, res) => {
  const enrollment = await service.adminUpdate(req.params.id, req.body);
  res.json({ enrollment });
});

exports.adminRevoke = asyncHandler(async (req, res) => {
  const r = await service.adminRevoke(req.params.id, req.user.id);
  res.json(r);
});
