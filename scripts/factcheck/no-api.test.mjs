// Guard: every model call in this repo must go through Claude Code on a Claude subscription
// (scripts/factcheck/claude.mjs). These checks fail CI if a direct API path creeps back in.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_ENV, subscriptionEnv } from './claude.mjs';

const root = new URL('../../', import.meta.url).pathname;
const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.(m?[jt]s|tsx?|ya?ml|json)$/.test(f) && !f.endsWith('package-lock.json') && !f.startsWith('src/data/'));
const read = (f) => readFileSync(`${root}${f}`, 'utf8');

describe('no Claude API usage', () => {
  it('has no Anthropic API SDK dependency', () => {
    const pkg = JSON.parse(read('package.json'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(deps).filter((d) => d.startsWith('@anthropic-ai/'))).toEqual([]);
  });

  it('never imports an API client, calls the API host, or reads an API key', () => {
    const offenders = tracked.filter((f) => {
      if (f === 'scripts/factcheck/no-api.test.mjs') return false;
      const src = read(f);
      return (
        /from ['"]@anthropic-ai\/sdk|require\(['"]@anthropic-ai\/sdk|api\.anthropic\.com|secrets\.ANTHROPIC/i.test(src) ||
        /\banthropic_api_key:/.test(src) || // the claude-code-action API-key input
        // ANTHROPIC_API_KEY may appear only in claude.mjs, which removes it from the CLI's environment.
        (f !== 'scripts/factcheck/claude.mjs' && /ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN/.test(src))
      );
    });
    expect(offenders).toEqual([]);
  });

  it('workflows authenticate Claude Code with the subscription token only', () => {
    const workflows = tracked.filter((f) => f.startsWith('.github/workflows/'));
    for (const f of workflows) {
      const src = read(f);
      if (/claude/i.test(src) && /factcheck/.test(src)) expect(src).toContain('secrets.CLAUDE_CODE_OAUTH_TOKEN');
    }
  });

  it('strips API and other-provider credentials before starting Claude Code', () => {
    const env = subscriptionEnv({
      PATH: '/bin',
      CLAUDE_CODE_OAUTH_TOKEN: 'sub',
      ...Object.fromEntries(API_ENV.map((k) => [k, 'x'])),
    });
    expect(env).toEqual({ PATH: '/bin', CLAUDE_CODE_OAUTH_TOKEN: 'sub' });
  });
});
