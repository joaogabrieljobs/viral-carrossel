import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// MOO-42 — connect-src lista só o que o navegador realmente chama.
// Anthropic, Z.ai e Kimi passam pelos proxies same-origin (/api/anthropic,
// /api/ai/compatible); Stripe é navegação (location.href para a URL do
// checkout/portal), não fetch; Wikimedia não é buscada pelo cliente.
// OpenAI continua: no modo BYOK o navegador chama api.openai.com direto
// (src/utils/ai-client.js). Plausible recebe os eventos de analytics.
const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const vercel = () => JSON.parse(source('vercel.json'));

const connectSrc = () => {
  const csp = vercel().headers
    .flatMap((entry) => entry.headers || [])
    .find((header) => header.key === 'Content-Security-Policy')?.value || '';
  const directive = csp.split(';').map((part) => part.trim()).find((part) => part.startsWith('connect-src')) || '';
  return directive.split(/\s+/).slice(1);
};

describe('CSP connect-src mínimo (MOO-42)', () => {
  it('libera apenas self, OpenAI (BYOK direto) e Plausible', () => {
    expect(connectSrc()).toEqual(["'self'", 'https://api.openai.com', 'https://plausible.io']);
  });

  it('build da Vercel força o proxy da Anthropic — sem ele, api.anthropic.com seria bloqueado', () => {
    expect(vercel().build?.env?.VITE_ANTHROPIC_PROXY).toBe('true');
  });

  it('cliente não chama direto os hosts removidos', () => {
    const client = source('src/utils/ai-client.js');
    for (const host of ['api.z.ai', 'api.moonshot.ai', 'api.stripe.com', 'commons.wikimedia.org']) {
      expect(client).not.toContain(host);
    }
    expect(source('src/lib/billing.js')).not.toMatch(/https:\/\/[a-z.]*stripe\.com/);
  });
});
