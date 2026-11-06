import { apiRequest } from './client';
import { enrollmentsApi } from './enrollments.api';
import type { Course, Pagination } from '../types/api';

export interface CoursePage {
  courses: Course[];
  pagination: Pagination;
}

export interface CourseInput {
  title: string;
  code: string;
  credits: number;
}

export async function listAllCourses(token: string) {
  const firstPage = await coursesApi.list(1, '', token);
  const courses = [...firstPage.courses];
  for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
    const nextPage = await coursesApi.list(page, '', token);
    courses.push(...nextPage.courses);
  }
  return courses;
}

export async function listEnrolledCourses(token: string) {
  const enrollments = await enrollmentsApi.mine(token);
  const approved = enrollments.filter(
    (enrollment) => enrollment.status === 'approved',
  );
  const courses = await Promise.all(
    approved.map((enrollment) => coursesApi.get(enrollment.courseId, token)),
  );
  return courses.filter((course) => course.approvalStatus === 'approved');
}

export async function listTeachingCourses(token: string) {
  const firstPage = await coursesApi.teaching(1, '', token);
  const courses = [...firstPage.courses];
  for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
    const nextPage = await coursesApi.teaching(page, '', token);
    courses.push(...nextPage.courses);
  }
  return courses;
}

export const coursesApi = {
  list: (page = 1, search = '', token?: string) => {
    const query = new URLSearchParams({ page: String(page), limit: '10' });
    if (search.trim()) query.set('search', search.trim());
    return apiRequest<CoursePage>(`/courses?${query}`, { ...(token ? { token } : {}) });
  },
  teaching: (page = 1, search = '', token: string) => {
    const query = new URLSearchParams({ page: String(page), limit: '10' });
    if (search.trim()) query.set('search', search.trim());
    return apiRequest<CoursePage>(`/courses/teaching?${query}`, { token });
  },
  pendingApproval: (page = 1, search = '', token: string) => {
    const query = new URLSearchParams({ page: String(page), limit: '100' });
    if (search.trim()) query.set('search', search.trim());
    return apiRequest<CoursePage>(`/admin/courses/pending-approval?${query}`, {
      token,
    });
  },
  get: (id: string, token?: string) =>
    apiRequest<Course>(`/courses/${id}`, { ...(token ? { token } : {}) }),
  create: (input: CourseInput, token: string) =>
    apiRequest<Course>('/courses', { method: 'POST', token, body: input }),
  update: (id: string, input: Partial<CourseInput>, token: string) =>
    apiRequest<Course>(`/courses/${id}`, { method: 'PATCH', token, body: input }),
  assignFaculty: (id: string, facultyId: string | null, token: string) =>
    apiRequest<Course>(`/courses/${id}/owner`, {
      method: 'PATCH',
      token,
      body: { facultyId },
    }),
  approve: (id: string, token: string) =>
    apiRequest<Course>(`/admin/courses/${id}/approve`, {
      method: 'POST',
      token,
    }),
  reject: (id: string, reason: string, token: string) =>
    apiRequest<Course>(`/admin/courses/${id}/reject`, {
      method: 'POST',
      token,
      body: { reason },
    }),
  resubmit: (id: string, token: string) =>
    apiRequest<Course>(`/courses/${id}/resubmit`, {
      method: 'POST',
      token,
    }),
  delete: (id: string, token: string) =>
    apiRequest<Course>(`/courses/${id}`, { method: 'DELETE', token }),
};
