const { z } = require('zod');

const watchProgressSchema = z.object({
  positionSeconds: z.coerce.number().int().min(0).max(36_000),
});

const lessonIdParam = z.object({ id: z.string().uuid() });

module.exports = { watchProgressSchema, lessonIdParam };
