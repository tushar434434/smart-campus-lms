import type { Enrollment } from './enrollment.repository.js';

export type { Enrollment };

export interface EnrollmentRepository {
  create(input: {
    studentId: string;
    courseId: string;
    status?: Enrollment['status'];
  }): Promise<Enrollment>;

  findById(id: string): Promise<Enrollment | undefined>;

  findByStudentId(studentId: string): Promise<Enrollment[]>;

  findAllByCourseId(courseId: string): Promise<Enrollment[]>;

  findAll(status?: Enrollment['status']): Promise<Enrollment[]>;

  findByStudentAndCourse(
    studentId: string,
    courseId: string,
  ): Promise<Enrollment | undefined>;

  updatePendingStatus(
    id: string,
    status: 'approved' | 'rejected',
    reviewerId: string,
    rejectionReason?: string,
  ): Promise<Enrollment | undefined>;

  resetRejected(id: string): Promise<Enrollment | undefined>;

  delete(id: string): Promise<boolean>;
}
