import { z } from 'zod';

export const createAssignmentSchema = z.object({
  courseId: z.string().uuid('Invalid course ID'),

  title: z.string().trim().min(3, 'Title must be at least 3 characters'),

  description: z
    .string()
    .trim()
    .min(5, 'Description must be at least 5 characters'),

  dueAt: z.iso.datetime(),

  maxMarks: z.number().positive('Maximum marks must be positive'),
});

export const updateAssignmentSchema = createAssignmentSchema
  .omit({ courseId: true })
  .partial();

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
