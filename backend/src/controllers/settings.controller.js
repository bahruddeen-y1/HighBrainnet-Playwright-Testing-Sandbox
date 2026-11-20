const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/settings.service');

// Admin: full settings (excludes nothing — admin needs to see the API key)
exports.adminGet = asyncHandler(async (_req, res) => {
  const settings = await service.get();
  res.json({ settings });
});

exports.adminUpdate = asyncHandler(async (req, res) => {
  const settings = await service.update(req.body, req.user.id);
  res.json({ settings });
});

// Public (authenticated student) payment display info — no secrets
exports.publicInfo = asyncHandler(async (_req, res) => {
  const payment = await service.getPublic();
  res.json({ payment });
});
