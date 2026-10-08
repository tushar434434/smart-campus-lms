import { PrismaClient } from '../../generated/prisma/client.js';
import type { Enrollment } from './enrollment.repository.js';
import type { EnrollmentRepository } from './enrollment.repository.interface.js';

export class PrismaEnrollmentRepository implements EnrollmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: {
    studentId: string;
    courseId: string;
  }): Promise<Enrollment> {
    const enrollment = await this.prisma.enrollment.create({
      data: {
        studentId: input.studentId,
        courseId: input.courseId,
      },
    });

    return this.toEnrollment(enrollment);
  }

  async findById(id: string): Promise<Enrollment | undefined> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
    });

    if (!enrollment) return undefined;

    return this.toEnrollment(enrollment);
  }

  async findByStudentId(studentId: string): Promise<Enrollment[]> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId },
      orderBy: { enrolledAt: 'desc' },
    });

    return enrollments.map((enrollment) =>
      this.toEnrollment(enrollment),
    );
  }

  async findByStudentAndCourse(
    studentId: string,
    courseId: string,
  ): Promise<Enrollment | undefined> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId,
        },
      },
    });

    if (!enrollment) return undefined;

    return this.toEnrollment(enrollment);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.enrollment.delete({
        where: { id },
      });

      return true;
    } catch {
      return false;
    }
  }

  private toEnrollment(enrollment: {
    id: string;
    studentId: string;
    courseId: string;
    enrolledAt: Date;
  }): Enrollment {
    return {
      id: enrollment.id,
      studentId: enrollment.studentId,
      courseId: enrollment.courseId,
      enrolledAt: enrollment.enrolledAt.toISOString(),
    };
  }
}