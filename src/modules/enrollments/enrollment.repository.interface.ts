import type { Enrollment } from './enrollment.repository.js';

export type { Enrollment };

export interface EnrollmentRepository {
  create(input: {
    studentId: string;
    courseId: string;
  }): Promise<Enrollment>;

  findById(id: string): Promise<Enrollment | undefined>;

  findByStudentId(studentId: string): Promise<Enrollment[]>;

  findByStudentAndCourse(
    studentId: string,
    courseId: string,
  ): Promise<Enrollment | undefined>;

  delete(id: string): Promise<boolean>;
}