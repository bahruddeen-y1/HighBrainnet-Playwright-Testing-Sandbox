const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/dashboard.service');

exports.summary = asyncHandler(async (_req, res) => {
  res.json(await service.summary());
});

exports.salesChart = asyncHandler(async (req, res) => {
  const days = Math.max(1, Math.min(180, Number(req.query.days) || 30));
  res.json(await service.salesChart(days));
});

exports.topCourses = asyncHandler(async (req, res) => {
  const days = Math.max(1, Math.min(365, Number(req.query.days) || 30));
  const limit = Math.max(1, Math.min(20, Number(req.query.limit) || 3));
  const items = await service.topCourses({ days, limit });
  res.json({ items });
});
