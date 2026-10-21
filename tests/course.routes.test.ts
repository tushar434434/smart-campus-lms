
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { randomUUID } from 'node:crypto';

import { createTestContainer } from '../src/test-container.js';
import { buildApp } from '../src/app.js';

describe('Course Routes', () => {
  let app: ReturnType<typeof buildApp>;
  let facultyToken: string;
  let adminToken: string;

  beforeEach(async () => {
    app = buildApp(createTestContainer());
    await app.ready();

    facultyToken = app.jwt.sign({
      sub: 'faculty-test-id',
      role: 'faculty',
    });

    adminToken = app.jwt.sign({
      sub: 'admin-test-id',
      role: 'admin',
    });
  });

  afterEach(async () => {
    await app.close();
  });

  // Course codes must match: 2-5 uppercase letters followed by 3-4 digits.
  const validCourse = () => ({
    title: 'Data Structures',
    code: `CS${Math.floor(100 + Math.random() * 900)}`,
    credits: 4,
  });

  it('should create a course as faculty', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: validCourse(),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().success).toBe(true);
  });

  it('should reject invalid course input', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: {
        title: 'A',
        code: 'invalid',
        credits: 10,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject unauthenticated course creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/courses',
      payload: validCourse(),
    });

    expect(response.statusCode).toBe(401);
  });

  it('should list courses publicly', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/courses',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
  });

  it('should reject invalid pagination parameters', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/courses?page=0&limit=101',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should retrieve an existing course', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: validCourse(),
    });

    expect(createResponse.statusCode).toBe(201);

    const courseId = createResponse.json().data.id;

    const response = await app.inject({
      method: 'GET',
      url: `/courses/${courseId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.id).toBe(courseId);
  });

  it('should return 404 for a nonexistent course', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/courses/${randomUUID()}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('COURSE_NOT_FOUND');
  });

  it('should update an existing course', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: validCourse(),
    });

    expect(createResponse.statusCode).toBe(201);

    const courseId = createResponse.json().data.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/courses/${courseId}`,
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: {
        title: 'Advanced Data Structures',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.title).toBe(
      'Advanced Data Structures',
    );
  });

  it('should reject an empty course update', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: validCourse(),
    });

    expect(createResponse.statusCode).toBe(201);

    const courseId = createResponse.json().data.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/courses/${courseId}`,
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should forbid faculty from deleting a course', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: validCourse(),
    });

    expect(createResponse.statusCode).toBe(201);

    const courseId = createResponse.json().data.id;

    const response = await app.inject({
      method: 'DELETE',
      url: `/courses/${courseId}`,
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should allow admin to delete a course', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: validCourse(),
    });

    expect(createResponse.statusCode).toBe(201);

    const courseId = createResponse.json().data.id;

    const response = await app.inject({
      method: 'DELETE',
      url: `/courses/${courseId}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
  });

  it('should reject a duplicate course code', async () => {
    const courseInput = {
      title: 'Computer Networks',
      code: 'CS301',
      credits: 4,
    };

    const firstResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: courseInput,
    });

    expect(firstResponse.statusCode).toBe(201);

    const secondResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: courseInput,
    });

    expect(secondResponse.statusCode).toBe(409);
    expect(secondResponse.json().error.code).toBe(
      'COURSE_CODE_EXISTS',
    );
  });

  it('should return 404 when updating a nonexistent course', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/courses/${randomUUID()}`,
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: {
        title: 'Updated Course',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('COURSE_NOT_FOUND');
  });

  it('should return 404 when deleting a nonexistent course', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/courses/${randomUUID()}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('COURSE_NOT_FOUND');
  });
});
