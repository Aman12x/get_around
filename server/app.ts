import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';

export interface Pingable {
  ping(): Promise<void>;
  close(): Promise<void>;
}

export interface AppOptions {
  staticDir: string;
  version: string;
  db?: Pingable | null;
  logger?: FastifyServerOptions['logger'];
}

const HEALTH_DB_TIMEOUT_MS = 2000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

/** Cache policy: Vite's fingerprinted files never change; everything else revalidates. */
function cacheControlFor(filePath: string): string {
  if (filePath.includes(`${sep}assets${sep}`)) return 'public, max-age=31536000, immutable';
  if (filePath.endsWith('.html')) return 'no-cache';
  return 'public, max-age=86400';
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? false,
    // Railway terminates TLS at its proxy; trust X-Forwarded-* for client IPs and protocol.
    trustProxy: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // Inline style attributes carry per-country colours (style="--c:…").
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
        // Railway is HTTPS-only already; upgrading would break plain-http local runs.
        upgradeInsecureRequests: null,
      },
    },
  });
  await app.register(compress, { global: true, threshold: 1024 });

  app.get('/health', async (_req, reply) => {
    let db: 'ok' | 'down' | 'disabled' = 'disabled';
    if (opts.db) {
      try {
        await withTimeout(opts.db.ping(), HEALTH_DB_TIMEOUT_MS);
        db = 'ok';
      } catch (err) {
        app.log.error({ err }, 'database health check failed');
        db = 'down';
      }
    }
    reply.header('cache-control', 'no-store');
    // A configured-but-unreachable database fails the check so a broken deploy never goes live.
    return reply.code(db === 'down' ? 503 : 200).send({
      status: db === 'down' ? 'degraded' : 'ok',
      version: opts.version,
      uptime: Math.round(process.uptime()),
      db,
    });
  });

  // API routes are registered under /api from Phase 2 onwards.
  await app.register(
    async (api) => {
      api.get('/version', async () => ({ version: opts.version }));
    },
    { prefix: '/api' },
  );

  const root = resolve(opts.staticDir);
  const hasStatic = existsSync(resolve(root, 'index.html'));
  if (hasStatic) {
    await app.register(fastifyStatic, {
      root,
      cacheControl: false,
      setHeaders: (reply, filePath) => void reply.header('cache-control', cacheControlFor(filePath)),
    });
  } else {
    app.log.warn({ root }, 'no built game found; run `npm run build` (API still serves)');
  }

  app.setNotFoundHandler((req, reply) => {
    const wantsPage = req.method === 'GET' && !req.url.startsWith('/api/') && (req.headers.accept ?? '').includes('text/html');
    if (hasStatic && wantsPage) {
      // Single-page app: unknown paths get the game shell.
      return reply.header('cache-control', 'no-cache').sendFile('index.html');
    }
    return reply.code(404).send({ error: 'Not Found' });
  });

  app.addHook('onClose', async () => {
    await opts.db?.close();
  });

  return app;
}
