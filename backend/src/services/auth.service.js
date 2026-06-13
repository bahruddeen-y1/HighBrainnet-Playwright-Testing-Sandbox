const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  randomToken,
} = require('../utils/tokens');

const REFRESH_TTL_DAYS = 7;

function refreshExpiresAt() {
  return new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    nickname: u.nickname,
    role: u.role,
  };
}

async function issueTokens(user, sessionId) {
  const access = signAccessToken({ sub: user.id, role: user.role, sid: sessionId });
  // jti makes each refresh token unique even when issued within the same second
  const refresh = signRefreshToken({ sub: user.id, sid: sessionId, jti: randomToken(8) });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refresh),
      expiresAt: refreshExpiresAt(),
    },
  });

  return { accessToken: access, refreshToken: refresh };
}

async function register(input, req) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict('อีเมลนี้ถูกใช้แล้ว');

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_COST);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      nickname: input.nickname,
      phone: input.phone,
      pdpaConsent: true,
      pdpaConsentAt: new Date(),
      pdpaVersion: input.pdpaVersion,
    },
  });

  return loginInternal(user, input.clientHash, req);
}

async function login(input, req) {
  const user = await prisma.user.findFirst({
    where: { email: input.email, isDeleted: false },
  });
  if (!user) throw ApiError.unauthorized('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  if (user.isSuspended) throw ApiError.forbidden('บัญชีถูกระงับ');

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw ApiError.unauthorized('อีเมลหรือรหัสผ่านไม่ถูกต้อง');

  return loginInternal(user, input.clientHash, req);
}

async function loginInternal(user, clientHash, req) {
  const { buildFingerprint, buildDeviceLabel } = require('../utils/deviceFingerprint');

  const sessionId = randomToken(16);
  const fingerprint = buildFingerprint(req, clientHash);
  const label = buildDeviceLabel(req);

  // single-device: replace any previous session + revoke its refresh tokens
  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        sessionToken: sessionId,
        deviceFingerprint: fingerprint,
        deviceLabel: label,
        lastLoginAt: new Date(),
        lastLoginIp: req.ip,
      },
    }),
  ]);

  const tokens = await issueTokens(user, sessionId);
  return { user: publicUser(user), ...tokens };
}

async function refresh(refreshTokenStr) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshTokenStr);
  } catch {
    throw ApiError.unauthorized('Refresh token ไม่ถูกต้อง');
  }

  const tokenHash = hashToken(refreshTokenStr);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized('Refresh token หมดอายุหรือถูก revoke');
  }

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, isDeleted: false },
  });
  if (!user) throw ApiError.unauthorized();

  // Enforce single-device: token's sid must match current sessionToken
  if (user.sessionToken && payload.sid && user.sessionToken !== payload.sid) {
    throw ApiError.unauthorized('Session ถูกแทนที่บนอุปกรณ์อื่น');
  }

  // Rotate refresh token
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });
  const tokens = await issueTokens(user, payload.sid);

  return { user: publicUser(user), ...tokens };
}

async function logout(userId) {
  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { sessionToken: null, deviceFingerprint: null },
    }),
  ]);
}

async function getMe(userId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
  });
  if (!user) throw ApiError.notFound('User not found');
  return publicUser(user);
}

module.exports = { register, login, refresh, logout, getMe };
