import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createTestContainer } from '../src/test-container.js';

describe('API Integration Tests', () => {
  const app = buildApp(createTestContainer());

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health should return 200 and healthy status', async () => {
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

  it('should return 404 for an unknown route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/this-route-does-not-exist',
    });

    expect(response.statusCode).toBe(404);
  });
});
