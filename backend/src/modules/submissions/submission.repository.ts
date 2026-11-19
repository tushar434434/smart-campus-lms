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
  file?: {
    mimeType: string;
    size: number;
  };
  submittedAt: string;
  updatedAt: string;
}

export class InMemorySubmissionRepository implements SubmissionRepository {
  private submissions: Submission[] = [];
  private readonly fileKeys = new Map<string, string>();

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

  async delete(id: string): Promise<void> {
    this.submissions = this.submissions.filter((item) => item.id !== id);
    this.fileKeys.delete(id);
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

    if (!submission || submission.status !== 'submitted') return undefined;

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

    if (!submission || submission.status !== 'submitted') return undefined;

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

  async attachFile(
    id: string,
    file: { key: string; mimeType: string; size: number },
  ): Promise<Submission | undefined> {
    const submission = this.submissions.find((item) => item.id === id);
    if (!submission) return undefined;
    this.fileKeys.set(id, file.key);
    submission.file = { mimeType: file.mimeType, size: file.size };
    submission.updatedAt = new Date().toISOString();
    return submission;
  }

  async findStoredFile(
    id: string,
  ): Promise<{ key: string; mimeType: string; size: number } | undefined> {
    const submission = this.submissions.find((item) => item.id === id);
    const key = this.fileKeys.get(id);
    if (!submission?.file || !key) return undefined;
    return { key, ...submission.file };
  }
}
