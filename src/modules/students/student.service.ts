import { AppError } from '../../errors/app-error.js';

import type { CreateStudentInput } from './student.schema.js';

import { InMemoryStudentRepository } from './student.repository.js';

import type { StudentRepository } from './student.repository.interface.js';

export function createStudentService(repository: StudentRepository) {
  return {
    createStudent(input: CreateStudentInput) {
      const existingEmail = repository.findByEmail(input.email);

      if (existingEmail) {
        throw new AppError(
          'A student with this email already exists',
          409,
          'STUDENT_EMAIL_EXISTS',
        );
      }

      const existingEnrollment = repository.findByEnrollmentNumber(
        input.enrollmentNumber,
      );

      if (existingEnrollment) {
        throw new AppError(
          'A student with this enrollment number already exists',
          409,
          'STUDENT_ENROLLMENT_EXISTS',
        );
      }

      return repository.create(input);
    },

    getStudentById(id: string) {
      const student = repository.findById(id);

      if (!student) {
        throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
      }

      return student;
    },
  };
}

const defaultStudentService = createStudentService(
  new InMemoryStudentRepository(),
);

export const { createStudent, getStudentById } = defaultStudentService;
