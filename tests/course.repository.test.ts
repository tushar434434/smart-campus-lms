import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryCourseRepository } from '../src/modules/courses/course.repository.js';

describe('Course Repository', () => {
  let repository: InMemoryCourseRepository;

  beforeEach(() => {
    repository = new InMemoryCourseRepository();
  });

  it('should create a course with an ID and timestamp', () => {
    const course = repository.create({
      title: 'Data Structures',
      code: 'CS301',
      credits: 4,
    });

    expect(course.id).toBeDefined();
    expect(course.createdAt).toBeDefined();
    expect(course.title).toBe('Data Structures');
  });

  it('should retrieve all courses', () => {
    const course = repository.create({
      title: 'Operating Systems',
      code: 'CS302',
      credits: 4,
    });

    expect(repository.findAll()).toContainEqual(course);
  });

  it('should retrieve a course by ID', () => {
    const course = repository.create({
      title: 'Operating Systems',
      code: 'CS302',
      credits: 4,
    });

    expect(repository.findById(course.id)).toEqual(course);
  });

  it('should return undefined for a nonexistent course', () => {
    expect(repository.findById('nonexistent-id')).toBeUndefined();
  });

  it('should update a course successfully', () => {
    const course = repository.create({
      title: 'Database Systems',
      code: 'CS303',
      credits: 3,
    });

    const updatedCourse = repository.update(course.id, {
      title: 'Advanced Database Systems',
    });

    expect(updatedCourse?.title).toBe('Advanced Database Systems');
    expect(updatedCourse?.code).toBe('CS303');
  });

  it('should return undefined when updating a nonexistent course', () => {
    expect(
      repository.update('nonexistent-id', {
        title: 'Updated Course',
      }),
    ).toBeUndefined();
  });

  it('should delete a course successfully', () => {
    const course = repository.create({
      title: 'Computer Networks',
      code: 'CS304',
      credits: 4,
    });

    expect(repository.delete(course.id)).toBe(true);
    expect(repository.findById(course.id)).toBeUndefined();
  });

  it('should return false when deleting a nonexistent course', () => {
    expect(repository.delete('nonexistent-id')).toBe(false);
  });
});
