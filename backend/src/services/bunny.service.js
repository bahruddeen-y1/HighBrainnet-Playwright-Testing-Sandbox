const crypto = require('crypto');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const STREAM_BASE = 'https://video.bunnycdn.com';
const MOCK = String(process.env.BUNNY_MOCK || '').toLowerCase() === 'true';

function isConfigured() {
  return Boolean(env.BUNNY_API_KEY && env.BUNNY_LIBRARY_ID);
}

function requireConfigured() {
  if (MOCK) return;
  if (!isConfigured()) {
    throw new ApiError(503, 'Bunny.net ยังไม่ได้ตั้งค่า (BUNNY_API_KEY / BUNNY_LIBRARY_ID)');
  }
}

async function bunnyRequest(method, path, body) {
  const url = `${STREAM_BASE}/library/${env.BUNNY_LIBRARY_ID}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      AccessKey: env.BUNNY_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, `Bunny.net error: ${res.status} ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------- Public API ----------

async function createVideo(title) {
  requireConfigured();
  if (MOCK) {
    const guid = crypto.randomUUID();
    logger.warn(`[bunny:mock] createVideo title="${title}" → guid=${guid}`);
    return {
      guid,
      title,
      status: 0,
      uploadUrl: `${STREAM_BASE}/library/MOCK/videos/${guid}`,
      uploadAccessKey: 'mock-access-key',
    };
  }

  const data = await bunnyRequest('POST', '/videos', { title });
  return {
    guid: data.guid,
    title: data.title,
    status: data.status,
    // direct PUT upload — browser uses this with AccessKey header
    uploadUrl: `${STREAM_BASE}/library/${env.BUNNY_LIBRARY_ID}/videos/${data.guid}`,
    uploadAccessKey: env.BUNNY_API_KEY, // CAREFUL: only return to admins
  };
}

async function getVideo(guid) {
  requireConfigured();
  if (MOCK) {
    return {
      guid,
      status: 4, // ready
      length: 480,
      title: 'Mock Video',
    };
  }
  return bunnyRequest('GET', `/videos/${guid}`);
}

async function deleteVideo(guid) {
  requireConfigured();
  if (MOCK) {
    logger.warn(`[bunny:mock] deleteVideo guid=${guid}`);
    return { ok: true };
  }
  await bunnyRequest('DELETE', `/videos/${guid}`);
  return { ok: true };
}

// ---------- DRM token signing ----------
// Bunny "Token Authentication" recipe:
//   token = base64url( sha256( securityKey + path + expires ) )
//   ?token=...&token_path=...&expires=<unix>
// Optional: lock to IP, country, or referer (we use IP-less + referer via hotlink rules)

function signPlaybackUrl(guid, { ttlSeconds = 2 * 60 * 60, ip } = {}) {
  if (!MOCK && !env.BUNNY_CDN_HOSTNAME) {
    throw new ApiError(503, 'Bunny.net ยังไม่ได้ตั้งค่า BUNNY_CDN_HOSTNAME');
  }
  if (!MOCK && !env.BUNNY_STREAM_TOKEN_KEY) {
    throw new ApiError(503, 'Bunny.net ยังไม่ได้ตั้งค่า BUNNY_STREAM_TOKEN_KEY');
  }

  const hostname = env.BUNNY_CDN_HOSTNAME || 'mock.b-cdn.net';
  const securityKey = env.BUNNY_STREAM_TOKEN_KEY || 'mock-security-key';

  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const tokenPath = `/${guid}/`;
  const raw = `${securityKey}${tokenPath}${expires}${ip || ''}`;
  const token = crypto
    .createHash('sha256')
    .update(raw)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  const base = `https://${hostname}/${guid}`;
  const query = new URLSearchParams({ token, token_path: tokenPath, expires: String(expires) });
  if (ip) query.set('token_ip', ip);

  return {
    hls: `${base}/playlist.m3u8?${query.toString()}`,
    mp4_720: `${base}/play_720p.mp4?${query.toString()}`,
    expiresAt: new Date(expires * 1000).toISOString(),
  };
}

module.exports = {
  isConfigured,
  isMock: () => MOCK,
  createVideo,
  getVideo,
  deleteVideo,
  signPlaybackUrl,
};
