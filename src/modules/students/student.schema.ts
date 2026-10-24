import { z } from 'zod';

export const createStudentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z.string().trim().email('Invalid email address'),
  enrollmentNumber: z
    .string()
    .trim()
    .min(5, 'Enrollment number must be at least 5 characters')
    .max(30, 'Enrollment number cannot exceed 30 characters'),
  department: z
    .string()
    .trim()
    .min(2, 'Department must be at least 2 characters')
    .max(100, 'Department cannot exceed 100 characters'),
  semester: z
    .number()
    .int('Semester must be an integer')
    .min(1, 'Semester must be at least 1')
    .max(8, 'Semester cannot exceed 8'),
});

export const listStudentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
});

export const updateStudentSchema = createStudentSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const linkStudentUserSchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID'),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type ListStudentsInput = z.infer<typeof listStudentsSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type LinkStudentUserInput = z.infer<typeof linkStudentUserSchema>;
