import { buildApp } from './app.js';
import { createContainer } from './container.js';

const container = createContainer();
const app = buildApp(container);

const start = async () => {
  try {
    await app.listen({
      port: Number(process.env.PORT) || 3000,
      host: process.env.HOST || '0.0.0.0',
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

await start();
