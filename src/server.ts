import { buildApp } from './app.js';
import { createContainer } from './container.js';

const container = createContainer();
const app = buildApp(container);

// Disconnect Prisma when Fastify closes.
app.addHook('onClose', async () => {
  await container.prisma.$disconnect();
});

const start = async () => {
  try {
    await app.listen({
      port: Number(process.env.PORT) || 3000,
      host: process.env.HOST || '0.0.0.0',
    });
  } catch (error) {
    app.log.error(error);
    await app.close();
    process.exitCode = 1;
  }
};

const shutdown = async (signal: string) => {
  app.log.info(`Received ${signal}; shutting down gracefully`);

  try {
    await app.close();
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

await start();
