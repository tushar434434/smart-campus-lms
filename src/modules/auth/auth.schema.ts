import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(3, 'Name must be at least 3 characters'),

  email: z.string().trim().email('Invalid email address'),

  password: z.string().min(8, 'Password must be at least 8 characters'),

  role: z.enum(['student', 'faculty']).default('student'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),

  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type UserRole = 'student' | 'faculty' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}
