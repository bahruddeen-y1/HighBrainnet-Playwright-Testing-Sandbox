const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/userAdmin.service');

exports.list = asyncHandler(async (req, res) => {
  res.json(await service.list(req.query));
});

exports.get = asyncHandler(async (req, res) => {
  const user = await service.getDetail(req.params.id);
  res.json({ user });
});

exports.suspend = asyncHandler(async (req, res) => {
  res.json(await service.suspend(req.params.id, req.user.id));
});

exports.unsuspend = asyncHandler(async (req, res) => {
  res.json(await service.unsuspend(req.params.id, req.user.id));
});

exports.unlockDevice = asyncHandler(async (req, res) => {
  res.json(await service.unlockDevice(req.params.id, req.user.id));
});
