import { apiRequest } from './client';
import type { Quiz, QuizAttempt, QuizQuestion } from '../types/api';

export interface QuizInput {
  courseId: string;
  title: string;
  description: string;
  durationMinutes: number;
  maxMarks: number;
  maxAttempts: number;
  startsAt?: string;
  endsAt?: string;
}

export interface QuestionInput {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  marks: number;
}

export interface QuizUpdate {
  title?: string;
  description?: string;
  durationMinutes?: number;
  maxMarks?: number;
  maxAttempts?: number;
  startsAt?: string | null;
  endsAt?: string | null;
}

export const quizzesApi = {
  listByCourse: (courseId: string, token: string) =>
    apiRequest<Quiz[]>(`/courses/${courseId}/quizzes`, { token }),
  get: (id: string, token: string) => apiRequest<Quiz>(`/quizzes/${id}`, { token }),
  questions: (id: string, token: string) =>
    apiRequest<QuizQuestion[]>(`/quizzes/${id}/questions`, { token }),
  create: (input: QuizInput, token: string) =>
    apiRequest<Quiz>('/quizzes', { method: 'POST', token, body: input }),
  update: (id: string, input: QuizUpdate, token: string) =>
    apiRequest<Quiz>(`/quizzes/${id}`, { method: 'PATCH', token, body: input }),
  createQuestion: (id: string, input: QuestionInput, token: string) =>
    apiRequest<QuizQuestion>(`/quizzes/${id}/questions`, { method: 'POST', token, body: input }),
  updateQuestion: (id: string, questionId: string, input: Partial<QuestionInput>, token: string) =>
    apiRequest<QuizQuestion>(`/quizzes/${id}/questions/${questionId}`, { method: 'PATCH', token, body: input }),
  deleteQuestion: (id: string, questionId: string, token: string) =>
    apiRequest<{ message: string }>(`/quizzes/${id}/questions/${questionId}`, { method: 'DELETE', token }),
  publish: (id: string, token: string) =>
    apiRequest<Quiz>(`/quizzes/${id}/publish`, { method: 'POST', token }),
  release: (id: string, showMarks: boolean, showCorrectAnswers: boolean, token: string) =>
    apiRequest<Quiz>(`/quizzes/${id}/release-results`, {
      method: 'POST',
      token,
      body: { showMarks, showCorrectAnswers },
    }),
  delete: (id: string, token: string) =>
    apiRequest<void>(`/quizzes/${id}`, { method: 'DELETE', token }),
  startAttempt: (id: string, token: string) =>
    apiRequest<QuizAttempt>(`/quizzes/${id}/attempts`, { method: 'POST', token }),
  attemptQuestions: (attemptId: string, token: string) =>
    apiRequest<QuizQuestion[]>(`/attempts/${attemptId}/questions`, { token }),
  saveAnswer: (attemptId: string, questionId: string, selectedOption: 'A' | 'B' | 'C' | 'D', token: string) =>
    apiRequest<void>(`/attempts/${attemptId}/answers/${questionId}`, {
      method: 'PUT',
      token,
      body: { selectedOption },
    }),
  submitAttempt: (attemptId: string, token: string) =>
    apiRequest<QuizAttempt>(`/attempts/${attemptId}/submit`, { method: 'POST', token }),
};
