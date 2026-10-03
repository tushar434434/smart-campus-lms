import { z } from 'zod';

export const createCourseSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters'),

  code: z
    .string()
    .trim()
    .regex(/^[A-Z]{2,5}[0-9]{3,4}$/, 'Invalid course code'),

  credits: z.number().int().min(1).max(6),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
