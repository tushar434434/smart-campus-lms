import { randomUUID } from 'node:crypto';

import type { SubmissionRepository } from './submission.repository.interface.js';

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

export class InMemorySubmissionRepository implements SubmissionRepository {
  private submissions: Submission[] = [];

  async create(
    input: Pick<Submission, 'studentId' | 'assignmentId' | 'content'>,
  ): Promise<Submission> {
    const now = new Date().toISOString();

    const submission: Submission = {
      id: randomUUID(),
      ...input,
      status: 'submitted',
      submittedAt: now,
      updatedAt: now,
    };

    this.submissions.push(submission);

    return submission;
  }

  async findById(id: string): Promise<Submission | undefined> {
    return this.submissions.find((submission) => submission.id === id);
  }

  async findByStudentId(studentId: string): Promise<Submission[]> {
    return this.submissions.filter(
      (submission) => submission.studentId === studentId,
    );
  }

  async findByAssignmentId(assignmentId: string): Promise<Submission[]> {
    return this.submissions.filter(
      (submission) => submission.assignmentId === assignmentId,
    );
  }

  async findByStudentAndAssignment(
    studentId: string,
    assignmentId: string,
  ): Promise<Submission | undefined> {
    return this.submissions.find(
      (submission) =>
        submission.studentId === studentId &&
        submission.assignmentId === assignmentId,
    );
  }

  async updateContent(
    id: string,
    content: string,
  ): Promise<Submission | undefined> {
    const submission = this.submissions.find(
      (submission) => submission.id === id,
    );

    if (!submission) return undefined;

    submission.content = content;
    submission.status = 'submitted';
    submission.updatedAt = new Date().toISOString();

    delete submission.marks;
    delete submission.feedback;

    return submission;
  }

  async grade(
    id: string,
    marks: number,
    feedback?: string,
  ): Promise<Submission | undefined> {
    const submission = this.submissions.find(
      (submission) => submission.id === id,
    );

    if (!submission) return undefined;

    submission.marks = marks;

    if (feedback !== undefined) {
      submission.feedback = feedback;
    } else {
      delete submission.feedback;
    }

    submission.status = 'graded';
    submission.updatedAt = new Date().toISOString();

    return submission;
  }
}