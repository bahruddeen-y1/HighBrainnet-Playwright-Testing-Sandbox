const { z } = require('zod');

const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const createCourseSchema = z.object({
  levelId: z.string().uuid(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(255).optional(),
  description: z.string().max(5000).optional(),
  slug: z.string().min(2).max(80).regex(slugRegex, 'slug ต้องเป็น a-z, 0-9, dash').optional(),
  coverImageUrl: z.string().url().optional(),
  price: z.coerce.number().nonnegative().max(1_000_000),
  isVisible: z.boolean().optional(),
  initialVersionLabel: z.string().max(20).default('v1.0'),
});

const updateCourseSchema = z.object({
  levelId: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(255).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  slug: z.string().min(2).max(80).regex(slugRegex).optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  price: z.coerce.number().nonnegative().max(1_000_000).optional(),
  isVisible: z.boolean().optional(),
});

const listCoursesQuerySchema = z.object({
  level: z.string().uuid().optional(),
  levelKey: z.enum(['PRIMARY', 'JUNIOR', 'SENIOR']).optional(),
  q: z.string().max(100).optional(),
  includeHidden: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const slugParamSchema = z.object({
  slug: z.string().min(1).max(120),
});

module.exports = {
  createCourseSchema,
  updateCourseSchema,
  listCoursesQuerySchema,
  idParamSchema,
  slugParamSchema,
};
