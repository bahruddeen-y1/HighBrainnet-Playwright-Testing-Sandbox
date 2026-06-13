const { z } = require('zod');

const createLessonSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
  bunnyVideoId: z.string().max(120).optional(),
  videoDuration: z.coerce.number().int().min(0).optional(),
  videoStatus: z.enum(['uploading', 'ready', 'failed']).optional(),
});

const updateLessonSchema = createLessonSchema.partial();

const chapterIdParam = z.object({ chapterId: z.string().uuid() });
const lessonIdParam = z.object({ id: z.string().uuid() });

module.exports = {
  createLessonSchema,
  updateLessonSchema,
  chapterIdParam,
  lessonIdParam,
};
