import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  /** Railway injects PORT; 8787 is the local default (Vite proxies /api and /health to it). */
  PORT: z.coerce.number().int().positive().default(8787),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Optional until accounts land in Phase 2; the game itself runs without a database. */
  DATABASE_URL: z.string().url().optional(),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  /** Built game (Vite output). */
  STATIC_DIR: z.string().default('dist'),
  /** Railway sets this automatically for GitHub deploys. */
  RAILWAY_GIT_COMMIT_SHA: z.string().optional(),
  APP_VERSION: z.string().optional(),
});

/** Load a local .env during development (never overrides real environment variables). */
export function loadDotEnv(): void {
  if (process.env.NODE_ENV === 'production') return;
  try {
    process.loadEnvFile();
  } catch {
    // No .env file; defaults apply.
  }
}

export type Config = z.infer<typeof Env> & { version: string };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // Treat empty strings (e.g. an unset Railway variable) as missing.
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ''));
  const parsed = Env.safeParse(cleaned);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  const c = parsed.data;
  return { ...c, version: c.APP_VERSION ?? c.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev' };
}
