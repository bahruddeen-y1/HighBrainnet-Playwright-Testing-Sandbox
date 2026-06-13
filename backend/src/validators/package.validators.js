const { z } = require('zod');

const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const createPackageSchema = z.object({
  slug: z.string().min(2).max(80).regex(slugRegex).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  discountPrice: z.coerce.number().nonnegative().max(1_000_000),
  coverImageUrl: z.string().url().optional(),
  courseIds: z.array(z.string().uuid()).min(1).max(50),
});

const updatePackageSchema = z.object({
  slug: z.string().min(2).max(80).regex(slugRegex).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  discountPrice: z.coerce.number().nonnegative().max(1_000_000).optional(),
  coverImageUrl: z.string().url().nullable().optional(),
});

const setCoursesSchema = z.object({
  courseIds: z.array(z.string().uuid()).min(1).max(50),
});

const idParamSchema = z.object({ id: z.string().uuid() });
const slugParamSchema = z.object({ slug: z.string().min(1).max(120) });
const listQuerySchema = z.object({
  q: z.string().max(100).optional(),
  includeDeleted: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

module.exports = {
  createPackageSchema,
  updatePackageSchema,
  setCoursesSchema,
  idParamSchema,
  slugParamSchema,
  listQuerySchema,
};
