export type UserRole = 'student' | 'faculty' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  suspendedAt?: string | null;
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
  ownerFacultyId: string | null;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  reviewedAt: string | null;
  reviewedById: string | null;
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
  file?: {
    originalFileName: string;
    mimeType: string;
    size: number;
  };
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
  file?: {
    mimeType: string;
    size: number;
  };
  submittedAt: string;
  updatedAt: string;
}

export interface StudentAssignmentActivity extends Submission {
  assignmentTitle: string;
  courseTitle: string;
  dueAt: string;
  maxMarks: number;
}

export interface AssignmentRosterRow {
  student: Pick<Student, 'id' | 'name' | 'email' | 'enrollmentNumber'>;
  submission: Submission | null;
  status: 'not_submitted' | 'submitted' | 'late' | 'graded';
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  requestedAt: string;
  enrolledAt: string;
  reviewedAt: string | null;
  reviewedById: string | null;
}

export interface CourseMaterial {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  unitNumber: number | null;
  type: 'notes' | 'pyq' | 'syllabus' | 'lecture_slides' | 'reference';
  originalFileName: string;
  fileMimeType: string;
  fileSize: number;
  createdAt: string;
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
  questionType: 'multiple_choice' | 'true_false';
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  marks: number;
  correctOption?: 'A' | 'B' | 'C' | 'D';
  selectedOption?: 'A' | 'B' | 'C' | 'D';
  bookmarked?: boolean;
  imageSlots?: Array<'question' | 'optionA' | 'optionB' | 'optionC' | 'optionD'>;
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

export interface StudentQuizActivity extends QuizAttempt {
  quizTitle: string;
  courseTitle: string;
  attemptNumber: number;
  remainingAttempts: number;
}

export interface QuizRosterRow {
  student: Pick<Student, 'id' | 'name' | 'email' | 'enrollmentNumber'>;
  attemptCount: number;
  remainingAttempts: number;
  status: QuizAttempt['status'] | 'not_attempted';
  latestAttempt: QuizAttempt | null;
  attempts: QuizAttempt[];
}
