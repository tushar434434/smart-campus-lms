import { AppError } from '../../errors/app-error.js';
import type { CourseRepository } from '../courses/course.repository.interface.js';

import type { StudentRepository } from '../students/student.repository.interface.js';

import type { EnrollmentRepository } from './enrollment.repository.interface.js';

export function createEnrollmentService(
  repository: EnrollmentRepository,
  studentRepository: StudentRepository,
  courseRepository: CourseRepository,
) {
  return {
    enrollStudent(studentId: string, courseId: string) {
      if (!studentRepository.findById(studentId)) {
        throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
      }

      if (!courseRepository.findById(courseId)) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }

      const existing = repository.findByStudentAndCourse(studentId, courseId);

      if (existing) {
        throw new AppError(
          'Student is already enrolled in this course',
          409,
          'ENROLLMENT_EXISTS',
        );
      }

      return repository.create({ studentId, courseId });
    },

    getStudentEnrollments(studentId: string) {
      if (!studentRepository.findById(studentId)) {
        throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
      }

      return repository.findByStudentId(studentId);
    },

    deleteEnrollment(id: string) {
      if (!repository.delete(id)) {
        throw new AppError('Enrollment not found', 404, 'ENROLLMENT_NOT_FOUND');
      }
    },
  };
}
