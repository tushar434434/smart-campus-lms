import { PrismaClient } from '../../generated/prisma/client.js';
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

    return {
      id: student.id,
      name: student.name,
      email: student.email,
      enrollmentNumber: student.enrollmentNumber,
      department: student.department,
      semester: student.semester,
      createdAt: student.createdAt.toISOString(),
    };
  }

  async findById(id: string): Promise<Student | undefined> {
    const student = await this.prisma.student.findUnique({
      where: { id },
    });

    if (!student) return undefined;

    return this.toStudent(student);
  }

  async findByEmail(email: string): Promise<Student | undefined> {
    const student = await this.prisma.student.findUnique({
      where: { email },
    });

    if (!student) return undefined;

    return this.toStudent(student);
  }

  async findByEnrollmentNumber(
    enrollmentNumber: string,
  ): Promise<Student | undefined> {
    const student = await this.prisma.student.findUnique({
      where: { enrollmentNumber },
    });

    if (!student) return undefined;

    return this.toStudent(student);
  }

  async update(
    id: string,
    input: UpdateStudentInput,
  ): Promise<Student | undefined> {
    try {
      const student = await this.prisma.student.update({
        where: { id },
        data: {
          ...(input.name !== undefined && {
            name: input.name,
          }),
          ...(input.email !== undefined && {
            email: input.email,
          }),
          ...(input.enrollmentNumber !== undefined && {
            enrollmentNumber: input.enrollmentNumber,
          }),
          ...(input.department !== undefined && {
            department: input.department,
          }),
          ...(input.semester !== undefined && {
            semester: input.semester,
          }),
        },
      });

      return this.toStudent(student);
    } catch {
      return undefined;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.student.delete({
        where: { id },
      });

      return true;
    } catch {
      return false;
    }
  }

  async findAll(
    input: ListStudentsInput,
  ): Promise<{ students: Student[]; total: number }> {
    const { page, limit, search } = input;

    const where = search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
            {
              email: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
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
        orderBy: {
          createdAt: 'desc',
        },
      }),

      this.prisma.student.count({
        where,
      }),
    ]);

    return {
      students: students.map((student) => this.toStudent(student)),
      total,
    };
  }

  private toStudent(student: {
    id: string;
    name: string;
    email: string;
    enrollmentNumber: string;
    department: string;
    semester: number;
    createdAt: Date;
  }): Student {
    return {
      id: student.id,
      name: student.name,
      email: student.email,
      enrollmentNumber: student.enrollmentNumber,
      department: student.department,
      semester: student.semester,
      createdAt: student.createdAt.toISOString(),
    };
  }
}