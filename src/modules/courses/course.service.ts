import { AppError } from '../../errors/app-error.js';

import type {
  CreateCourseInput,
  UpdateCourseInput,
} from './course.schema.js';

import { InMemoryCourseRepository } from './course.repository.js';

import type { CourseRepository } from './course.repository.interface.js';

export function createCourseService(repository: CourseRepository) {
  return {
    createCourse(input: CreateCourseInput) {
      return repository.create(input);
    },

    getCourses() {
      return repository.findAll();
    },

    getCourseById(id: string) {
      const course = repository.findById(id);

      if (!course) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }

      return course;
    },

    updateCourse(id: string, input: UpdateCourseInput) {
      const course = repository.update(id, input);

      if (!course) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }

      return course;
    },

    deleteCourse(id: string) {
      const deleted = repository.delete(id);

      if (!deleted) {
        throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
      }

      return true;
    },
  };
}

const defaultCourseService = createCourseService(
  new InMemoryCourseRepository(),
);

export const {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
} = defaultCourseService;