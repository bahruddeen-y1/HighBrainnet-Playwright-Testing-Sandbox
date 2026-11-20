const prisma = require('../config/prisma');

const SETTING_ID = 1;

const DEFAULTS = {
  id: SETTING_ID,
  paymentMode: 'MANUAL',
  qrSource: 'PROMPTPAY',
  promptpayType: 'PHONE',
  slipProvider: 'mock',
};

/** Get the singleton settings row, creating it with defaults if missing. */
async function get() {
  const existing = await prisma.appSetting.findUnique({ where: { id: SETTING_ID } });
  if (existing) return existing;
  return prisma.appSetting.create({ data: DEFAULTS });
}

/**
 * Public-safe view for the checkout page. Never exposes the slip API key
 * (or which provider is configured).
 */
async function getPublic() {
  const s = await get();
  return {
    paymentMode: s.paymentMode,
    qrSource: s.qrSource,
    promptpayName: s.promptpayName,
    bankName: s.bankName,
    bankAccountNo: s.bankAccountNo,
    bankAccountName: s.bankAccountName,
    // true when a PromptPay id is configured so the client knows a QR is available
    promptpayConfigured: Boolean(s.promptpayId),
  };
}

/** Update the singleton. `data` is already validated. */
async function update(data, adminId) {
  const payload = { ...data, updatedById: adminId || null };
  return prisma.appSetting.upsert({
    where: { id: SETTING_ID },
    update: payload,
    create: { ...DEFAULTS, ...payload },
  });
}

module.exports = { get, getPublic, update, SETTING_ID };
