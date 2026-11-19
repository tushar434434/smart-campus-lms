import { describe, expect, it } from 'vitest';

import {
  createStudentSchema,
  linkStudentUserSchema,
  listLinkableUsersSchema,
  listStudentsSchema,
  updateStudentSchema,
} from '../src/modules/students/student.schema.js';

describe('createStudentSchema', () => {
  const validStudent = {
    name: 'Tushar Kumar',
    email: 'tushar@example.com',
    enrollmentNumber: 'ENR24001',
    department: 'AI-ML',
    semester: 5,
  };

  it('accepts valid student data', () => {
    expect(createStudentSchema.safeParse(validStudent).success).toBe(true);
  });

  it('trims whitespace from text fields', () => {
    const result = createStudentSchema.safeParse({
      ...validStudent,
      name: '  Tushar Kumar  ',
      email: '  tushar@example.com  ',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.name).toBe('Tushar Kumar');
      expect(result.data.email).toBe('tushar@example.com');
    }
  });

  it('rejects names shorter than 3 characters', () => {
    expect(
      createStudentSchema.safeParse({ ...validStudent, name: 'AB' }).success,
    ).toBe(false);
  });

  it('rejects invalid email addresses', () => {
    expect(
      createStudentSchema.safeParse({
        ...validStudent,
        email: 'invalid-email',
      }).success,
    ).toBe(false);
  });

  it('rejects semesters outside 1–8', () => {
    for (const semester of [0, 9]) {
      expect(
        createStudentSchema.safeParse({ ...validStudent, semester }).success,
      ).toBe(false);
    }
  });

  it('rejects fractional semesters', () => {
    expect(
      createStudentSchema.safeParse({
        ...validStudent,
        semester: 2.5,
      }).success,
    ).toBe(false);
  });
});

describe('listStudentsSchema', () => {
  it('applies pagination defaults', () => {
    expect(listStudentsSchema.parse({})).toEqual({
      page: 1,
      limit: 10,
    });
  });

  describe('listLinkableUsersSchema', () => {
    it('applies pagination defaults and trims search text', () => {
      expect(listLinkableUsersSchema.parse({ search: '  Ada  ' })).toEqual({
        page: 1,
        limit: 10,
        search: 'Ada',
      });
    });

    it('rejects limits greater than 100', () => {
      expect(listLinkableUsersSchema.safeParse({ limit: '101' }).success).toBe(
        false,
      );
    });
  });

  it('coerces pagination query strings to numbers', () => {
    expect(listStudentsSchema.parse({ page: '2', limit: '20' })).toEqual({
      page: 2,
      limit: 20,
    });
  });

  it('rejects a limit greater than 100', () => {
    expect(listStudentsSchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('trims the search query', () => {
    expect(listStudentsSchema.parse({ search: '  Tushar  ' }).search).toBe(
      'Tushar',
    );
  });
});

describe('updateStudentSchema', () => {
  it('accepts a partial update', () => {
    expect(updateStudentSchema.safeParse({ semester: 6 }).success).toBe(true);
  });

  it('rejects an empty update', () => {
    expect(updateStudentSchema.safeParse({}).success).toBe(false);
  });

  it('rejects invalid update fields', () => {
    expect(
      updateStudentSchema.safeParse({ email: 'invalid-email' }).success,
    ).toBe(false);
  });
});

describe('linkStudentUserSchema', () => {
  it('accepts a valid UUID', () => {
    expect(
      linkStudentUserSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
      }).success,
    ).toBe(true);
  });

  it('rejects an invalid UUID', () => {
    expect(
      linkStudentUserSchema.safeParse({ userId: 'invalid-id' }).success,
    ).toBe(false);
  });
});
