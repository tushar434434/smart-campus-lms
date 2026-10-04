export type SubmissionStatus = 'submitted' | 'graded';

export interface Submission {
  id: string;
  studentId: string;
  assignmentId: string;
  content: string;
  status: SubmissionStatus;
  marks?: number;
  feedback?: string;
  submittedAt: string;
  updatedAt: string;
}

export interface SubmissionRepository {
  create(
    input: Pick<Submission, 'studentId' | 'assignmentId' | 'content'>,
  ): Submission;

  findById(id: string): Submission | undefined;

  findByStudentId(studentId: string): Submission[];

  findByAssignmentId(assignmentId: string): Submission[];

  findByStudentAndAssignment(
    studentId: string,
    assignmentId: string,
  ): Submission | undefined;

  updateContent(
    id: string,
    content: string,
  ): Submission | undefined;

  grade(
    id: string,
    marks: number,
    feedback?: string,
  ): Submission | undefined;
}
