
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { describe, expect, it } from 'vitest';

describe('Rate Limiting', () => {
  it('should return 429 when the request limit is exceeded', async () => {
    const app = Fastify();

    await app.register(rateLimit, {
      max: 2,
      timeWindow: '1 minute',
    });

    app.get('/test', async () => ({
      success: true,
    }));

    await app.ready();

    try {
      const first = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const second = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const third = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      expect(third.statusCode).toBe(429);
    } finally {
      await app.close();
    }
  });
});
