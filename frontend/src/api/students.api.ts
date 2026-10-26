import { apiRequest } from './client';
import type { Enrollment, Pagination, Student } from '../types/api';

export interface StudentPage {
  students: Student[];
  pagination: Pagination;
}

export interface StudentInput {
  name: string;
  email: string;
  enrollmentNumber: string;
  department: string;
  semester: number;
}

export const studentsApi = {
  list: (page: number, search: string, token: string) => {
    const query = new URLSearchParams({ page: String(page), limit: '10' });
    if (search.trim()) query.set('search', search.trim());
    return apiRequest<StudentPage>(`/students?${query}`, { token });
  },
  get: (id: string, token: string) => apiRequest<Student>(`/students/${id}`, { token }),
  create: (input: StudentInput, token: string) =>
    apiRequest<Student>('/students', { method: 'POST', token, body: input }),
  update: (id: string, input: Partial<StudentInput>, token: string) =>
    apiRequest<Student>(`/students/${id}`, { method: 'PATCH', token, body: input }),
  delete: (id: string, token: string) =>
    apiRequest<void>(`/students/${id}`, { method: 'DELETE', token }),
  enrollments: (studentId: string, token: string) =>
    apiRequest<Enrollment[]>(`/enrollments/student/${studentId}`, { token }),
  enroll: (studentId: string, courseId: string, token: string) =>
    apiRequest<Enrollment>('/enrollments', {
      method: 'POST',
      token,
      body: { studentId, courseId },
    }),
  removeEnrollment: (id: string, token: string) =>
    apiRequest<void>(`/enrollments/${id}`, { method: 'DELETE', token }),
  linkUser: (studentId: string, userId: string, token: string) =>
    apiRequest<Student>(`/students/${studentId}/link-user`, {
      method: 'PATCH',
      token,
      body: { userId },
    }),
};
