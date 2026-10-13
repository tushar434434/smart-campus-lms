
import { PrismaClient, Prisma } from '../../generated/prisma/client.js';

import type {
  CreateStudentInput,
  ListStudentsInput,
  UpdateStudentInput,
} from './student.schema.js';

import type { Student } from './student.repository.js';
import type { StudentRepository } from './student.repository.interface.js';

export class PrismaStudentRepository implements StudentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateStudentInput): Promise<Student> {
    const student = await this.prisma.student.create({
      data: input,
    });

    return this.toStudent(student);
  }

  async findById(id: string): Promise<Student | undefined> {
    const student = await this.prisma.student.findUnique({
      where: { id },
    });

    return student ? this.toStudent(student) : undefined;
  }

  async findByEmail(email: string): Promise<Student | undefined> {
    const student = await this.prisma.student.findUnique({
      where: { email },
    });

    return student ? this.toStudent(student) : undefined;
  }

  async findByEnrollmentNumber(
    enrollmentNumber: string,
  ): Promise<Student | undefined> {
    const student = await this.prisma.student.findUnique({
      where: { enrollmentNumber },
    });

    return student ? this.toStudent(student) : undefined;
  }

  async findByUserId(userId: string): Promise<Student | undefined> {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });

    return student ? this.toStudent(student) : undefined;
  }

  async linkUser(
    studentId: string,
    userId: string,
  ): Promise<Student | undefined> {
    try {
      const student = await this.prisma.student.update({
        where: { id: studentId },
        data: {
          user: {
            connect: { id: userId },
          },
        },
      });

      return this.toStudent(student);
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

  async update(
    id: string,
    input: UpdateStudentInput,
  ): Promise<Student | undefined> {
    try {
      const student = await this.prisma.student.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.email !== undefined && { email: input.email }),
          ...(input.enrollmentNumber !== undefined && {
            enrollmentNumber: input.enrollmentNumber,
          }),
          ...(input.department !== undefined && {
            department: input.department,
          }),
          ...(input.semester !== undefined && { semester: input.semester }),
        },
      });

      return this.toStudent(student);
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
      await this.prisma.student.delete({
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

  async findAll(
    input: ListStudentsInput,
  ): Promise<{ students: Student[]; total: number }> {
    const { page, limit, search } = input;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            {
              enrollmentNumber: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {};

    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      students: students.map((student) => this.toStudent(student)),
      total,
    };
  }

  private toStudent(student: {
    id: string;
    userId: string | null;
    name: string;
    email: string;
    enrollmentNumber: string;
    department: string;
    semester: number;
    createdAt: Date;
  }): Student {
    return {
      id: student.id,
      userId: student.userId,
      name: student.name,
      email: student.email,
      enrollmentNumber: student.enrollmentNumber,
      department: student.department,
      semester: student.semester,
      createdAt: student.createdAt.toISOString(),
    };
  }
}
