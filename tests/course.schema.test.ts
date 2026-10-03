import { describe, expect, it } from 'vitest';
import { createCourseSchema } from '../src/modules/courses/course.schema.js';

describe('Create Course Schema', () => {
  it('should accept valid course data', () => {
    const result = createCourseSchema.safeParse({
      title: 'Data Structures',
      code: 'CS301',
      credits: 4,
    });

    expect(result.success).toBe(true);
  });

  it('should reject a short course title', () => {
    const result = createCourseSchema.safeParse({
      title: 'DS',
      code: 'CS301',
      credits: 4,
    });

    expect(result.success).toBe(false);
  });

  it('should reject an invalid course code', () => {
    const result = createCourseSchema.safeParse({
      title: 'Data Structures',
      code: 'cs301',
      credits: 4,
    });

    expect(result.success).toBe(false);
  });

  it('should reject invalid credits', () => {
    const result = createCourseSchema.safeParse({
      title: 'Data Structures',
      code: 'CS301',
      credits: 0,
    });

    expect(result.success).toBe(false);
  });
});
