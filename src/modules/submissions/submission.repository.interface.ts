import type { Submission } from './submission.repository.js';

export type { Submission };

export type SubmissionStatus = 'submitted' | 'graded';

export interface SubmissionRepository {
  create(
    input: Pick<Submission, 'studentId' | 'assignmentId' | 'content'>,
  ): Promise<Submission>;

  findById(id: string): Promise<Submission | undefined>;

  findByStudentId(studentId: string): Promise<Submission[]>;

  findByAssignmentId(assignmentId: string): Promise<Submission[]>;

  findByStudentAndAssignment(
    studentId: string,
    assignmentId: string,
  ): Promise<Submission | undefined>;

  updateContent(id: string, content: string): Promise<Submission | undefined>;

  grade(
    id: string,
    marks: number,
    feedback?: string,
  ): Promise<Submission | undefined>;
}