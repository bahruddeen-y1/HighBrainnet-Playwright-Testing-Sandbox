/**
 * Slip verification — pluggable provider.
 *
 * Used when AppSetting.paymentMode = AUTO. The student uploads a bank-transfer
 * slip; the configured provider confirms it is genuine and that the amount +
 * receiver match the order. Providers:
 *   - mock      : dev/local — no external call (default)
 *   - easyslip  : https://developer.easyslip.com (needs apiKey)
 *   - slipok    : https://slipok.com (needs apiKey)
 *
 * verify() returns a normalised result:
 *   { verified, reason, amount, receiverName, transRef, raw }
 */
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const AMOUNT_TOLERANCE = 0.01;

function amountMatches(got, expected) {
  return Math.abs(Number(got) - Number(expected)) <= AMOUNT_TOLERANCE;
}

/**
 * @param {object} args
 * @param {string} [args.provider='mock']
 * @param {string} [args.apiKey]
 * @param {object} args.slip  { imageBase64?, payload?, transRef?, mock? }
 * @param {object} args.expected { amount, promptpayId, promptpayName }
 */
async function verify({ provider = 'mock', apiKey, slip = {}, expected = {} }) {
  switch (provider) {
    case 'mock':
    case undefined:
    case null:
    case '':
      return verifyMock({ slip, expected });
    case 'easyslip':
      return verifyEasySlip({ apiKey, slip, expected });
    case 'slipok':
      return verifySlipOk({ apiKey, slip, expected });
    default:
      throw new ApiError(503, `ผู้ให้บริการตรวจสลิปไม่รองรับ: ${provider}`);
  }
}

/**
 * Mock provider — deterministic, for dev/tests.
 * The uploaded slip may carry a `mock` hint to simulate outcomes:
 *   slip.mock = { fail: true }            -> rejected
 *   slip.mock = { amount: 999 }           -> verified with that amount (mismatch test)
 * Otherwise the slip is accepted at the expected amount.
 */
function verifyMock({ slip, expected }) {
  const hint = slip.mock || {};
  if (hint.fail) {
    return { verified: false, reason: 'สลิปไม่ผ่านการตรวจสอบ (mock)', raw: { mock: hint } };
  }
  const amount = hint.amount != null ? Number(hint.amount) : Number(expected.amount);
  if (!amountMatches(amount, expected.amount)) {
    return {
      verified: false,
      reason: `ยอดเงินในสลิปไม่ตรง (สลิป ฿${amount} / ต้องชำระ ฿${expected.amount})`,
      amount,
      raw: { mock: hint },
    };
  }
  return {
    verified: true,
    reason: null,
    amount,
    receiverName: expected.promptpayName || null,
    transRef: hint.transRef || `mock_${Date.now()}`,
    raw: { mock: true },
  };
}

async function verifyEasySlip({ apiKey, slip, expected }) {
  if (!apiKey) throw new ApiError(503, 'ยังไม่ได้ตั้งค่า API key ของ EasySlip');

  // EasySlip verifies by QR payload extracted from the slip, or by image upload.
  const res = await fetch('https://developer.easyslip.com/api/v1/verify', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(
      slip.payload ? { payload: slip.payload } : { image: slip.imageBase64 },
    ),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 200) {
    logger.warn(`[easyslip] verify failed: ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
    return { verified: false, reason: data?.message || 'ตรวจสลิปไม่สำเร็จ', raw: data };
  }
  const d = data.data || {};
  const amount = Number(d.amount?.amount ?? d.amount);
  if (!amountMatches(amount, expected.amount)) {
    return { verified: false, reason: 'ยอดเงินในสลิปไม่ตรงกับคำสั่งซื้อ', amount, raw: data };
  }
  return {
    verified: true,
    reason: null,
    amount,
    receiverName: d.receiver?.account?.name?.th || d.receiver?.displayName || null,
    transRef: d.transRef || d.ref || null,
    raw: data,
  };
}

async function verifySlipOk({ apiKey, slip, expected }) {
  if (!apiKey) throw new ApiError(503, 'ยังไม่ได้ตั้งค่า API key ของ SlipOK');

  const res = await fetch('https://api.slipok.com/api/line/apikey/verify', {
    method: 'POST',
    headers: { 'x-authorization': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ data: slip.payload, log: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    logger.warn(`[slipok] verify failed: ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
    return { verified: false, reason: data?.message || 'ตรวจสลิปไม่สำเร็จ', raw: data };
  }
  const d = data.data || {};
  const amount = Number(d.amount);
  if (!amountMatches(amount, expected.amount)) {
    return { verified: false, reason: 'ยอดเงินในสลิปไม่ตรงกับคำสั่งซื้อ', amount, raw: data };
  }
  return {
    verified: true,
    reason: null,
    amount,
    receiverName: d.receiverName || null,
    transRef: d.transRef || null,
    raw: data,
  };
}

module.exports = { verify, amountMatches };
