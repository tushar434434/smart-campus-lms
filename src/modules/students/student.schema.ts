import { z } from 'zod';

export const createStudentSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  enrollmentNumber: z.string().min(5),
  department: z.string().min(2),
  semester: z.number().int().min(1).max(8),
});

export const listStudentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
});

export const updateStudentSchema = z
  .object({
    name: z.string().min(3).optional(),
    email: z.string().email().optional(),
    enrollmentNumber: z.string().min(5).optional(),
    department: z.string().min(2).optional(),
    semester: z.number().int().min(1).max(8).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const linkStudentUserSchema = z.object({
  userId: z.string().uuid(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type ListStudentsInput = z.infer<typeof listStudentsSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type LinkStudentUserInput = z.infer<typeof linkStudentUserSchema>;
