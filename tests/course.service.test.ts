import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../src/errors/app-error.js';
import * as courseRepository from '../src/modules/courses/course.repository.js';
import { updateCourse } from '../src/modules/courses/course.service.js';
import { deleteCourse } from '../src/modules/courses/course.service.js';
import { getCourseById } from '../src/modules/courses/course.service.js';
describe('Course Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  it('should throw a 404 error when deleting a nonexistent course', () => {
    vi.spyOn(courseRepository, 'deleteCourse').mockReturnValue(false);

    expect(() => deleteCourse('invalid-id')).toThrow('Course not found');
  });
  it('should delete a course successfully', () => {
    vi.spyOn(courseRepository, 'deleteCourse').mockReturnValue(true);

    const result = deleteCourse('course-123');

    expect(result).toBe(true);
    expect(courseRepository.deleteCourse).toHaveBeenCalledWith('course-123');
  });
  it('should throw a 404 error when updating a nonexistent course', () => {
    vi.spyOn(courseRepository, 'updateCourse').mockReturnValue(undefined);

    expect(() =>
      updateCourse('invalid-id', {
        title: 'Updated Course',
      }),
    ).toThrow('Course not found');
  });
  it('should return the updated course', () => {
    const mockCourse = {
      id: 'course-123',
      title: 'Advanced Operating Systems',
      code: 'CS301',
      credits: 4,
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(courseRepository, 'updateCourse').mockReturnValue(mockCourse);

    const result = updateCourse('course-123', {
      title: 'Advanced Operating Systems',
    });

    expect(result).toEqual(mockCourse);
    expect(courseRepository.updateCourse).toHaveBeenCalledWith('course-123', {
      title: 'Advanced Operating Systems',
    });
  });
  it('should throw a 404 AppError when course does not exist', () => {
    vi.spyOn(courseRepository, 'getCourseById').mockReturnValue(undefined);

    try {
      getCourseById('invalid-id');
      throw new Error('Expected getCourseById to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);

      if (error instanceof AppError) {
        expect(error.statusCode).toBe(404);
        expect(error.code).toBe('COURSE_NOT_FOUND');
        expect(error.message).toBe('Course not found');
      }
    }
  });
  it('should return a course when it exists', () => {
    const mockCourse = {
      id: 'course-123',
      title: 'Operating Systems',
      code: 'CS301',
      credits: 4,
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(courseRepository, 'getCourseById').mockReturnValue(mockCourse);

    const result = getCourseById('course-123');

    expect(result).toEqual(mockCourse);
    expect(courseRepository.getCourseById).toHaveBeenCalledWith('course-123');
  });
});
