
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTestContainer } from '../src/test-container.js';
import { buildApp } from '../src/app.js';

describe('Course Routes', () => {
  const app = buildApp(createTestContainer());

  let facultyToken: string;
  let adminToken: string;

  beforeEach(async () => {
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

  afterAll(async () => {
    await app.close();
  });

  it('should create a course as faculty', async () => {
    const response = await app.inject({
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

    expect(response.statusCode).toBe(201);
    expect(response.json().data.title).toBe('Data Structures');
    expect(response.json().data.code).toBe('CS301');
  });

  it('should reject invalid course input', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: {
        title: 'DS',
        code: 'cs301',
        credits: 0,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject course creation without authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/courses',
      payload: {
        title: 'Data Structures',
        code: 'CS301',
        credits: 4,
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should list courses publicly', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/courses',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toHaveProperty('courses');
    expect(response.json().data).toHaveProperty('pagination');
  });

  it('should reject invalid pagination parameters', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/courses?page=0',
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
      payload: {
        title: 'Database Systems',
        code: 'CS302',
        credits: 3,
      },
    });

    const id = createResponse.json().data.id;

    const response = await app.inject({
      method: 'GET',
      url: `/courses/${id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.id).toBe(id);
  });

  it('should return 404 for a nonexistent course', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/courses/${randomUUID()}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('COURSE_NOT_FOUND');
  });

  it('should update an existing course as faculty', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: {
        title: 'Operating Systems',
        code: 'CS303',
        credits: 4,
      },
    });

    const id = createResponse.json().data.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/courses/${id}`,
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: {
        title: 'Advanced Operating Systems',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.title).toBe('Advanced Operating Systems');
  });

  it('should reject an empty course update', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: {
        title: 'Computer Networks',
        code: 'CS304',
        credits: 3,
      },
    });

    const id = createResponse.json().data.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/courses/${id}`,
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
      payload: {
        title: 'Computer Architecture',
        code: 'CS305',
        credits: 4,
      },
    });

    const id = createResponse.json().data.id;

    const response = await app.inject({
      method: 'DELETE',
      url: `/courses/${id}`,
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should delete a course as admin', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: {
        authorization: `Bearer ${facultyToken}`,
      },
      payload: {
        title: 'Software Engineering',
        code: 'CS306',
        credits: 3,
      },
    });

    const id = createResponse.json().data.id;

    const response = await app.inject({
      method: 'DELETE',
      url: `/courses/${id}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.id).toBe(id);
  });
});
