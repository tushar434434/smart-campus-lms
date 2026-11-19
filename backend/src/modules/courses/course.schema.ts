import { z } from 'zod';

export const createCourseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must not exceed 100 characters'),

  code: z
    .string()
    .trim()
    .regex(/^[A-Z]{2,5}[0-9]{3,4}$/, 'Invalid course code'),

  credits: z
    .number()
    .int('Credits must be an integer')
    .min(1, 'Credits must be at least 1')
    .max(6, 'Credits must not exceed 6'),
});

export const updateCourseSchema = createCourseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const listCoursesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  credits: z.coerce.number().int().min(1).max(6).optional(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type ListCoursesInput = z.infer<typeof listCoursesSchema>;
