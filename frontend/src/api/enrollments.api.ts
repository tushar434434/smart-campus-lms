import { apiRequest } from './client';
import type { Enrollment } from '../types/api';

export const enrollmentsApi = {
  mine: (token: string) => apiRequest<Enrollment[]>('/enrollments/me', { token }),
  request: (courseId: string, token: string) =>
    apiRequest<Enrollment>(`/courses/${courseId}/enrollment-requests`, {
      method: 'POST',
      token,
    }),
  requests: (token: string, status = 'pending') =>
    apiRequest<Array<Enrollment & {
      student: { id: string; name: string; email: string; enrollmentNumber: string };
      course: { id: string; title: string; code: string };
    }>>(`/enrollments/requests?status=${status}`, { token }),
  approve: (id: string, token: string) =>
    apiRequest<Enrollment>(`/enrollments/${id}/approve`, {
      method: 'POST',
      token,
    }),
  reject: (id: string, reason: string, token: string) =>
    apiRequest<Enrollment>(`/enrollments/${id}/reject`, {
      method: 'POST',
      token,
      body: { reason },
    }),
};