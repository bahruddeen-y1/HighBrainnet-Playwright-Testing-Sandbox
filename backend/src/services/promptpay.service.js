/**
 * PromptPay QR (Thai QR Payment / EMVCo) payload generator.
 *
 * Builds the raw QR string locally from the admin's PromptPay id + the order
 * amount — no external gateway needed. Field order matches the widely-used
 * `promptpay-qr` library (country before currency) so any banking app reads it.
 *
 * Refs: EMVCo MPM spec + Bank of Thailand PromptPay standard.
 */
const ApiError = require('../utils/ApiError');

// EMVCo tag ids
const ID_PAYLOAD_FORMAT = '00';
const ID_POI_METHOD = '01';
const ID_MERCHANT_BOT = '29'; // PromptPay merchant account info
const ID_COUNTRY_CODE = '58';
const ID_CURRENCY = '53';
const ID_AMOUNT = '54';
const ID_CRC = '63';

const POI_STATIC = '11'; // no amount — reusable
const POI_DYNAMIC = '12'; // amount embedded — one transaction

const SUB_AID = '00'; // Application ID
const SUB_MOBILE = '01';
const SUB_CITIZEN = '02';
const SUB_EWALLET = '03';

const AID_PROMPTPAY = 'A000000677010111';
const CURRENCY_THB = '764';
const COUNTRY_TH = 'TH';

/** Format one TLV field: 2-digit id + 2-digit length + value. */
function tlv(id, value) {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * Normalise the target id for the merchant sub-field.
 * @param {string} promptpayId raw id (phone / citizen / e-wallet)
 * @param {'PHONE'|'CITIZEN'|'EWALLET'} type
 * @returns {{ subId: string, value: string }}
 */
function formatTarget(promptpayId, type) {
  const digits = String(promptpayId || '').replace(/[^0-9]/g, '');
  if (!digits) throw new ApiError(400, 'ยังไม่ได้ตั้งค่าเลขพร้อมเพย์');

  switch (type) {
    case 'PHONE': {
      // 0812345678 -> 66812345678 -> 0066812345678 (13 chars)
      const formatted = digits.replace(/^0/, '66').padStart(13, '0');
      return { subId: SUB_MOBILE, value: formatted };
    }
    case 'CITIZEN':
      if (digits.length !== 13) {
        throw new ApiError(400, 'เลขบัตรประชาชน/เลขผู้เสียภาษีต้องมี 13 หลัก');
      }
      return { subId: SUB_CITIZEN, value: digits };
    case 'EWALLET':
      if (digits.length !== 15) {
        throw new ApiError(400, 'เลข e-Wallet ต้องมี 15 หลัก');
      }
      return { subId: SUB_EWALLET, value: digits };
    default:
      throw new ApiError(400, `ประเภทเลขพร้อมเพย์ไม่ถูกต้อง: ${type}`);
  }
}

/** CRC16-CCITT (XMODEM): poly 0x1021, init 0xFFFF. Returns 4 upper-hex chars. */
function crc16(data) {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Generate a PromptPay QR raw payload.
 * @param {object} opts
 * @param {string} opts.promptpayId
 * @param {'PHONE'|'CITIZEN'|'EWALLET'} [opts.type='PHONE']
 * @param {number} [opts.amount] omit/0 -> static reusable QR
 * @returns {string} EMVCo raw data (encode this into a QR image)
 */
function generatePayload({ promptpayId, type = 'PHONE', amount } = {}) {
  const { subId, value } = formatTarget(promptpayId, type);
  const hasAmount = amount != null && Number(amount) > 0;

  const merchant = tlv(SUB_AID, AID_PROMPTPAY) + tlv(subId, value);

  const fields = [
    tlv(ID_PAYLOAD_FORMAT, '01'),
    tlv(ID_POI_METHOD, hasAmount ? POI_DYNAMIC : POI_STATIC),
    tlv(ID_MERCHANT_BOT, merchant),
    tlv(ID_COUNTRY_CODE, COUNTRY_TH),
    tlv(ID_CURRENCY, CURRENCY_THB),
  ];
  if (hasAmount) {
    fields.push(tlv(ID_AMOUNT, Number(amount).toFixed(2)));
  }

  const body = fields.join('') + ID_CRC + '04'; // CRC field id + length, then checksum
  return body + crc16(body);
}

module.exports = { generatePayload, crc16, formatTarget };
