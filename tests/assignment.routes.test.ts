import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

import { createTestContainer } from '../src/test-container.js';
import { buildApp } from '../src/app.js';

describe('Assignment Routes', () => {
  const app = buildApp(createTestContainer());

  let facultyToken: string;
  let studentToken: string;
  let adminToken: string;
  let courseId: string;

  // Generate a unique, schema-valid course code.
  let courseCodeCounter = 1000;

  const validAssignment = (id: string) => ({
    courseId: id,
    title: 'Data Structures Assignment',
    description: 'Complete the assigned programming problems',
    dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    maxMarks: 100,
  });

  beforeEach(async () => {
    await app.ready();

    facultyToken = app.jwt.sign({
      sub: 'faculty-test-id',
      role: 'faculty',
    });

    studentToken = app.jwt.sign({
      sub: 'student-test-id',
      role: 'student',
    });

    adminToken = app.jwt.sign({
      sub: 'admin-test-id',
      role: 'admin',
    });

    // CS1001, CS1002, etc. Match /^[A-Z]{2,5}[0-9]{3,4}$/.
    courseCodeCounter += 1;

    const courseResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: {
        title: 'Data Structures',
        code: `CS${courseCodeCounter}`,
        credits: 4,
      },
    });

    expect(
      courseResponse.statusCode,
      `Course setup failed: ${courseResponse.body}`,
    ).toBe(201);

    courseId = courseResponse.json().data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create an assignment', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/assignments',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: validAssignment(courseId),
    });

    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().data.title).toBe('Data Structures Assignment');
  });

  it('should reject invalid assignment input', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/assignments',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: {
        ...validAssignment(courseId),
        title: '',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 for an assignment with a nonexistent course', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/assignments',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: validAssignment(randomUUID()),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('COURSE_NOT_FOUND');
  });

  it('should retrieve assignments for a course', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/assignments',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: validAssignment(courseId),
    });

    expect(createResponse.statusCode, createResponse.body).toBe(201);

    const response = await app.inject({
      method: 'GET',
      url: `/assignments/course/${courseId}`,
      headers: {
        authorization: `Bearer ${studentToken}`,
      },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().data).toHaveLength(1);
  });

  it('should return 404 for a nonexistent assignment', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/assignments/${randomUUID()}`,
      headers: {
        authorization: `Bearer ${studentToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('ASSIGNMENT_NOT_FOUND');
  });

  it('should update an assignment', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/assignments',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: validAssignment(courseId),
    });

    expect(createResponse.statusCode, createResponse.body).toBe(201);

    const assignmentId = createResponse.json().data.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/assignments/${assignmentId}`,
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: {
        title: 'Updated Assignment',
      },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().data.title).toBe('Updated Assignment');
  });

  it('should delete an assignment as an admin', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/assignments',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: validAssignment(courseId),
    });

    expect(createResponse.statusCode, createResponse.body).toBe(201);

    const assignmentId = createResponse.json().data.id;

    const response = await app.inject({
      method: 'DELETE',
      url: `/assignments/${assignmentId}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(204);
  });

  it('should forbid faculty from deleting an assignment', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/assignments/${randomUUID()}`,
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should return 404 when deleting a nonexistent assignment as admin', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/assignments/${randomUUID()}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('ASSIGNMENT_NOT_FOUND');
  });
});
