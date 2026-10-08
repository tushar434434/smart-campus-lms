import { PrismaClient } from '../../generated/prisma/client.js';
import type { Submission } from './submission.repository.js';
import type { SubmissionRepository } from './submission.repository.interface.js';

export class PrismaSubmissionRepository implements SubmissionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    input: Pick<Submission, 'studentId' | 'assignmentId' | 'content'>,
  ): Promise<Submission> {
    const submission = await this.prisma.submission.create({
      data: {
        studentId: input.studentId,
        assignmentId: input.assignmentId,
        content: input.content,
      },
    });

    return this.toSubmission(submission);
  }

  async findById(id: string): Promise<Submission | undefined> {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
    });

    if (!submission) return undefined;

    return this.toSubmission(submission);
  }

  async findByStudentId(studentId: string): Promise<Submission[]> {
    const submissions = await this.prisma.submission.findMany({
      where: { studentId },
      orderBy: { submittedAt: 'desc' },
    });

    return submissions.map((submission) =>
      this.toSubmission(submission),
    );
  }

  async findByAssignmentId(assignmentId: string): Promise<Submission[]> {
    const submissions = await this.prisma.submission.findMany({
      where: { assignmentId },
      orderBy: { submittedAt: 'desc' },
    });

    return submissions.map((submission) =>
      this.toSubmission(submission),
    );
  }

  async findByStudentAndAssignment(
    studentId: string,
    assignmentId: string,
  ): Promise<Submission | undefined> {
    const submission = await this.prisma.submission.findUnique({
      where: {
        studentId_assignmentId: {
          studentId,
          assignmentId,
        },
      },
    });

    if (!submission) return undefined;

    return this.toSubmission(submission);
  }

  async updateContent(
    id: string,
    content: string,
  ): Promise<Submission | undefined> {
    try {
      const submission = await this.prisma.submission.update({
        where: { id },
        data: {
          content,
          status: 'submitted',
          marks: null,
          feedback: null,
        },
      });

      return this.toSubmission(submission);
    } catch {
      return undefined;
    }
  }

  async grade(
    id: string,
    marks: number,
    feedback?: string,
  ): Promise<Submission | undefined> {
    try {
      const submission = await this.prisma.submission.update({
        where: { id },
        data: {
          marks,
          feedback: feedback ?? null,
          status: 'graded',
        },
      });

      return this.toSubmission(submission);
    } catch {
      return undefined;
    }
  }

  private toSubmission(submission: {
    id: string;
    studentId: string;
    assignmentId: string;
    content: string;
    status: 'submitted' | 'graded';
    marks: number | null;
    feedback: string | null;
    submittedAt: Date;
    updatedAt: Date;
  }): Submission {
    return {
      id: submission.id,
      studentId: submission.studentId,
      assignmentId: submission.assignmentId,
      content: submission.content,
      status: submission.status,
      ...(submission.marks !== null && {
        marks: submission.marks,
      }),
      ...(submission.feedback !== null && {
        feedback: submission.feedback,
      }),
      submittedAt: submission.submittedAt.toISOString(),
      updatedAt: submission.updatedAt.toISOString(),
    };
  }
}