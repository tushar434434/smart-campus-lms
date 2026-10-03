import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { AppError } from '../src/errors/app-error.js';

describe('Smart Campus LMS API', () => {
  let app: ReturnType<typeof buildApp>;

  afterEach(async () => {
    await app.close();
  });
  it('should retrieve a course by ID', async () => {
    app = buildApp();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/courses',
      payload: {
        title: 'Database Management Systems',
        code: 'CS304',
        credits: 4,
      },
    });

    const createdCourse = createResponse.json().data;

    const response = await app.inject({
      method: 'GET',
      url: `/courses/${createdCourse.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().data.id).toBe(createdCourse.id);
    expect(response.json().data.title).toBe('Database Management Systems');
  });
  it('should create a course with an ID and timestamp', async () => {
    app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/courses',
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
    app = buildApp();

    await app.inject({
      method: 'POST',
      url: '/courses',
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

    expect(response.json().data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Database Management Systems',
          code: 'CS303',
        }),
      ]),
    );
  });

  it('should return healthy status', async () => {
    app = buildApp();

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

  it('should handle application errors', async () => {
    app = buildApp();

    app.get('/test-error', async () => {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    });

    const response = await app.inject({
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
  });

  it('should handle unexpected errors', async () => {
    app = buildApp();

    app.get('/test-server-error', async () => {
      throw new Error('Database connection failed');
    });

    const response = await app.inject({
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
  });

  it('should create a course with valid data', async () => {
    app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/courses',
      payload: {
        title: 'Data Structures',
        code: 'CS301',
        credits: 4,
      },
    });

    expect(response.statusCode).toBe(201);

    expect(response.json()).toMatchObject({
      success: true,
      message: 'Course created successfully',
      data: {
        title: 'Data Structures',
        code: 'CS301',
        credits: 4,
      },
    });
  });

  it('should reject invalid course data', async () => {
    app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/courses',
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
