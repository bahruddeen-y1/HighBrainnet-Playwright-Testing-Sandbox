const crypto = require('crypto');

// Build a coarse device fingerprint from the request.
// Note: this is NOT a strong identifier — combined with client-side hints
// it's "good enough" to enforce single-device login.
function buildFingerprint(req, extraClientHash) {
  const ua = req.get('user-agent') || '';
  const accept = req.get('accept-language') || '';
  const raw = `${ua}|${accept}|${extraClientHash || ''}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function buildDeviceLabel(req) {
  const ua = req.get('user-agent') || 'unknown';
  return ua.slice(0, 120);
}

module.exports = { buildFingerprint, buildDeviceLabel };
