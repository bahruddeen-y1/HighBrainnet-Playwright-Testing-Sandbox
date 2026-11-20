const { z } = require('zod');

const orderItemSchema = z
  .object({
    itemType: z.enum(['course', 'package', 'upgrade']),
    courseId: z.string().uuid().optional(),
    versionId: z.string().uuid().optional(),
    packageId: z.string().uuid().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.itemType === 'course' && !v.courseId) {
      ctx.addIssue({ code: 'custom', message: 'courseId is required for itemType=course' });
    }
    if (v.itemType === 'package' && !v.packageId) {
      ctx.addIssue({ code: 'custom', message: 'packageId is required for itemType=package' });
    }
    if (v.itemType === 'upgrade' && !(v.courseId && v.versionId)) {
      ctx.addIssue({ code: 'custom', message: 'courseId + versionId required for itemType=upgrade' });
    }
  });

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1).max(20),
  paymentMethod: z.enum(['QR_PROMPTPAY', 'MANUAL']).default('QR_PROMPTPAY'),
  notes: z.string().max(500).optional(),
});

const orderIdParam = z.object({ id: z.string().uuid() });

const listOrdersQuerySchema = z.object({
  status: z.enum([
    'PENDING', 'AWAITING_PAYMENT', 'AWAITING_APPROVAL',
    'PAID', 'CANCELLED', 'REFUNDED', 'FAILED',
  ]).optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const approveSchema = z.object({
  notes: z.string().max(500).optional(),
});

// Student uploads a payment slip. Accepts a hosted image URL, an inline
// base64/data-URL image, and/or the QR payload read off the slip. `mock` lets
// the dev/mock provider simulate outcomes.
const submitSlipSchema = z
  .object({
    imageUrl: z.string().url().max(2000).optional(),
    imageBase64: z.string().max(8_000_000).optional(), // ~6MB image as data URL
    payload: z.string().max(1000).optional(),
    mock: z
      .object({
        fail: z.boolean().optional(),
        amount: z.number().optional(),
        transRef: z.string().max(120).optional(),
      })
      .optional(),
  })
  .strict();

module.exports = {
  createOrderSchema,
  orderIdParam,
  listOrdersQuerySchema,
  approveSchema,
  submitSlipSchema,
};
