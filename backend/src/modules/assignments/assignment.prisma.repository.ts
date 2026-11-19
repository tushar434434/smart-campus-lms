import { Prisma } from '../../generated/prisma/client.js';
import { PrismaClient } from '../../generated/prisma/client.js';

import type { Assignment } from './assignment.repository.js';
import type {
  AssignmentRepository,
  StoredAssignmentFile,
} from './assignment.repository.interface.js';

export class PrismaAssignmentRepository implements AssignmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    input: Omit<Assignment, 'id' | 'createdAt'>,
  ): Promise<Assignment> {
    const assignment = await this.prisma.assignment.create({
      data: {
        courseId: input.courseId,
        title: input.title,
        description: input.description,
        dueAt: new Date(input.dueAt),
        maxMarks: input.maxMarks,
      },
    });

    return this.toAssignment(assignment);
  }

  async findAllByCourseId(courseId: string): Promise<Assignment[]> {
    const assignments = await this.prisma.assignment.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
    });

    return assignments.map((assignment) => this.toAssignment(assignment));
  }

  async findById(id: string): Promise<Assignment | undefined> {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
    });

    return assignment ? this.toAssignment(assignment) : undefined;
  }

  async update(
    id: string,
    input: Partial<Omit<Assignment, 'id' | 'courseId' | 'createdAt'>>,
  ): Promise<Assignment | undefined> {
    try {
      const assignment = await this.prisma.assignment.update({
        where: { id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
          ...(input.dueAt !== undefined && {
            dueAt: new Date(input.dueAt),
          }),
          ...(input.maxMarks !== undefined && {
            maxMarks: input.maxMarks,
          }),
        },
      });

      return this.toAssignment(assignment);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return undefined;
      }

      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.assignment.delete({
        where: { id },
      });

      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return false;
      }

      throw error;
    }
  }

  async attachFile(
    id: string,
    file: StoredAssignmentFile,
  ): Promise<Assignment | undefined> {
    try {
      const assignment = await this.prisma.assignment.update({
        where: { id },
        data: {
          fileKey: file.key,
          fileMimeType: file.mimeType,
          fileSize: file.size,
          originalFileName: file.originalFileName,
        },
      });
      return this.toAssignment(assignment);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return undefined;
      }
      throw error;
    }
  }

  async findStoredFile(id: string): Promise<StoredAssignmentFile | undefined> {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      select: {
        fileKey: true,
        fileMimeType: true,
        fileSize: true,
        originalFileName: true,
      },
    });
    if (
      !assignment?.fileKey ||
      !assignment.fileMimeType ||
      assignment.fileSize === null ||
      !assignment.originalFileName
    ) {
      return undefined;
    }
    return {
      key: assignment.fileKey,
      mimeType: assignment.fileMimeType,
      size: assignment.fileSize,
      originalFileName: assignment.originalFileName,
    };
  }

  private toAssignment(assignment: {
    id: string;
    courseId: string;
    title: string;
    description: string;
    dueAt: Date;
    maxMarks: number;
    fileKey: string | null;
    fileMimeType: string | null;
    fileSize: number | null;
    originalFileName: string | null;
    createdAt: Date;
  }): Assignment {
    return {
      id: assignment.id,
      courseId: assignment.courseId,
      title: assignment.title,
      description: assignment.description,
      dueAt: assignment.dueAt.toISOString(),
      maxMarks: assignment.maxMarks,
      ...(assignment.fileKey &&
        assignment.fileMimeType &&
        assignment.fileSize !== null &&
        assignment.originalFileName && {
          file: {
            mimeType: assignment.fileMimeType,
            size: assignment.fileSize,
            originalFileName: assignment.originalFileName,
          },
        }),
      createdAt: assignment.createdAt.toISOString(),
    };
  }
}
