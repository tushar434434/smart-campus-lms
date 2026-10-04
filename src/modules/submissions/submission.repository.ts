import { randomUUID } from 'node:crypto';

import type {
  Submission,
  SubmissionRepository,
} from './submission.repository.interface.js';

export class InMemorySubmissionRepository implements SubmissionRepository {
  private submissions: Submission[] = [];

  create(
    input: Pick<Submission, 'studentId' | 'assignmentId' | 'content'>,
  ): Submission {
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

  findById(id: string): Submission | undefined {
    return this.submissions.find((submission) => submission.id === id);
  }

  findByStudentId(studentId: string): Submission[] {
    return this.submissions.filter(
      (submission) => submission.studentId === studentId,
    );
  }

  findByAssignmentId(assignmentId: string): Submission[] {
    return this.submissions.filter(
      (submission) => submission.assignmentId === assignmentId,
    );
  }

  findByStudentAndAssignment(
    studentId: string,
    assignmentId: string,
  ): Submission | undefined {
    return this.submissions.find(
      (submission) =>
        submission.studentId === studentId &&
        submission.assignmentId === assignmentId,
    );
  }

  updateContent(id: string, content: string): Submission | undefined {
    const submission = this.findById(id);

    if (!submission) {
      return undefined;
    }

    submission.content = content;
    submission.status = 'submitted';
    submission.updatedAt = new Date().toISOString();

    delete submission.marks;
    delete submission.feedback;

    return submission;
  }

  grade(id: string, marks: number, feedback?: string): Submission | undefined {
    const submission = this.findById(id);

    if (!submission) {
      return undefined;
    }

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
