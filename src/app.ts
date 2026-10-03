import Fastify from 'fastify';
import { successResponse } from './utils/response.js';
import { registerErrorHandler } from './errors/error-handler.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  registerErrorHandler(app);

  app.get('/health', async () => {
    return successResponse('Service is healthy', {
      status: 'ok',
      service: 'smart-campus-lms',
    });
  });

  return app;
}
