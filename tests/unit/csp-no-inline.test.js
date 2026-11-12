import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('CSP sem JavaScript inline', () => {
  it('não libera unsafe-inline para scripts', () => {
    const config = JSON.parse(source('vercel.json'));
    const csp = config.headers
      .flatMap((entry) => entry.headers || [])
      .find((header) => header.key === 'Content-Security-Policy')?.value || '';
    const scriptSrc = csp.split(';').find((part) => part.trim().startsWith('script-src')) || '';
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it('index e autorização usam scripts externos e nenhum javascript: URL', () => {
    expect(source('index.html')).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
    const oauth = source('api/oauth/authorize.js');
    expect(oauth).not.toContain('javascript:');
    expect(oauth).toContain('/oauth-return.js');
  });
});
