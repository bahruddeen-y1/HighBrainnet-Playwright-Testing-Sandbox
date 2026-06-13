const { z } = require('zod');

const createQuizSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  isMockExam: z.boolean().default(false),
  hasTimer: z.boolean().default(false),
  timeLimitMinutes: z.coerce.number().int().min(1).max(600).optional(),
  passScore: z.coerce.number().int().min(0).max(100).optional(),
  isPreLesson: z.boolean().default(false),
}).superRefine((v, ctx) => {
  if (v.hasTimer && !v.timeLimitMinutes) {
    ctx.addIssue({ code: 'custom', message: 'hasTimer ต้องระบุ timeLimitMinutes' });
  }
});

const updateQuizSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  isMockExam: z.boolean().optional(),
  hasTimer: z.boolean().optional(),
  timeLimitMinutes: z.coerce.number().int().min(1).max(600).nullable().optional(),
  passScore: z.coerce.number().int().min(0).max(100).nullable().optional(),
  isPreLesson: z.boolean().optional(),
});

const optionSchema = z.object({
  key: z.string().min(1).max(10),     // "A", "B", ...
  text: z.string().min(1).max(1000),
});

const createQuestionSchema = z.object({
  type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER']).default('MULTIPLE_CHOICE'),
  prompt: z.string().min(1).max(5000),
  options: z.array(optionSchema).min(2).max(8).optional(),
  correctAnswer: z.union([z.string(), z.boolean()]),
  explanation: z.string().max(5000).optional(),
  points: z.coerce.number().int().min(1).max(100).default(1),
  sortOrder: z.coerce.number().int().min(0).optional(),
}).superRefine((v, ctx) => {
  if (v.type === 'MULTIPLE_CHOICE') {
    if (!v.options?.length) {
      ctx.addIssue({ code: 'custom', message: 'MULTIPLE_CHOICE ต้องมี options' });
    } else if (!v.options.some((o) => o.key === v.correctAnswer)) {
      ctx.addIssue({ code: 'custom', message: 'correctAnswer ต้องเป็น key ที่อยู่ใน options' });
    }
  }
  if (v.type === 'TRUE_FALSE' && typeof v.correctAnswer !== 'boolean') {
    ctx.addIssue({ code: 'custom', message: 'TRUE_FALSE correctAnswer ต้องเป็น boolean' });
  }
  if (v.type === 'SHORT_ANSWER' && typeof v.correctAnswer !== 'string') {
    ctx.addIssue({ code: 'custom', message: 'SHORT_ANSWER correctAnswer ต้องเป็น string' });
  }
});

const updateQuestionSchema = z.object({
  prompt: z.string().min(1).max(5000).optional(),
  options: z.array(optionSchema).min(2).max(8).optional(),
  correctAnswer: z.union([z.string(), z.boolean()]).optional(),
  explanation: z.string().max(5000).nullable().optional(),
  points: z.coerce.number().int().min(1).max(100).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const submitSchema = z.object({
  attemptId: z.string().uuid(),
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    answer: z.union([z.string(), z.boolean()]).nullable(),
  })).max(200),
});

const idParam = z.object({ id: z.string().uuid() });
const lessonIdParam = z.object({ lessonId: z.string().uuid() });
const courseIdParam = z.object({ courseId: z.string().uuid() });
const reorderSchema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0) })).min(1),
});

module.exports = {
  createQuizSchema, updateQuizSchema,
  createQuestionSchema, updateQuestionSchema,
  submitSchema, reorderSchema,
  idParam, lessonIdParam, courseIdParam,
};
