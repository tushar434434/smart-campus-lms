import { describe, it, expect } from 'vitest';
import { AppError } from '../src/errors/app-error.js';
import { buildApp } from '../src/app.js';

describe('Smart Campus LMS API', () => {
  it('should return healthy status', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      message: 'Service is healthy',
      data: {
        status: 'ok',
        service: 'smart-campus-lms',
      },
    });

    await app.close();
  });

  it('should return 404 for application errors', async () => {
    const app = buildApp();

    app.get('/test-error', async () => {
      throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test-error',
    });

    expect(response.statusCode).toBe(404);

    expect(response.json()).toEqual({
      success: false,
      error: {
        code: 'COURSE_NOT_FOUND',
        message: 'Course not found',
      },
    });

    await app.close();
  });

  it('should return 500 for unexpected errors', async () => {
    const app = buildApp();

    app.get('/test-server-error', async () => {
      throw new Error('Database connection failed');
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test-server-error',
    });

    expect(response.statusCode).toBe(500);

    expect(response.json()).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });

    await app.close();
  });
});
