const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/examCredit.service');

exports.listPublic = asyncHandler(async (req, res) => {
  res.json(await service.listPublic(req.query));
});

exports.listAdmin = asyncHandler(async (req, res) => {
  res.json(await service.listAdmin(req.query));
});

exports.create = asyncHandler(async (req, res) => {
  const credit = await service.create(req.body);
  res.status(201).json({ credit });
});

exports.update = asyncHandler(async (req, res) => {
  const credit = await service.update(req.params.id, req.body);
  res.json({ credit });
});

exports.remove = asyncHandler(async (req, res) => {
  res.json(await service.softDelete(req.params.id));
});
