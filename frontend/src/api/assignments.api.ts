import { apiRequest } from './client';
import type { Assignment } from '../types/api';

export interface AssignmentInput {
  courseId: string;
  title: string;
  description: string;
  dueAt: string;
  maxMarks: number;
}

export interface AssignmentUpdate {
  title?: string;
  description?: string;
  dueAt?: string;
  maxMarks?: number;
}

export const assignmentsApi = {
  listByCourse: (courseId: string, token: string) =>
    apiRequest<Assignment[]>(`/assignments/course/${courseId}`, { token }),
  get: (id: string, token: string) =>
    apiRequest<Assignment>(`/assignments/${id}`, { token }),
  create: (input: AssignmentInput, token: string) =>
    apiRequest<Assignment>('/assignments', { method: 'POST', token, body: input }),
  update: (id: string, input: AssignmentUpdate, token: string) =>
    apiRequest<Assignment>(`/assignments/${id}`, { method: 'PATCH', token, body: input }),
  delete: (id: string, token: string) =>
    apiRequest<void>(`/assignments/${id}`, { method: 'DELETE', token }),
};
