
import { AppError } from '../../errors/app-error.js';

import type { AuthRepository } from '../auth/auth.repository.interface.js';

import type {
  CreateStudentInput,
  ListStudentsInput,
  UpdateStudentInput,
} from './student.schema.js';

import { InMemoryStudentRepository } from './student.repository.js';
import type { StudentRepository } from './student.repository.interface.js';

export function createStudentService(
  repository: StudentRepository,
  authRepository?: AuthRepository,
) {
  return {
    async linkStudentUser(studentId: string, userId: string) {
      if (!authRepository) {
        throw new AppError(
          'Authentication repository is not configured',
          500,
          'AUTH_REPOSITORY_NOT_CONFIGURED',
        );
      }

      const student = await repository.findById(studentId);

      if (!student) {
        throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
      }

      const user = await authRepository.findById(userId);

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (user.role !== 'student') {
        throw new AppError(
          'Only student accounts can be linked',
          400,
          'INVALID_USER_ROLE',
        );
      }

      if (student.userId) {
        throw new AppError(
          'Student already has a linked account',
          409,
          'STUDENT_ALREADY_LINKED',
        );
      }

      const linkedStudent = await repository.findByUserId(userId);

      if (linkedStudent) {
        throw new AppError(
          'User is already linked to another student',
          409,
          'USER_ALREADY_LINKED',
        );
      }

      const linked = await repository.linkUser(studentId, userId);

      if (!linked) {
        throw new AppError(
          'Could not link student account',
          409,
          'STUDENT_LINK_FAILED',
        );
      }

      return linked;
    },

    async deleteStudent(id: string) {
      const deleted = await repository.delete(id);

      if (!deleted) {
        throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
      }

      return true;
    },

    async createStudent(input: CreateStudentInput) {
      const existingEmail = await repository.findByEmail(input.email);

      if (existingEmail) {
        throw new AppError(
          'A student with this email already exists',
          409,
          'STUDENT_EMAIL_EXISTS',
        );
      }

      const existingEnrollment = await repository.findByEnrollmentNumber(
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

    async getStudentById(id: string) {
      const student = await repository.findById(id);

      if (!student) {
        throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
      }

      return student;
    },

    async getStudentByUserId(userId: string) {
      const student = await repository.findByUserId(userId);

      if (!student) {
        throw new AppError(
          'Student account is not linked to a student record',
          403,
          'FORBIDDEN',
        );
      }

      return student;
    },

    async updateStudent(id: string, input: UpdateStudentInput) {
      const student = await repository.findById(id);

      if (!student) {
        throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
      }

      if (input.email && input.email !== student.email) {
        const existingEmail = await repository.findByEmail(input.email);

        if (existingEmail) {
          throw new AppError(
            'A student with this email already exists',
            409,
            'STUDENT_EMAIL_EXISTS',
          );
        }
      }

      if (
        input.enrollmentNumber &&
        input.enrollmentNumber !== student.enrollmentNumber
      ) {
        const existingEnrollment = await repository.findByEnrollmentNumber(
          input.enrollmentNumber,
        );

        if (existingEnrollment) {
          throw new AppError(
            'A student with this enrollment number already exists',
            409,
            'STUDENT_ENROLLMENT_EXISTS',
          );
        }
      }

      return repository.update(id, {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.enrollmentNumber !== undefined && {
          enrollmentNumber: input.enrollmentNumber,
        }),
        ...(input.department !== undefined && {
          department: input.department,
        }),
        ...(input.semester !== undefined && { semester: input.semester }),
      });
    },

    async listStudents(input: ListStudentsInput) {
      const { students, total } = await repository.findAll({
        page: input.page,
        limit: input.limit,
        ...(input.search !== undefined && { search: input.search }),
      });

      return {
        students,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    },
  };
}

const defaultStudentService = createStudentService(
  new InMemoryStudentRepository(),
);

export const {
  createStudent,
  getStudentById,
  listStudents,
  updateStudent,
  deleteStudent,
} = defaultStudentService;
