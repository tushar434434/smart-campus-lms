
import { AppError } from '../../errors/app-error.js';
import type {
  CreateCourseInput,
  UpdateCourseInput,
  ListCoursesInput,
} from './course.schema.js';
import type { CourseRepository } from './course.repository.interface.js';

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
    throw new AppError(
      'Course code already exists',
      409,
      'COURSE_CODE_EXISTS',
    );
  }

  throw error;
}

export function createCourseService(repository: CourseRepository) {
  return {
    async create(input: CreateCourseInput) {
      try {
        return await repository.create(input);
      } catch (error) {
        handleCourseError(error);
      }
    },

    async list(input: ListCoursesInput) {
      const result = await repository.findAll(input);

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

    async getById(id: string) {
      const course = await repository.findById(id);

      if (!course) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }

      return course;
    },

    async update(id: string, input: UpdateCourseInput) {
      try {
        const course = await repository.update(id, input);

        if (!course) {
          throw new AppError(
            'Course not found',
            404,
            'COURSE_NOT_FOUND',
          );
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
