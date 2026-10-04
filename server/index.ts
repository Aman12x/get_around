import { buildApp } from './app';
import { loadConfig, loadDotEnv } from './config';
import { createDatabase } from './db/client';

loadDotEnv();
const config = loadConfig();
const database = config.DATABASE_URL ? createDatabase(config.DATABASE_URL, config.DB_POOL_MAX) : null;

const app = await buildApp({
  staticDir: config.STATIC_DIR,
  version: config.version,
  db: database,
  logger: { level: config.LOG_LEVEL },
});

if (!database) app.log.warn('DATABASE_URL not set; running without a database');

// Railway sends SIGTERM on redeploys: stop accepting connections, finish in-flight requests, close the pool.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    app.log.info({ signal }, 'shutting down');
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  });
}

await app.listen({ port: config.PORT, host: config.HOST });
app.log.info({ version: config.version, env: config.NODE_ENV }, 'Get Around server ready');
