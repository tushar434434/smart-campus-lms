import { describe, expect, it } from 'vitest';
import {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
} from '../src/modules/courses/course.repository.js';
describe('Course Repository', () => {
  it('should create a course with an ID and timestamp', () => {
    const course = createCourse({
      title: 'Data Structures',
      code: 'CS301',
      credits: 4,
    });

    expect(course).toHaveProperty('id');
    expect(course).toHaveProperty('createdAt');
    expect(course.title).toBe('Data Structures');
    expect(course.code).toBe('CS301');
    expect(course.credits).toBe(4);
  });
  it('should retrieve all courses', () => {
    const course = createCourse({
      title: 'Operating Systems',
      code: 'CS301',
      credits: 4,
    });

    const result = getCourses();

    expect(result).toContainEqual(course);
  });
  it('should retrieve a course by ID', () => {
    const course = createCourse({
      title: 'Operating Systems',
      code: 'CS302',
      credits: 4,
    });

    const result = getCourseById(course.id);

    expect(result).toBeDefined();
    expect(result?.id).toBe(course.id);
    expect(result?.title).toBe('Operating Systems');
  });
  it('should return undefined for a nonexistent course', () => {
    const result = getCourseById('nonexistent-id');

    expect(result).toBeUndefined();
  });
  it('should update a course successfully', () => {
    const course = createCourse({
      title: 'Database Systems',
      code: 'CS303',
      credits: 4,
    });

    const updatedCourse = updateCourse(course.id, {
      title: 'Advanced Database Systems',
    });

    expect(updatedCourse).toBeDefined();
    expect(updatedCourse?.title).toBe('Advanced Database Systems');
    expect(updatedCourse?.code).toBe('CS303');
    expect(updatedCourse?.credits).toBe(4);
  });
  it('should return undefined when updating a nonexistent course', () => {
    const result = updateCourse('nonexistent-id', {
      title: 'Updated Course',
    });

    expect(result).toBeUndefined();
  });
  it('should delete a course successfully', () => {
    const course = createCourse({
      title: 'Computer Networks',
      code: 'CS304',
      credits: 4,
    });

    const result = deleteCourse(course.id);

    expect(result).toBe(true);
    expect(getCourseById(course.id)).toBeUndefined();
  });
  it('should return false when deleting a nonexistent course', () => {
    const result = deleteCourse('nonexistent-id');

    expect(result).toBe(false);
  });
});
