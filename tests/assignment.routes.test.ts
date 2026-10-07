import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTestContainer } from '../src/test-container.js';
import { buildApp } from '../src/app.js';

describe('Assignment Routes', () => {
  const app = buildApp(createTestContainer());

  let courseId: string;
  let assignmentId: string;
  let facultyToken: string;

  beforeEach(async () => {
    await app.ready();

    facultyToken = app.jwt.sign({
      sub: 'faculty-test-id',
      role: 'faculty',
    });

    const courseResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: {
        title: 'Data Structures',
        code: 'CS301',
        credits: 4,
      },
    });

    courseId = courseResponse.json().data.id;
  });

  it('should create an assignment', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/assignments',
      payload: {
        courseId,
        title: 'Array Assignment',
        description: 'Solve array problems',
        dueAt: '2026-10-20T18:00:00.000Z',
        maxMarks: 100,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.title).toBe('Array Assignment');

    assignmentId = response.json().data.id;
  });

  it('should reject invalid assignment input', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/assignments',
      payload: {
        courseId,
        title: 'A',
        description: 'Bad',
        dueAt: 'invalid-date',
        maxMarks: -10,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject assignment for nonexistent course', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/assignments',
      payload: {
        courseId: randomUUID(),
        title: 'Array Assignment',
        description: 'Solve array problems',
        dueAt: '2026-10-20T18:00:00.000Z',
        maxMarks: 100,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('COURSE_NOT_FOUND');
  });

  it('should retrieve assignments for a course', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/assignments/course/${courseId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toBeInstanceOf(Array);
  });

  it('should return 404 for nonexistent assignment', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/assignments/${randomUUID()}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('ASSIGNMENT_NOT_FOUND');
  });

  it('should update an assignment', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/assignments',
      payload: {
        courseId,
        title: 'Original Assignment',
        description: 'Original description',
        dueAt: '2026-10-20T18:00:00.000Z',
        maxMarks: 100,
      },
    });

    const id = createResponse.json().data.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/assignments/${id}`,
      payload: {
        title: 'Updated Assignment',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.title).toBe('Updated Assignment');
  });

  it('should delete an assignment', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/assignments',
      payload: {
        courseId,
        title: 'Delete Me',
        description: 'Assignment for deletion',
        dueAt: '2026-10-20T18:00:00.000Z',
        maxMarks: 50,
      },
    });

    const id = createResponse.json().data.id;

    const response = await app.inject({
      method: 'DELETE',
      url: `/assignments/${id}`,
    });

    expect(response.statusCode).toBe(204);
  });

  it('should return 404 when deleting nonexistent assignment', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/assignments/${randomUUID()}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('ASSIGNMENT_NOT_FOUND');
  });
});