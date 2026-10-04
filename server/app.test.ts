import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'get-around-static-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Get Around</title>');
  writeFileSync(join(dir, 'assets', 'index-abc123.js'), 'console.log("game");'.repeat(100));
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('health check', () => {
  it('is ok without a database', async () => {
    const app = await buildApp({ staticDir: dir, version: 'test' });
    const res = await app.inject('/health');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', db: 'disabled', version: 'test' });
    expect(res.headers['cache-control']).toBe('no-store');
    await app.close();
  });

  it('pings the database when one is configured', async () => {
    const app = await buildApp({ staticDir: dir, version: 'test', db: { ping: async () => {}, close: async () => {} } });
    expect((await app.inject('/health')).json()).toMatchObject({ status: 'ok', db: 'ok' });
    await app.close();
  });

  it('fails with 503 when the database is unreachable', async () => {
    const db = { ping: async () => Promise.reject(new Error('ECONNREFUSED')), close: async () => {} };
    const app = await buildApp({ staticDir: dir, version: 'test', db });
    const res = await app.inject('/health');
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'degraded', db: 'down' });
    await app.close();
  });
});

describe('static game hosting', () => {
  it('serves the game shell without long-term caching', async () => {
    const app = await buildApp({ staticDir: dir, version: 'test' });
    const res = await app.inject('/');
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Get Around');
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    await app.close();
  });

  it('caches fingerprinted assets forever and compresses them', async () => {
    const app = await buildApp({ staticDir: dir, version: 'test' });
    const res = await app.inject({ url: '/assets/index-abc123.js', headers: { 'accept-encoding': 'gzip' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(res.headers['content-encoding']).toBe('gzip');
    await app.close();
  });

  it('falls back to the game shell for unknown pages but not for the API', async () => {
    const app = await buildApp({ staticDir: dir, version: 'test' });
    const page = await app.inject({ url: '/some/deep/link', headers: { accept: 'text/html' } });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('Get Around');
    const api = await app.inject({ url: '/api/nope', headers: { accept: 'text/html' } });
    expect(api.statusCode).toBe(404);
    expect(api.json()).toEqual({ error: 'Not Found' });
    await app.close();
  });

  it('reports its version over the API', async () => {
    const app = await buildApp({ staticDir: dir, version: 'abc1234' });
    expect((await app.inject('/api/version')).json()).toEqual({ version: 'abc1234' });
    await app.close();
  });
});
