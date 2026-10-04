import { z } from 'zod';

export const createStudentSchema = z.object({
  name: z.string().trim().min(3, 'Name must be at least 3 characters'),

  email: z.string().trim().email('Invalid email address'),

  enrollmentNumber: z
    .string()
    .trim()
    .min(5, 'Enrollment number must be at least 5 characters'),

  department: z
    .string()
    .trim()
    .min(2, 'Department must be at least 2 characters'),

  semester: z.number().int().min(1).max(8),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export const listStudentsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().optional(),
});
export const updateStudentSchema = createStudentSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export type ListStudentsInput = z.infer<typeof listStudentsSchema>;
