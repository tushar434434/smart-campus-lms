import { AppError } from '../../errors/app-error.js';

import type { CreateCourseInput, UpdateCourseInput } from './course.schema.js';

import { InMemoryCourseRepository } from './course.repository.js';

const courseRepository = new InMemoryCourseRepository();

export function createCourse(input: CreateCourseInput) {
  return courseRepository.create(input);
}

export function getCourses() {
  return courseRepository.findAll();
}

export function getCourseById(id: string) {
  const course = courseRepository.findById(id);

  if (!course) {
    throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
  }

  return course;
}

export function updateCourse(id: string, input: UpdateCourseInput) {
  const course = courseRepository.update(id, input);

  if (!course) {
    throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
  }

  return course;
}

export function deleteCourse(id: string) {
  const deleted = courseRepository.delete(id);

  if (!deleted) {
    throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
  }

  return true;
}
