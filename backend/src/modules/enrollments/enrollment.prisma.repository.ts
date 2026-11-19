import { PrismaClient } from '../../generated/prisma/client.js';
import type { Enrollment } from './enrollment.repository.js';
import type { EnrollmentRepository } from './enrollment.repository.interface.js';

export class PrismaEnrollmentRepository implements EnrollmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: {
    studentId: string;
    courseId: string;
    status?: Enrollment['status'];
  }): Promise<Enrollment> {
    const enrollment = await this.prisma.enrollment.create({
      data: {
        studentId: input.studentId,
        courseId: input.courseId,
        status: input.status ?? 'approved',
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

    return enrollments.map((enrollment) => this.toEnrollment(enrollment));
  }

  async findAllByCourseId(courseId: string): Promise<Enrollment[]> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId },
      orderBy: { enrolledAt: 'asc' },
    });

    return enrollments.map((enrollment) => this.toEnrollment(enrollment));
  }

  async findAll(status?: Enrollment['status']): Promise<Enrollment[]> {
    const enrollments = await this.prisma.enrollment.findMany({
      ...(status !== undefined && { where: { status } }),
      orderBy: { requestedAt: 'asc' },
    });
    return enrollments.map((enrollment) => this.toEnrollment(enrollment));
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

  async updatePendingStatus(
    id: string,
    status: 'approved' | 'rejected',
    reviewerId: string,
    rejectionReason?: string,
  ): Promise<Enrollment | undefined> {
    const reviewedAt = new Date();
    const result = await this.prisma.enrollment.updateMany({
      where: { id, status: 'pending' },
      data: {
        status,
        rejectionReason: rejectionReason ?? null,
        reviewedAt,
        reviewedById: reviewerId,
        ...(status === 'approved' && { enrolledAt: reviewedAt }),
      },
    });
    if (result.count !== 1) return undefined;
    return this.findById(id);
  }

  async resetRejected(id: string): Promise<Enrollment | undefined> {
    const result = await this.prisma.enrollment.updateMany({
      where: { id, status: 'rejected' },
      data: {
        status: 'pending',
        rejectionReason: null,
        requestedAt: new Date(),
        reviewedAt: null,
        reviewedById: null,
      },
    });
    if (result.count !== 1) return undefined;
    return this.findById(id);
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
    status: Enrollment['status'];
    rejectionReason: string | null;
    requestedAt: Date;
    enrolledAt: Date;
    reviewedAt: Date | null;
    reviewedById: string | null;
  }): Enrollment {
    return {
      id: enrollment.id,
      studentId: enrollment.studentId,
      courseId: enrollment.courseId,
      status: enrollment.status,
      rejectionReason: enrollment.rejectionReason,
      requestedAt: enrollment.requestedAt.toISOString(),
      enrolledAt: enrollment.enrolledAt.toISOString(),
      reviewedAt: enrollment.reviewedAt?.toISOString() ?? null,
      reviewedById: enrollment.reviewedById,
    };
  }
}
