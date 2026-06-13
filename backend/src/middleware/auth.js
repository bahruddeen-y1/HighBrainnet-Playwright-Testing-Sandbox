const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/tokens');
const prisma = require('../config/prisma');

async function requireAuth(req, _res, next) {
  try {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw ApiError.unauthorized('Missing bearer token');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      throw ApiError.unauthorized('Invalid or expired token');
    }

    const user = await prisma.user.findFirst({
      where: { id: payload.sub, isDeleted: false },
      select: {
        id: true,
        email: true,
        role: true,
        sessionToken: true,
        isSuspended: true,
      },
    });

    if (!user) throw ApiError.unauthorized('User not found');
    if (user.isSuspended) throw ApiError.forbidden('Account suspended');

    // Single device enforcement: token must carry the active sessionToken
    if (user.sessionToken && payload.sid && user.sessionToken !== payload.sid) {
      throw ApiError.unauthorized('Session replaced on another device');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
}

module.exports = { requireAuth, requireRole };
