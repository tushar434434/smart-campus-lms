import { randomUUID } from 'node:crypto';
import type { EnrollmentRepository } from './enrollment.repository.interface.js';

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  requestedAt: string;
  enrolledAt: string;
  reviewedAt: string | null;
  reviewedById: string | null;
}

export class InMemoryEnrollmentRepository implements EnrollmentRepository {
  private enrollments: Enrollment[] = [];

  async create(input: {
    studentId: string;
    courseId: string;
    status?: Enrollment['status'];
  }): Promise<Enrollment> {
    const now = new Date().toISOString();
    const enrollment: Enrollment = {
      id: randomUUID(),
      ...input,
      status: input.status ?? 'approved',
      rejectionReason: null,
      requestedAt: now,
      enrolledAt: now,
      reviewedAt: null,
      reviewedById: null,
    };

    this.enrollments.push(enrollment);
    return enrollment;
  }

  async findById(id: string): Promise<Enrollment | undefined> {
    return this.enrollments.find((enrollment) => enrollment.id === id);
  }

  async findByStudentId(studentId: string): Promise<Enrollment[]> {
    return this.enrollments.filter(
      (enrollment) => enrollment.studentId === studentId,
    );
  }

  async findAllByCourseId(courseId: string): Promise<Enrollment[]> {
    return this.enrollments.filter(
      (enrollment) => enrollment.courseId === courseId,
    );
  }

  async findAll(status?: Enrollment['status']): Promise<Enrollment[]> {
    return this.enrollments.filter(
      (enrollment) => status === undefined || enrollment.status === status,
    );
  }

  async findByStudentAndCourse(
    studentId: string,
    courseId: string,
  ): Promise<Enrollment | undefined> {
    return this.enrollments.find(
      (enrollment) =>
        enrollment.studentId === studentId && enrollment.courseId === courseId,
    );
  }

  async updatePendingStatus(
    id: string,
    status: 'approved' | 'rejected',
    reviewerId: string,
    rejectionReason?: string,
  ): Promise<Enrollment | undefined> {
    const enrollment = this.enrollments.find(
      (item) => item.id === id && item.status === 'pending',
    );
    if (!enrollment) return undefined;
    enrollment.status = status;
    enrollment.rejectionReason = rejectionReason ?? null;
    enrollment.reviewedAt = new Date().toISOString();
    enrollment.reviewedById = reviewerId;
    if (status === 'approved') enrollment.enrolledAt = enrollment.reviewedAt;
    return enrollment;
  }

  async resetRejected(id: string): Promise<Enrollment | undefined> {
    const enrollment = this.enrollments.find(
      (item) => item.id === id && item.status === 'rejected',
    );
    if (!enrollment) return undefined;
    enrollment.status = 'pending';
    enrollment.rejectionReason = null;
    enrollment.requestedAt = new Date().toISOString();
    enrollment.reviewedAt = null;
    enrollment.reviewedById = null;
    return enrollment;
  }

  async delete(id: string): Promise<boolean> {
    const index = this.enrollments.findIndex(
      (enrollment) => enrollment.id === id,
    );

    if (index === -1) return false;

    this.enrollments.splice(index, 1);
    return true;
  }
}
