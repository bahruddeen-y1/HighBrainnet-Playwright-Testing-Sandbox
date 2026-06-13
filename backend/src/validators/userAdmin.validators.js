const { z } = require('zod');

const listQuerySchema = z.object({
  q: z.string().max(100).optional(),
  role: z.enum(['STUDENT', 'ADMIN']).optional(),
  includeSuspended: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const idParam = z.object({ id: z.string().uuid() });

module.exports = { listQuerySchema, idParam };
