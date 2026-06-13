const { z } = require('zod');

const passwordSchema = z
  .string()
  .min(8, 'Password ต้องยาวอย่างน้อย 8 ตัว')
  .max(128);

const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: passwordSchema,
  fullName: z.string().min(1).max(120),
  nickname: z.string().max(60).optional(),
  phone: z
    .string()
    .regex(/^[0-9+\-\s()]{8,20}$/, 'รูปแบบเบอร์โทรไม่ถูกต้อง')
    .optional(),
  pdpaConsent: z.literal(true, {
    errorMap: () => ({ message: 'ต้องยอมรับ PDPA consent ก่อนสมัคร' }),
  }),
  pdpaVersion: z.string().default('v1'),
  clientHash: z.string().max(256).optional(),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
  clientHash: z.string().max(256).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

module.exports = { registerSchema, loginSchema, refreshSchema };
