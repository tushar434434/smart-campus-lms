import { buildApp } from './app.js';
import { createContainer } from './container.js';

const container = createContainer();
const app = buildApp(container);

let shutdownPromise: Promise<void> | undefined;

// Disconnect Prisma whenever Fastify closes.
app.addHook('onClose', async () => {
  await container.prisma.$disconnect();
});

const start = async (): Promise<void> => {
  try {
    await app.listen({
      port: Number(process.env.PORT) || 3000,
      host: process.env.HOST || '0.0.0.0',
    });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;

    try {
      await app.close();
    } catch (closeError) {
      app.log.error(closeError);
    }
  }
};

const shutdown = (signal: string): Promise<void> => {
  // Prevent multiple signals from closing the server repeatedly.
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shutdownPromise = (async () => {
    app.log.info(`Received ${signal}; shutting down gracefully`);

    try {
      await app.close();
      app.log.info('Server closed successfully');
    } catch (error) {
      app.log.error(error);
      process.exitCode = 1;
    }
  })();

  return shutdownPromise;
};

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

await start();
