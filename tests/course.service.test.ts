import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../src/errors/app-error.js';

import { InMemoryCourseRepository } from '../src/modules/courses/course.repository.js';

import { createCourseService } from '../src/modules/courses/course.service.js';

describe('Course Service', () => {
  let repository: InMemoryCourseRepository;
  let service: ReturnType<typeof createCourseService>;

  beforeEach(() => {
    vi.restoreAllMocks();

    repository = new InMemoryCourseRepository();
    service = createCourseService(repository);
  });

  it('should throw a 404 error when deleting a nonexistent course', async () => {
    vi.spyOn(InMemoryCourseRepository.prototype, 'delete').mockResolvedValue(
      false,
    );

    await expect(service.delete('invalid-id')).rejects.toBeInstanceOf(AppError);

    try {
      await service.delete('invalid-id');
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 404,
        code: 'COURSE_NOT_FOUND',
        message: 'Course not found',
      });
    }
  });

  it('should delete a course successfully', async () => {
    vi.spyOn(InMemoryCourseRepository.prototype, 'delete').mockResolvedValue(
      true,
    );

    await expect(service.delete('course-1')).resolves.toBe(true);
  });

  it('should throw a 404 error when updating a nonexistent course', async () => {
    vi.spyOn(InMemoryCourseRepository.prototype, 'update').mockResolvedValue(
      undefined,
    );

    await expect(
      service.update('invalid-id', {
        title: 'Updated Course',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should return the updated course', async () => {
    const updatedCourse = {
      id: 'course-1',
      title: 'Updated Course',
      code: 'CS301',
      credits: 4,
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(InMemoryCourseRepository.prototype, 'update').mockResolvedValue(
      updatedCourse,
    );

    await expect(
      service.update('course-1', {
        title: 'Updated Course',
      }),
    ).resolves.toEqual(updatedCourse);
  });

  it('should throw a 404 AppError when course does not exist', async () => {
    vi.spyOn(InMemoryCourseRepository.prototype, 'findById').mockResolvedValue(
      undefined,
    );

    await expect(service.getById('invalid-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'COURSE_NOT_FOUND',
      message: 'Course not found',
    });
  });

  it('should return a course when it exists', async () => {
    const course = {
      id: 'course-1',
      title: 'Data Structures',
      code: 'CS301',
      credits: 4,
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(InMemoryCourseRepository.prototype, 'findById').mockResolvedValue(
      course,
    );

    await expect(service.getById('course-1')).resolves.toEqual(course);
  });
});
