import { apiRequest } from './client';
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

export const coursesApi = {
  list: (page = 1, search = '', token?: string) => {
    const query = new URLSearchParams({ page: String(page), limit: '10' });
    if (search.trim()) query.set('search', search.trim());
    return apiRequest<CoursePage>(`/courses?${query}`, { ...(token ? { token } : {}) });
  },
  get: (id: string, token?: string) =>
    apiRequest<Course>(`/courses/${id}`, { ...(token ? { token } : {}) }),
  create: (input: CourseInput, token: string) =>
    apiRequest<Course>('/courses', { method: 'POST', token, body: input }),
  update: (id: string, input: Partial<CourseInput>, token: string) =>
    apiRequest<Course>(`/courses/${id}`, { method: 'PATCH', token, body: input }),
  delete: (id: string, token: string) =>
    apiRequest<Course>(`/courses/${id}`, { method: 'DELETE', token }),
};
