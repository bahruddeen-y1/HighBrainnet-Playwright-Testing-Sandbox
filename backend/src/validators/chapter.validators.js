const { z } = require('zod');

const createChapterSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
});

const updateChapterSchema = createChapterSchema.partial();

const reorderSchema = z.object({
  items: z
    .array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0) }))
    .min(1),
});

const courseIdParam = z.object({ courseId: z.string().uuid() });
const chapterIdParam = z.object({ id: z.string().uuid() });

module.exports = {
  createChapterSchema,
  updateChapterSchema,
  reorderSchema,
  courseIdParam,
  chapterIdParam,
};
