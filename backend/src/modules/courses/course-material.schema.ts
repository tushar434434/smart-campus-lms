import { z } from 'zod';

export const courseMaterialTypeSchema = z.enum([
  'notes',
  'pyq',
  'syllabus',
  'lecture_slides',
  'reference',
]);

export const createCourseMaterialSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1000).optional(),
  unitNumber: z.coerce.number().int().min(1).max(30).optional(),
  type: courseMaterialTypeSchema,
});

export type CourseMaterialType = z.infer<typeof courseMaterialTypeSchema>;
export type CreateCourseMaterialInput = z.infer<
  typeof createCourseMaterialSchema
>;
