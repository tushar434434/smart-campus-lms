import { PrismaClient, Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../errors/app-error.js';

import type {
  CreateStudentInput,
  ListStudentsInput,
  UpdateStudentInput,
} from './student.schema.js';

import type { Student } from './student.repository.js';
import type { StudentRepository } from './student.repository.interface.js';

export class PrismaStudentRepository implements StudentRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly enrollmentPrefix = process.env.STUDENT_ENROLLMENT_PREFIX?.trim() ||
      'SC',
  ) {}

  async create(input: CreateStudentInput): Promise<Student> {
    const year = new Date().getFullYear();
    const student = await this.prisma.$transaction(async (transaction) => {
      const sequence = await transaction.studentEnrollmentSequence.upsert({
        where: { year },
        create: { year, value: 1 },
        update: { value: { increment: 1 } },
      });
      let enrollmentNumber = `${this.enrollmentPrefix}${year}-${String(sequence.value).padStart(6, '0')}`;

      while (
        await transaction.student.findUnique({
          where: { enrollmentNumber },
          select: { id: true },
        })
      ) {
        const nextSequence = await transaction.studentEnrollmentSequence.update(
          {
            where: { year },
            data: { value: { increment: 1 } },
          },
        );
        enrollmentNumber = `${this.enrollmentPrefix}${year}-${String(nextSequence.value).padStart(6, '0')}`;
      }

      return transaction.student.create({
        data: { ...input, enrollmentNumber },
      });
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
    const matches = await this.prisma.student.findMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      take: 2,
    });

    if (matches.length !== 1) {
      return undefined;
    }

    return this.toStudent(matches[0]!);
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

  async findLinkedUserIds(): Promise<string[]> {
    const students = await this.prisma.student.findMany({
      where: { userId: { not: null } },
      select: { userId: true },
    });

    return students.flatMap((student) =>
      student.userId ? [student.userId] : [],
    );
  }

  async linkUser(
    studentId: string,
    userId: string,
  ): Promise<Student | undefined> {
    try {
      const result = await this.prisma.student.updateMany({
        where: { id: studentId, userId: null },
        data: { userId },
      });

      if (result.count === 0) return undefined;

      return this.findById(studentId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return undefined;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError(
          'This account is already linked to another student',
          409,
          'USER_ALREADY_LINKED',
        );
      }

      throw error;
    }
  }

  async unlinkUser(studentId: string): Promise<Student | undefined> {
    const result = await this.prisma.student.updateMany({
      where: { id: studentId, userId: { not: null } },
      data: { userId: null },
    });
    if (result.count === 0) return undefined;
    return this.findById(studentId);
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
