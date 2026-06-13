const { z } = require('zod');

const dateRangeQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  courseId: z.string().uuid().optional(),
  levelId: z.string().uuid().optional(),
});

const quizScoresQuery = z.object({
  courseId: z.string().uuid().optional(),
  quizId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const creditsQuery = z.object({
  year: z.coerce.number().int().optional(),
});

module.exports = { dateRangeQuery, quizScoresQuery, creditsQuery };
