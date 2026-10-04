import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('uses local defaults', () => {
    const c = loadConfig({});
    expect(c.PORT).toBe(8787);
    expect(c.HOST).toBe('0.0.0.0');
    expect(c.DATABASE_URL).toBeUndefined();
    expect(c.version).toBe('dev');
  });

  it('reads Railway variables', () => {
    const c = loadConfig({ PORT: '3000', DATABASE_URL: 'postgresql://u:p@postgres.railway.internal:5432/railway', RAILWAY_GIT_COMMIT_SHA: '4e62051abcdef' });
    expect(c.PORT).toBe(3000);
    expect(c.DATABASE_URL).toContain('railway.internal');
    expect(c.version).toBe('4e62051');
  });

  it('treats empty variables as unset', () => {
    expect(loadConfig({ DATABASE_URL: '' }).DATABASE_URL).toBeUndefined();
  });

  it('rejects a malformed database URL', () => {
    expect(() => loadConfig({ DATABASE_URL: 'not a url' })).toThrow(/DATABASE_URL/);
  });
});
