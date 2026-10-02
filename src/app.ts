import Fastify from 'fastify';
import { registerErrorHandler } from './errors/error-handler.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  registerErrorHandler(app);

  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'smart-campus-lms',
    };
  });

  return app;
}
