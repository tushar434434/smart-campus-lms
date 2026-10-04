import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../src/errors/app-error.js';

import { InMemoryCourseRepository } from '../src/modules/courses/course.repository.js';

import {
  deleteCourse,
  getCourseById,
  updateCourse,
} from '../src/modules/courses/course.service.js';

describe('Course Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw a 404 error when deleting a nonexistent course', () => {
    vi.spyOn(InMemoryCourseRepository.prototype, 'delete').mockReturnValue(
      false,
    );

    expect(() => deleteCourse('invalid-id')).toThrow(AppError);

    try {
      deleteCourse('invalid-id');
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 404,
        code: 'COURSE_NOT_FOUND',
        message: 'Course not found',
      });
    }
  });

  it('should delete a course successfully', () => {
    vi.spyOn(InMemoryCourseRepository.prototype, 'delete').mockReturnValue(
      true,
    );

    expect(deleteCourse('course-1')).toBe(true);
  });

  it('should throw a 404 error when updating a nonexistent course', () => {
    vi.spyOn(InMemoryCourseRepository.prototype, 'update').mockReturnValue(
      undefined,
    );

    expect(() =>
      updateCourse('invalid-id', { title: 'Updated Course' }),
    ).toThrow(AppError);
  });

  it('should return the updated course', () => {
    const updatedCourse = {
      id: 'course-1',
      title: 'Updated Course',
      code: 'CS301',
      credits: 4,
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(InMemoryCourseRepository.prototype, 'update').mockReturnValue(
      updatedCourse,
    );

    expect(updateCourse('course-1', { title: 'Updated Course' })).toEqual(
      updatedCourse,
    );
  });

  it('should throw a 404 AppError when course does not exist', () => {
    vi.spyOn(InMemoryCourseRepository.prototype, 'findById').mockReturnValue(
      undefined,
    );

    try {
      getCourseById('invalid-id');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        statusCode: 404,
        code: 'COURSE_NOT_FOUND',
      });
    }
  });

  it('should return a course when it exists', () => {
    const course = {
      id: 'course-1',
      title: 'Data Structures',
      code: 'CS301',
      credits: 4,
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(InMemoryCourseRepository.prototype, 'findById').mockReturnValue(
      course,
    );

    expect(getCourseById('course-1')).toEqual(course);
  });
});
