const { z } = require('zod');

const adminCreateSchema = z.object({
  userId: z.string().uuid(),
  courseId: z.string().uuid(),
  versionId: z.string().uuid().optional(),
  isLifetime: z.boolean().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});

const adminUpdateSchema = z.object({
  isLifetime: z.boolean().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});

const adminListQuery = z.object({
  userId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const idParam = z.object({ id: z.string().uuid() });

module.exports = {
  adminCreateSchema, adminUpdateSchema, adminListQuery, idParam,
};
