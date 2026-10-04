import { z } from 'zod';

export const createSubmissionSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),

  assignmentId: z.string().uuid('Invalid assignment ID'),

  content: z
    .string()
    .trim()
    .min(10, 'Submission content must be at least 10 characters'),
});

export const updateSubmissionSchema = z.object({
  content: z
    .string()
    .trim()
    .min(10, 'Submission content must be at least 10 characters'),
});

export const gradeSubmissionSchema = z.object({
  marks: z.number().min(0, 'Marks cannot be negative'),

  feedback: z
    .string()
    .trim()
    .max(1000, 'Feedback cannot exceed 1000 characters')
    .optional(),
});

export type CreateSubmissionInput = z.infer<
  typeof createSubmissionSchema
>;

export type UpdateSubmissionInput = z.infer<
  typeof updateSubmissionSchema
>;

export type GradeSubmissionInput = z.infer<
  typeof gradeSubmissionSchema
>;
