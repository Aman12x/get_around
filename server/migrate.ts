// Applies pending SQL migrations from drizzle/. Railway runs this as the pre-deploy
// command, so a failing migration stops the deploy before any traffic moves.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { loadConfig, loadDotEnv } from './config';

loadDotEnv();
const config = loadConfig();
const folder = resolve('drizzle');

if (!config.DATABASE_URL) {
  console.warn('[migrate] DATABASE_URL not set; skipping migrations');
  process.exit(0);
}
if (!existsSync(resolve(folder, 'meta', '_journal.json'))) {
  console.log('[migrate] no migrations yet; nothing to do');
  process.exit(0);
}

const sql = postgres(config.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(sql), { migrationsFolder: folder });
  console.log('[migrate] database is up to date');
} catch (err) {
  console.error('[migrate] failed', err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
