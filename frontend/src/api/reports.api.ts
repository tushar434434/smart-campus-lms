import { apiDownload } from './client';

export const reportsApi = {
  assignment: (id: string, token: string) =>
    apiDownload(`/reports/assignments/${id}.pdf`, token),
  quiz: (id: string, token: string) =>
    apiDownload(`/reports/quizzes/${id}.pdf`, token),
};

export function savePdf(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
