import { z } from 'zod';

export const createQuizSchema = z
  .object({
    courseId: z.string().uuid('Invalid course ID'),
    title: z.string().trim().min(3, 'Title must be at least 3 characters'),
    description: z
      .string()
      .trim()
      .min(5, 'Description must be at least 5 characters'),
    durationMinutes: z.number().int().positive('Duration must be positive'),
    maxMarks: z.number().positive('Maximum marks must be positive'),
    maxAttempts: z.number().int().positive().default(1),
    startsAt: z.iso.datetime().optional(),
    endsAt: z.iso.datetime().optional(),
  })
  .refine(
    (quiz) =>
      !quiz.startsAt ||
      !quiz.endsAt ||
      new Date(quiz.startsAt) < new Date(quiz.endsAt),
    {
      message: 'Quiz end time must be after start time',
      path: ['endsAt'],
    },
  );

export const updateQuizSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .min(5, 'Description must be at least 5 characters')
      .optional(),
    durationMinutes: z.number().int().positive().optional(),
    maxMarks: z.number().positive().optional(),
    maxAttempts: z.number().int().positive().optional(),
    startsAt: z.iso.datetime().nullable().optional(),
    endsAt: z.iso.datetime().nullable().optional(),
    showMarks: z.boolean().optional(),
    showCorrectAnswers: z.boolean().optional(),
  })
  .refine(
    (quiz) =>
      !quiz.startsAt ||
      !quiz.endsAt ||
      new Date(quiz.startsAt) < new Date(quiz.endsAt),
    {
      message: 'Quiz end time must be after start time',
      path: ['endsAt'],
    },
  );

export const releaseQuizResultsSchema = z
  .object({
    showMarks: z.boolean(),
    showCorrectAnswers: z.boolean(),
  })
  .strict();

export const createQuizQuestionSchema = z
  .object({
    questionText: z
      .string()
      .trim()
      .min(5, 'Question must be at least 5 characters'),
    optionA: z.string().trim().min(1, 'Option A is required'),
    optionB: z.string().trim().min(1, 'Option B is required'),
    optionC: z.string().trim().min(1, 'Option C is required'),
    optionD: z.string().trim().min(1, 'Option D is required'),
    correctOption: z.enum(['A', 'B', 'C', 'D']),
    marks: z.number().positive().default(1),
  })
  .strict();

export const updateQuizQuestionSchema = createQuizQuestionSchema
  .partial()
  .strict()
  .refine((question) => Object.keys(question).length > 0, {
    message: 'At least one question field must be provided',
  });

export const submitQuizAnswerSchema = z
  .object({
    questionId: z.string().uuid('Invalid question ID'),
    selectedOption: z.enum(['A', 'B', 'C', 'D']),
  })
  .strict();

export const recordProctoringEventSchema = z
  .object({
    type: z.enum([
      'tab_switch',
      'fullscreen_exit',
      'fullscreen_enter',
      'visibility_hidden',
      'visibility_visible',
      'quiz_started',
      'quiz_submitted',
      'time_expired',
    ]),
    occurredAt: z.iso.datetime().optional(),
    metadata: z.string().max(1000).optional(),
  })
  .strict();

export type CreateQuizInput = z.infer<typeof createQuizSchema>;
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;
export type ReleaseQuizResultsInput = z.infer<typeof releaseQuizResultsSchema>;
export type CreateQuizQuestionInput = z.infer<typeof createQuizQuestionSchema>;
export type UpdateQuizQuestionInput = z.infer<typeof updateQuizQuestionSchema>;
export type SubmitQuizAnswerInput = z.infer<typeof submitQuizAnswerSchema>;
export type RecordProctoringEventInput = z.infer<
  typeof recordProctoringEventSchema
>;
