export type UserRole = 'student' | 'faculty' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Course {
  id: string;
  title: string;
  code: string;
  credits: number;
  createdAt: string;
}

export interface Student {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  enrollmentNumber: string;
  department: string;
  semester: number;
  createdAt: string;
}

export interface StudentAccount {
  id: string;
  name: string;
  email: string;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueAt: string;
  maxMarks: number;
  createdAt: string;
}

export interface Submission {
  id: string;
  studentId: string;
  assignmentId: string;
  content: string;
  status: 'submitted' | 'graded';
  marks?: number;
  feedback?: string;
  submittedAt: string;
  updatedAt: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  enrolledAt: string;
}

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  description: string;
  durationMinutes: number;
  maxMarks: number;
  maxAttempts: number;
  status: 'draft' | 'published' | 'closed';
  startsAt: string | null;
  endsAt: string | null;
  resultsReleasedAt: string | null;
  showMarks: boolean;
  showCorrectAnswers: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  marks: number;
  correctOption?: 'A' | 'B' | 'C' | 'D';
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  startedAt: string;
  submittedAt: string | null;
  status: 'in_progress' | 'submitted' | 'auto_submitted' | 'flagged';
  score: number | null;
  tabSwitchCount: number;
  fullscreenExitCount: number;
  suspiciousActivity: boolean;
}
