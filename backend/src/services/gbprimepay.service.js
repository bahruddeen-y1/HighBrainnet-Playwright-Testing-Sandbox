const crypto = require('crypto');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const API_BASE = 'https://api.gbprimepay.com';
const MOCK = String(process.env.GBP_MOCK || '').toLowerCase() === 'true';

function isConfigured() {
  return Boolean(env.GBP_MERCHANT_ID && env.GBP_API_KEY && env.GBP_SECRET_KEY);
}

function requireConfigured() {
  if (MOCK) return;
  if (!isConfigured()) {
    throw new ApiError(503, 'GB Prime Pay ยังไม่ได้ตั้งค่า (GBP_MERCHANT_ID / GBP_API_KEY / GBP_SECRET_KEY)');
  }
}

/**
 * Create a QR PromptPay for an order.
 * Returns { gatewayRef, qrRawData, qrImage, amount, currency }
 */
async function createQrCode({ referenceNo, amount, detail, backgroundUrl }) {
  requireConfigured();

  if (MOCK) {
    const gatewayRef = `mock_${crypto.randomBytes(8).toString('hex')}`;
    logger.warn(`[gbp:mock] createQrCode ref=${referenceNo} amount=${amount} → gatewayRef=${gatewayRef}`);
    return {
      gatewayRef,
      qrRawData: `00020101021229370016A0000006770101110113006688888888885802TH53037645406${amount}5802TH62070703${referenceNo}6304ABCD`,
      qrImage: null, // base64 PNG (real API returns this)
      amount,
      currency: 'THB',
    };
  }

  const res = await fetch(`${API_BASE}/v3/qrcode`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      rememberCard: false,
      merchantDefined1: referenceNo,
      amount: Number(amount).toFixed(2),
      referenceNo,
      backgroundUrl,
      detail,
      customerName: 'HighBrainnet Student',
      token: env.GBP_API_KEY,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, `GB Prime Pay error: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    gatewayRef: data.gbpReferenceNo,
    qrRawData: data.qrcode?.rawData,
    qrImage: data.qrcode?.qrcodeBase64,
    amount,
    currency: 'THB',
  };
}

/**
 * Verify webhook signature.
 * GB Prime Pay sends `X-GBPay-Signature` header = HMAC-SHA256(secret, rawBody) hex.
 * We accept either header for resilience (X-GBPay-Signature OR signature in body).
 */
function verifyWebhook({ rawBody, signatureHeader }) {
  if (MOCK) {
    // dev: accept anything with signature="mock"
    return signatureHeader === 'mock' || signatureHeader === env.GBP_WEBHOOK_SECRET;
  }

  if (!env.GBP_WEBHOOK_SECRET) {
    throw new ApiError(503, 'GBP_WEBHOOK_SECRET ยังไม่ได้ตั้งค่า');
  }
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac('sha256', env.GBP_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  // constant-time compare
  const a = Buffer.from(signatureHeader, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  isConfigured,
  isMock: () => MOCK,
  createQrCode,
  verifyWebhook,
};
