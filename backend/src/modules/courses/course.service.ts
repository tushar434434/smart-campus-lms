import { AppError } from '../../errors/app-error.js';
import type {
  CreateCourseInput,
  UpdateCourseInput,
  ListCoursesInput,
} from './course.schema.js';
import type { CourseRepository } from './course.repository.interface.js';
import type { CourseApprovalStatus } from './course.repository.js';
import type { AuthRepository } from '../auth/auth.repository.interface.js';

function isDuplicateCourseCodeError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'COURSE_CODE_EXISTS'
  );
}

function handleCourseError(error: unknown): never {
  if (isDuplicateCourseCodeError(error)) {
    throw new AppError('Course code already exists', 409, 'COURSE_CODE_EXISTS');
  }

  throw error;
}

export function createCourseService(
  repository: CourseRepository,
  authRepository?: AuthRepository,
) {
  return {
    async create(input: CreateCourseInput, ownerFacultyId?: string) {
      try {
        return await repository.create(input, ownerFacultyId);
      } catch (error) {
        handleCourseError(error);
      }
    },

    async list(
      input: ListCoursesInput,
      ownerFacultyId?: string,
      approvalStatus?: CourseApprovalStatus | 'all',
    ) {
      const visibleStatus =
        approvalStatus ?? (ownerFacultyId ? 'all' : 'approved');
      const result = await repository.findAll(
        input,
        ownerFacultyId,
        visibleStatus,
      );

      return {
        courses: result.courses,
        pagination: {
          page: input.page,
          limit: input.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / input.limit),
        },
      };
    },

    async getById(id: string, user?: { sub: string; role: string }) {
      const course = await repository.findById(id);

      if (!course) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }

      if (
        course.approvalStatus !== 'approved' &&
        user?.role !== 'admin' &&
        user?.sub !== course.ownerFacultyId
      ) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }

      return course;
    },

    async approve(id: string, reviewerId: string) {
      const course = await repository.findById(id);
      if (!course) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }
      if (course.approvalStatus !== 'pending') {
        throw new AppError(
          'Only pending courses can be approved',
          409,
          'COURSE_NOT_PENDING',
        );
      }
      const updated = await repository.approvePending(id, reviewerId);
      if (!updated) {
        throw new AppError(
          'Course approval state changed; refresh and try again',
          409,
          'COURSE_NOT_PENDING',
        );
      }
      return updated;
    },

    async reject(id: string, reviewerId: string, reason: string) {
      const course = await repository.findById(id);
      if (!course) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }
      if (course.approvalStatus !== 'pending') {
        throw new AppError(
          'Only pending courses can be rejected',
          409,
          'COURSE_NOT_PENDING',
        );
      }
      const updated = await repository.rejectPending(id, reviewerId, reason);
      if (!updated) {
        throw new AppError(
          'Course approval state changed; refresh and try again',
          409,
          'COURSE_NOT_PENDING',
        );
      }
      return updated;
    },

    async resubmit(id: string, ownerFacultyId: string) {
      const course = await repository.resubmitRejected(id, ownerFacultyId);
      if (!course) {
        throw new AppError(
          'Only your rejected courses can be resubmitted',
          404,
          'COURSE_NOT_FOUND',
        );
      }
      return course;
    },

    async assertCanManage(id: string, user: { sub: string; role: string }) {
      if (user.role === 'admin') return;

      const course = await repository.findById(id);
      if (!course) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }

      if (user.role !== 'faculty' || course.ownerFacultyId !== user.sub) {
        throw new AppError(
          'You can only manage courses assigned to you',
          403,
          'FORBIDDEN',
        );
      }
    },

    async assignFaculty(id: string, facultyId: string | null) {
      if (facultyId !== null) {
        if (!authRepository) {
          throw new AppError(
            'Authentication repository is not configured',
            500,
            'AUTH_REPOSITORY_NOT_CONFIGURED',
          );
        }
        const faculty = await authRepository.findById(facultyId);
        if (!faculty || faculty.role !== 'faculty') {
          throw new AppError(
            'Course owner must be an existing faculty account',
            400,
            'INVALID_FACULTY',
          );
        }
      }

      const course = await repository.setOwnerFacultyId(id, facultyId);
      if (!course) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }
      return course;
    },

    async update(id: string, input: UpdateCourseInput) {
      try {
        const course = await repository.update(id, input);

        if (!course) {
          throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
        }

        return course;
      } catch (error) {
        handleCourseError(error);
      }
    },

    async delete(id: string) {
      const deleted = await repository.delete(id);

      if (!deleted) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }

      return true;
    },
  };
}
