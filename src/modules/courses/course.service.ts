import { AppError } from '../../errors/app-error.js';

import type {
  CreateCourseInput,
  UpdateCourseInput,
  ListCoursesInput,
} from './course.schema.js';

import type { CourseRepository } from './course.repository.interface.js';

export function createCourseService(repository: CourseRepository) {
  return {
    async create(input: CreateCourseInput) {
      return repository.create(input);
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
      const course = await repository.update(id, input);

      if (!course) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }

      return course;
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
