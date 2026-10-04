import { buildApp } from './app.js';
import { config } from './config/env.js';

const app = buildApp();

const start = async () => {
  try {
    await app.ready();

    console.log('Registered routes:');
    console.log(app.printRoutes());

    await app.listen({
      port: config.port,
      host: '0.0.0.0',
    });

    console.log(
      `Server running on port ${config.port} in ${config.nodeEnv} mode`,
    );
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
