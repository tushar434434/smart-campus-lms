import { apiDownload, apiRequest } from './client';
import type { CourseMaterial } from '../types/api';

export type CourseMaterialInput = {
  title: string;
  description?: string;
  unitNumber?: number;
  type: CourseMaterial['type'];
};

export const courseMaterialsApi = {
  list: (courseId: string, token: string) =>
    apiRequest<CourseMaterial[]>(`/courses/${courseId}/materials`, { token }),
  upload: (
    courseId: string,
    input: CourseMaterialInput,
    file: File,
    token: string,
  ) => {
    const query = new URLSearchParams({ title: input.title, type: input.type });
    if (input.description) query.set('description', input.description);
    if (input.unitNumber) query.set('unitNumber', String(input.unitNumber));
    const body = new FormData();
    body.append('file', file);
    return apiRequest<CourseMaterial>(
      `/courses/${courseId}/materials?${query}`,
      { method: 'POST', token, body },
    );
  },
  view: (id: string, token: string) =>
    apiDownload(`/course-materials/${id}/file`, token),
  download: (id: string, token: string) =>
    apiDownload(`/course-materials/${id}/file?download=true`, token),
  remove: (id: string, token: string) =>
    apiRequest<void>(`/course-materials/${id}`, {
      method: 'DELETE',
      token,
    }),
};