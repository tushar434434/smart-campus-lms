import { apiDownload, apiRequest } from './client';
import type {
  AssignmentRosterRow,
  StudentAssignmentActivity,
  Submission,
} from '../types/api';

export const submissionsApi = {
  myActivity: (token: string) =>
    apiRequest<StudentAssignmentActivity[]>('/submissions/me', { token }),
  uploadFile: (submissionId: string, file: File, token: string) => {
    const form = new FormData();
    form.append('file', file);
    return apiRequest<Submission>(`/submissions/${submissionId}/file`, {
      method: 'PUT',
      token,
      body: form,
    });
  },
  viewFile: (submissionId: string, token: string) =>
    apiDownload(`/submissions/${submissionId}/file`, token),
  downloadFile: (submissionId: string, token: string) =>
    apiDownload(`/submissions/${submissionId}/file?download=true`, token),
  listByAssignment: (assignmentId: string, token: string) =>
    apiRequest<Submission[]>(`/submissions/assignment/${assignmentId}`, { token }),
  listRosterByAssignment: (assignmentId: string, token: string) =>
    apiRequest<AssignmentRosterRow[]>(
      `/submissions/assignment/${assignmentId}/roster`,
      { token },
    ),
  listByStudent: (studentId: string, token: string) =>
    apiRequest<Submission[]>(`/submissions/student/${studentId}`, { token }),
  create: (studentId: string, assignmentId: string, content: string, token: string) =>
    apiRequest<Submission>('/submissions', {
      method: 'POST',
      token,
      body: { studentId, assignmentId, content },
    }),
  createWithFile: (assignmentId: string, file: File, content: string, token: string) => {
    const body = new FormData();
    body.append('file', file);
    if (content.trim()) body.append('content', content.trim());
    return apiRequest<Submission>(`/submissions/file?assignmentId=${encodeURIComponent(assignmentId)}`, {
      method: 'POST',
      token,
      body,
    });
  },
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
