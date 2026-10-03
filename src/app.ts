import Fastify from 'fastify';
import { successResponse } from './utils/response.js';
import { registerErrorHandler } from './errors/error-handler.js';
import { courseRoutes } from './modules/courses/course.routes.js';
export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  registerErrorHandler(app);
  app.register(courseRoutes);

  app.get('/health', async () => {
    return successResponse('Service is healthy', {
      status: 'ok',
      service: 'smart-campus-lms',
    });
  });

  return app;
}
