import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { createTestContainer } from '../src/test-container.js';
import { AppError } from '../src/errors/app-error.js';

describe('Smart Campus LMS API', () => {
  let app: ReturnType<typeof buildApp>;

  let facultyToken: string;
  let studentToken: string;
  let adminToken: string;

  beforeEach(async () => {
    app = buildApp(createTestContainer());

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
  });

  afterEach(async () => {
    await app.close();
  });

  const authHeaders = (token: string) => ({
    authorization: `Bearer ${token}`,
  });

  // Course listing validation

  it('should reject an invalid page number', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/courses?page=0',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject a limit greater than 100', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/courses?limit=101',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject invalid course credits filter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/courses?credits=10',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  // Authentication and authorization

  it('should reject course creation without a token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/courses',
      payload: {
        title: 'Computer Networks',
        code: 'CS307',
        credits: 4,
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should reject course creation by a student', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: authHeaders(studentToken),
      payload: {
        title: 'Computer Networks',
        code: 'CS307',
        credits: 4,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  // Course deletion

  it('should return 404 when deleting a nonexistent course', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/courses/nonexistent-id',
      headers: authHeaders(adminToken),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().success).toBe(false);
    expect(response.json().error.code).toBe('COURSE_NOT_FOUND');
  });

  it('should delete a course successfully', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: authHeaders(facultyToken),
      payload: {
        title: 'Computer Networks',
        code: 'CS307',
        credits: 4,
      },
    });

    expect(createResponse.statusCode).toBe(201);

    const createdCourse = createResponse.json().data;

    const response = await app.inject({
      method: 'DELETE',
      url: `/courses/${createdCourse.id}`,
      headers: authHeaders(adminToken),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().message).toBe('Course deleted successfully');
    expect(response.json().data.id).toBe(createdCourse.id);

    const getResponse = await app.inject({
      method: 'GET',
      url: `/courses/${createdCourse.id}`,
    });

    expect(getResponse.statusCode).toBe(404);
  });

  // Course update

  it('should reject invalid course update data', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: authHeaders(facultyToken),
      payload: {
        title: 'Operating Systems',
        code: 'CS306',
        credits: 4,
      },
    });

    expect(createResponse.statusCode).toBe(201);

    const createdCourse = createResponse.json().data;

    const response = await app.inject({
      method: 'PATCH',
      url: `/courses/${createdCourse.id}`,
      headers: authHeaders(facultyToken),
      payload: {
        credits: 10,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 when updating a nonexistent course', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/courses/nonexistent-id',
      headers: authHeaders(facultyToken),
      payload: {
        credits: 5,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('COURSE_NOT_FOUND');
  });

  it('should reject an empty course update', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/courses/some-course-id',
      headers: authHeaders(facultyToken),
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('should update a course successfully', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: authHeaders(facultyToken),
      payload: {
        title: 'Database Management Systems',
        code: 'CS305',
        credits: 3,
      },
    });

    expect(createResponse.statusCode).toBe(201);

    const createdCourse = createResponse.json().data;

    const response = await app.inject({
      method: 'PATCH',
      url: `/courses/${createdCourse.id}`,
      headers: authHeaders(facultyToken),
      payload: {
        credits: 5,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().data.credits).toBe(5);
    expect(response.json().data.title).toBe(
      'Database Management Systems',
    );
  });

  // Course retrieval

  it('should retrieve a course by ID', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: authHeaders(facultyToken),
      payload: {
        title: 'Database Management Systems',
        code: 'CS304',
        credits: 4,
      },
    });

    expect(createResponse.statusCode).toBe(201);

    const createdCourse = createResponse.json().data;

    const response = await app.inject({
      method: 'GET',
      url: `/courses/${createdCourse.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().data.id).toBe(createdCourse.id);
    expect(response.json().data.title).toBe(
      'Database Management Systems',
    );
  });

  it('should create a course with an ID and timestamp', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: authHeaders(facultyToken),
      payload: {
        title: 'Operating Systems',
        code: 'CS302',
        credits: 4,
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.createdAt).toBeDefined();
    expect(body.data.title).toBe('Operating Systems');
  });

  it('should retrieve courses', async () => {
    await app.inject({
      method: 'POST',
      url: '/courses',
      headers: authHeaders(facultyToken),
      payload: {
        title: 'Database Management Systems',
        code: 'CS303',
        credits: 4,
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/courses',
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toMatchObject({
      success: true,
      message: 'Courses retrieved successfully',
    });

    const data = response.json().data;

    expect(data.courses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Database Management Systems',
          code: 'CS303',
        }),
      ]),
    );

    expect(data.pagination).toMatchObject({
      page: 1,
      limit: 10,
      total: data.courses.length,
      totalPages: 1,
    });
  });

  // Health check

  it('should return healthy status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toMatchObject({
      success: true,
      message: 'Service is healthy',
      data: {
        status: 'ok',
        service: 'smart-campus-lms',
      },
    });
  });

  // Error handling

  it('should handle application errors', async () => {
    const testApp = buildApp(createTestContainer());

    testApp.get('/test-error', async () => {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    });

    await testApp.ready();

    const response = await testApp.inject({
      method: 'GET',
      url: '/test-error',
    });

    expect(response.statusCode).toBe(404);

    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: 'COURSE_NOT_FOUND',
        message: 'Course not found',
      },
    });

    await testApp.close();
  });

  it('should handle unexpected errors', async () => {
    const testApp = buildApp(createTestContainer());

    testApp.get('/test-server-error', async () => {
      throw new Error('Database connection failed');
    });

    await testApp.ready();

    const response = await testApp.inject({
      method: 'GET',
      url: '/test-server-error',
    });

    expect(response.statusCode).toBe(500);

    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });

    await testApp.close();
  });

  // Course creation validation

  it('should create a course with valid data', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: authHeaders(facultyToken),
      payload: {
        title: 'Data Structures',
        code: 'CS998',
        credits: 4,
      },
    });

    expect(
      response.statusCode,
      `Response body: ${response.body}`,
    ).toBe(201);

    expect(response.json()).toMatchObject({
      success: true,
      message: 'Course created successfully',
      data: {
        title: 'Data Structures',
        code: 'CS998',
        credits: 4,
      },
    });
  });

  it('should reject invalid course data', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/courses',
      headers: authHeaders(facultyToken),
      payload: {
        title: 'DS',
        code: 'cs301',
        credits: 0,
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
      },
    });
  });
});