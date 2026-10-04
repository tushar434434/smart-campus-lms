import { AppError } from '../../errors/app-error.js';
import type { UpdateCourseInput } from './course.schema.js';
import {
  createCourse as createCourseInRepository,
  deleteCourse as deleteCourseInRepository,
  getCourseById as getCourseByIdFromRepository,
  getCourses as getCoursesFromRepository,
  updateCourse as updateCourseInRepository,
} from './course.repository.js';

export {
  createCourseInRepository as createCourse,
  getCoursesFromRepository as getCourses,
};
export function getCourseById(id: string) {
  const course = getCourseByIdFromRepository(id);

  if (!course) {
    throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
  }

  return course;
}
export function updateCourse(id: string, input: UpdateCourseInput) {
  const course = updateCourseInRepository(id, input);

  if (!course) {
    throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
  }

  return course;
}
export function deleteCourse(id: string) {
  const deleted = deleteCourseInRepository(id);

  if (!deleted) {
    throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
  }

  return true;
}
