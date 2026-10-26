import { apiRequest } from './client';
import type { Submission } from '../types/api';

export const submissionsApi = {
  listByAssignment: (assignmentId: string, token: string) =>
    apiRequest<Submission[]>(`/submissions/assignment/${assignmentId}`, { token }),
  listByStudent: (studentId: string, token: string) =>
    apiRequest<Submission[]>(`/submissions/student/${studentId}`, { token }),
  create: (studentId: string, assignmentId: string, content: string, token: string) =>
    apiRequest<Submission>('/submissions', {
      method: 'POST',
      token,
      body: { studentId, assignmentId, content },
    }),
  update: (id: string, content: string, token: string) =>
    apiRequest<Submission>(`/submissions/${id}`, {
      method: 'PATCH',
      token,
      body: { content },
    }),
  grade: (id: string, marks: number, feedback: string, token: string) =>
    apiRequest<Submission>(`/submissions/${id}/grade`, {
      method: 'PATCH',
      token,
      body: { marks, ...(feedback ? { feedback } : {}) },
    }),
};
