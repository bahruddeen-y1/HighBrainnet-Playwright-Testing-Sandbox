const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');
const ApiError = require('../utils/ApiError');

exports.register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, req);
  res.status(201).json(result);
});

exports.login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, req);
  res.json(result);
});

exports.refresh = asyncHandler(async (req, res) => {
  const token = req.body?.refreshToken || req.cookies?.refreshToken;
  if (!token) throw ApiError.unauthorized('Missing refresh token');
  const result = await authService.refresh(token);
  res.json(result);
});

exports.logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.id);
  res.status(204).end();
});

exports.me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  res.json({ user });
});
