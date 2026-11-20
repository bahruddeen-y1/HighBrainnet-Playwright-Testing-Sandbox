const { z } = require('zod');

// Empty strings from form inputs become null (clears the field).
const optionalStr = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const updateSettingsSchema = z
  .object({
    paymentMode: z.enum(['MANUAL', 'AUTO']).optional(),
    qrSource: z.enum(['PROMPTPAY', 'GBP']).optional(),

    promptpayId: optionalStr(20),
    promptpayType: z.enum(['PHONE', 'CITIZEN', 'EWALLET']).optional(),
    promptpayName: optionalStr(120),

    bankName: optionalStr(80),
    bankAccountNo: optionalStr(40),
    bankAccountName: optionalStr(120),

    slipProvider: z.enum(['mock', 'easyslip', 'slipok']).optional(),
    slipApiKey: optionalStr(200),
  })
  .strict();

module.exports = { updateSettingsSchema };
