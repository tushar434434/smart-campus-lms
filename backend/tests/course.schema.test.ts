import { describe, expect, it } from 'vitest';

import {
  createCourseSchema,
  updateCourseSchema,
  listCoursesSchema,
} from '../src/modules/courses/course.schema.js';

describe('Create Course Schema', () => {
  const validCourse = {
    title: 'Data Structures',
    code: 'CS301',
    credits: 4,
  };

  it('accepts valid course data', () => {
    expect(createCourseSchema.safeParse(validCourse).success).toBe(true);
  });

  it('trims whitespace from the title and code', () => {
    const result = createCourseSchema.safeParse({
      ...validCourse,
      title: '  Data Structures  ',
      code: '  CS301  ',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.title).toBe('Data Structures');
      expect(result.data.code).toBe('CS301');
    }
  });

  it('rejects a title shorter than 3 characters', () => {
    expect(
      createCourseSchema.safeParse({
        ...validCourse,
        title: 'DS',
      }).success,
    ).toBe(false);
  });

  it('rejects a title longer than 100 characters', () => {
    expect(
      createCourseSchema.safeParse({
        ...validCourse,
        title: 'A'.repeat(101),
      }).success,
    ).toBe(false);
  });

  it('rejects lowercase course codes', () => {
    expect(
      createCourseSchema.safeParse({
        ...validCourse,
        code: 'cs301',
      }).success,
    ).toBe(false);
  });

  it('accepts credits between 1 and 6', () => {
    for (const credits of [1, 2, 3, 4, 5, 6]) {
      expect(
        createCourseSchema.safeParse({
          ...validCourse,
          credits,
        }).success,
      ).toBe(true);
    }
  });

  it('rejects credits outside the allowed range', () => {
    for (const credits of [0, 7, -1]) {
      expect(
        createCourseSchema.safeParse({
          ...validCourse,
          credits,
        }).success,
      ).toBe(false);
    }
  });

  it('rejects fractional credits', () => {
    expect(
      createCourseSchema.safeParse({
        ...validCourse,
        credits: 3.5,
      }).success,
    ).toBe(false);
  });
});

describe('Update Course Schema', () => {
  it('accepts a partial update', () => {
    expect(
      updateCourseSchema.safeParse({ title: 'Operating Systems' }).success,
    ).toBe(true);
  });

  it('rejects an empty update', () => {
    expect(updateCourseSchema.safeParse({}).success).toBe(false);
  });

  it('rejects invalid fields in an update', () => {
    expect(updateCourseSchema.safeParse({ credits: 10 }).success).toBe(false);
  });
});

describe('List Courses Schema', () => {
  it('applies default pagination values', () => {
    expect(listCoursesSchema.parse({})).toMatchObject({
      page: 1,
      limit: 10,
    });
  });

  it('coerces query-string pagination values', () => {
    expect(listCoursesSchema.parse({ page: '2', limit: '20' })).toMatchObject({
      page: 2,
      limit: 20,
    });
  });

  it('rejects limits greater than 100', () => {
    expect(listCoursesSchema.safeParse({ limit: '101' }).success).toBe(false);
  });
});
