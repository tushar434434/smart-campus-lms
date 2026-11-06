import { AppError } from '../../errors/app-error.js';

import type { AuthRepository } from '../auth/auth.repository.interface.js';

import type {
  CreateStudentInput,
  ListLinkableUsersInput,
  ListStudentsInput,
  UpdateStudentInput,
} from './student.schema.js';

import {
  InMemoryStudentRepository,
  type Student,
} from './student.repository.js';
import type { StudentRepository } from './student.repository.interface.js';

export async function resolveStudentForUser(
  userId: string,
  repository: StudentRepository,
  authRepository?: Pick<AuthRepository, 'findById'>,
): Promise<Student | undefined> {
  const linked = await repository.findByUserId(userId);
  if (linked) {
    return linked;
  }

  if (!authRepository) {
    return undefined;
  }

  const account = await authRepository.findById(userId);
  if (!account || account.role !== 'student' || account.suspendedAt) {
    return undefined;
  }

  const student = await repository.findByEmail(account.email);
  if (!student || student.userId) {
    return undefined;
  }

  try {
    return await repository.linkUser(student.id, userId);
  } catch {
    return undefined;
  }
}

export function createStudentService(
  repository: StudentRepository,
  authRepository?: AuthRepository,
) {
  return {
    async listLinkableUsers(studentId: string, input: ListLinkableUsersInput) {
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

      const linkedUserIds = await repository.findLinkedUserIds();
      const excludedUserIds = linkedUserIds.filter(
        (userId) => userId !== student.userId,
      );
      const { accounts, total } = await authRepository.findStudentAccounts({
        page: input.page,
        limit: input.limit,
        ...(input.search !== undefined ? { search: input.search } : {}),
        excludedUserIds,
      });

      return {
        accounts,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    },

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

    async unlinkStudentUser(studentId: string) {
      const student = await repository.findById(studentId);
      if (!student) {
        throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
      }
      if (!student.userId) {
        throw new AppError(
          'Student does not have a linked account',
          409,
          'STUDENT_NOT_LINKED',
        );
      }
      const unlinked = await repository.unlinkUser(studentId);
      if (!unlinked) {
        throw new AppError(
          'Could not unlink student account',
          409,
          'STUDENT_UNLINK_FAILED',
        );
      }
      return unlinked;
    },

    async deleteStudent(id: string) {
      const deleted = await repository.delete(id);

      if (!deleted) {
        throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
      }

      return true;
    },

    async createStudent(input: CreateStudentInput) {
      const email = input.email.toLowerCase();
      const existingEmail = await repository.findByEmail(email);

      if (existingEmail) {
        throw new AppError(
          'A student with this email already exists',
          409,
          'STUDENT_EMAIL_EXISTS',
        );
      }

      const created = await repository.create({ ...input, email });
      if (!authRepository) {
        return created;
      }

      const account = await authRepository.findByEmail(email);
      if (
        !account ||
        account.role !== 'student' ||
        account.suspendedAt ||
        (await repository.findByUserId(account.id))
      ) {
        return created;
      }

      try {
        const linked = await repository.linkUser(created.id, account.id);
        return linked ?? created;
      } catch {
        return created;
      }
    },

    async getStudentById(id: string) {
      const student = await repository.findById(id);

      if (!student) {
        throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
      }

      return student;
    },

    async getStudentByUserId(userId: string) {
      const student = await resolveStudentForUser(
        userId,
        repository,
        authRepository,
      );

      if (!student) {
        throw new AppError(
          'Student account is not linked to a student record',
          403,
          'FORBIDDEN',
        );
      }

      return student;
    },

    async tryLinkMatchingAccount(userId: string) {
      return resolveStudentForUser(userId, repository, authRepository);
    },

    async updateStudent(id: string, input: UpdateStudentInput) {
      const student = await repository.findById(id);

      if (!student) {
        throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
      }

      if (
        input.email &&
        input.email.toLowerCase() !== student.email.toLowerCase()
      ) {
        const email = input.email.toLowerCase();
        const existingEmail = await repository.findByEmail(email);

        if (existingEmail) {
          throw new AppError(
            'A student with this email already exists',
            409,
            'STUDENT_EMAIL_EXISTS',
          );
        }
      }

      return repository.update(id, {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email.toLowerCase() }),
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
