import { randomUUID } from 'node:crypto';
import type {
  Enrollment,
  EnrollmentRepository,
} from './enrollment.repository.interface.js';

export class InMemoryEnrollmentRepository implements EnrollmentRepository {
  private enrollments: Enrollment[] = [];

  create(input: { studentId: string; courseId: string }): Enrollment {
    const enrollment: Enrollment = {
      id: randomUUID(),
      ...input,
      enrolledAt: new Date().toISOString(),
    };

    this.enrollments.push(enrollment);
    return enrollment;
  }

  findById(id: string): Enrollment | undefined {
    return this.enrollments.find((enrollment) => enrollment.id === id);
  }

  findByStudentId(studentId: string): Enrollment[] {
    return this.enrollments.filter(
      (enrollment) => enrollment.studentId === studentId,
    );
  }

  findByStudentAndCourse(
    studentId: string,
    courseId: string,
  ): Enrollment | undefined {
    return this.enrollments.find(
      (enrollment) =>
        enrollment.studentId === studentId && enrollment.courseId === courseId,
    );
  }

  delete(id: string): boolean {
    const index = this.enrollments.findIndex(
      (enrollment) => enrollment.id === id,
    );

    if (index === -1) return false;

    this.enrollments.splice(index, 1);
    return true;
  }
}
