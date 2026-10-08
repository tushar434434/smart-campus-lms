import { PrismaClient } from '../../generated/prisma/client.js';
import type { Assignment } from './assignment.repository.js';
import type { AssignmentRepository } from './assignment.repository.interface.js';

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
      where: {
        courseId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return assignments.map((assignment) =>
      this.toAssignment(assignment),
    );
  }

  async findById(id: string): Promise<Assignment | undefined> {
    const assignment = await this.prisma.assignment.findUnique({
      where: {
        id,
      },
    });

    if (!assignment) {
      return undefined;
    }

    return this.toAssignment(assignment);
  }

  async update(
    id: string,
    input: Partial<Omit<Assignment, 'id' | 'courseId' | 'createdAt'>>,
  ): Promise<Assignment | undefined> {
    try {
      const assignment = await this.prisma.assignment.update({
        where: {
          id,
        },
        data: {
          ...(input.title !== undefined && {
            title: input.title,
          }),
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
    } catch {
      return undefined;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.assignment.delete({
        where: {
          id,
        },
      });

      return true;
    } catch {
      return false;
    }
  }

  private toAssignment(assignment: {
    id: string;
    courseId: string;
    title: string;
    description: string;
    dueAt: Date;
    maxMarks: number;
    createdAt: Date;
  }): Assignment {
    return {
      id: assignment.id,
      courseId: assignment.courseId,
      title: assignment.title,
      description: assignment.description,
      dueAt: assignment.dueAt.toISOString(),
      maxMarks: assignment.maxMarks,
      createdAt: assignment.createdAt.toISOString(),
    };
  }
}