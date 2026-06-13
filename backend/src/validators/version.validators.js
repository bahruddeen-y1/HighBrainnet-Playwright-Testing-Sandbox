const { z } = require('zod');

const createVersionSchema = z.object({
  versionLabel: z.string().min(1).max(20),
  releaseNotes: z.string().max(5000).optional(),
  upgradePrice: z.coerce.number().nonnegative().max(1_000_000).default(0),
  publish: z.boolean().default(false),
});

const updateVersionSchema = z.object({
  releaseNotes: z.string().max(5000).nullable().optional(),
  upgradePrice: z.coerce.number().nonnegative().max(1_000_000).optional(),
});

const versionIdParam = z.object({ id: z.string().uuid() });
const courseIdParam  = z.object({ courseId: z.string().uuid() });

module.exports = {
  createVersionSchema,
  updateVersionSchema,
  versionIdParam,
  courseIdParam,
};
