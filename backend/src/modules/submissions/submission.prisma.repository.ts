import { PrismaClient } from '../../generated/prisma/client.js';
import type { Submission } from './submission.repository.js';
import type { SubmissionRepository } from './submission.repository.interface.js';
import type { StoredSubmissionFile } from './submission.repository.interface.js';

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

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.submission.delete({ where: { id } });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        return;
      }
      throw error;
    }
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

    return submissions.map((submission) => this.toSubmission(submission));
  }

  async findByAssignmentId(assignmentId: string): Promise<Submission[]> {
    const submissions = await this.prisma.submission.findMany({
      where: { assignmentId },
      orderBy: { submittedAt: 'desc' },
    });

    return submissions.map((submission) => this.toSubmission(submission));
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
    const result = await this.prisma.submission.updateMany({
      where: { id, status: 'submitted' },
      data: { content },
    });
    return result.count === 1 ? this.findById(id) : undefined;
  }

  async grade(
    id: string,
    marks: number,
    feedback?: string,
  ): Promise<Submission | undefined> {
    const result = await this.prisma.submission.updateMany({
      where: { id, status: 'submitted' },
      data: {
        marks,
        feedback: feedback ?? null,
        status: 'graded',
      },
    });
    return result.count === 1 ? this.findById(id) : undefined;
  }

  async attachFile(
    id: string,
    file: StoredSubmissionFile,
  ): Promise<Submission | undefined> {
    try {
      const submission = await this.prisma.submission.update({
        where: { id },
        data: {
          fileKey: file.key,
          fileMimeType: file.mimeType,
          fileSize: file.size,
        },
      });
      return this.toSubmission(submission);
    } catch (error) {
      if (isPrismaRecordNotFound(error)) return undefined;
      throw error;
    }
  }

  async findStoredFile(id: string): Promise<StoredSubmissionFile | undefined> {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      select: { fileKey: true, fileMimeType: true, fileSize: true },
    });
    if (
      !submission?.fileKey ||
      !submission.fileMimeType ||
      submission.fileSize === null
    ) {
      return undefined;
    }
    return {
      key: submission.fileKey,
      mimeType: submission.fileMimeType,
      size: submission.fileSize,
    };
  }

  private toSubmission(submission: {
    id: string;
    studentId: string;
    assignmentId: string;
    content: string;
    status: 'submitted' | 'graded';
    marks: number | null;
    feedback: string | null;
    fileKey: string | null;
    fileMimeType: string | null;
    fileSize: number | null;
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
      ...(submission.fileMimeType !== null &&
        submission.fileSize !== null && {
          file: {
            mimeType: submission.fileMimeType,
            size: submission.fileSize,
          },
        }),
      submittedAt: submission.submittedAt.toISOString(),
      updatedAt: submission.updatedAt.toISOString(),
    };
  }
}

function isPrismaRecordNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2025'
  );
}
