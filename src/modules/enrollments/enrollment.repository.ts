import { randomUUID } from 'node:crypto';
import type { EnrollmentRepository } from './enrollment.repository.interface.js';

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  enrolledAt: string;
}

export class InMemoryEnrollmentRepository implements EnrollmentRepository {
  private enrollments: Enrollment[] = [];

  async create(input: {
    studentId: string;
    courseId: string;
  }): Promise<Enrollment> {
    const enrollment: Enrollment = {
      id: randomUUID(),
      ...input,
      enrolledAt: new Date().toISOString(),
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

  async findByStudentAndCourse(
    studentId: string,
    courseId: string,
  ): Promise<Enrollment | undefined> {
    return this.enrollments.find(
      (enrollment) =>
        enrollment.studentId === studentId &&
        enrollment.courseId === courseId,
    );
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