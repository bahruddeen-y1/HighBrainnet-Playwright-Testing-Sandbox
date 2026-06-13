const { z } = require('zod');

const createSchema = z.object({
  userId: z.string().uuid().optional(),
  realName: z.string().min(1).max(120),
  alias: z.string().max(120).optional(),
  schoolName: z.string().min(1).max(200),
  examYear: z.coerce.number().int().min(2000).max(2100),
  examName: z.string().max(200).optional(),
  displayType: z.enum(['REAL_NAME', 'ALIAS']).default('ALIAS'),
  isPublic: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const updateSchema = createSchema.partial();

const listQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  school: z.string().max(200).optional(),
  q: z.string().max(100).optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const idParam = z.object({ id: z.string().uuid() });

module.exports = { createSchema, updateSchema, listQuerySchema, idParam };
