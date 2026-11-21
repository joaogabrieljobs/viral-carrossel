import { afterEach, describe, expect, it, vi } from 'vitest';

// MOO-03 (auditoria 20/11): um <form> em outro site fazia POST em
// /api/auth/login com a senha do atacante e o navegador gravava o cookie de
// sessão; a vítima passava a usar a conta do atacante (CSRF de login).
vi.mock('../../api/lib/rate-limit.js', async (original) => ({
  ...(await original()),
  consumeRateLimit: vi.fn(async () => { throw Object.assign(new Error('passou da checagem de origem'), { passed: true }); }),
}));

const ROUTES = {
  login: () => import('../../api/auth/login.js'),
  register: () => import('../../api/auth/register.js'),
  'forgot-password': () => import('../../api/auth/forgot-password.js'),
  'reset-password': () => import('../../api/auth/reset-password.js'),
  'stripe/checkout': () => import('../../api/stripe/checkout.js'),
  'stripe/confirm': () => import('../../api/stripe/confirm.js'),
  logout: () => import('../../api/auth/logout.js'),
  'stripe/portal': () => import('../../api/stripe/portal.js'),
};
const JSON_ROUTES = ['login', 'register', 'forgot-password', 'reset-password', 'stripe/checkout', 'stripe/confirm'];

function res() {
  const out = { statusCode: 200, headers: {}, body: undefined };
  out.setHeader = (k, v) => { out.headers[k.toLowerCase()] = v; };
  out.getHeader = k => out.headers[k.toLowerCase()];
  out.status = code => { out.statusCode = code; return out; };
  out.json = body => { out.body = body; return out; };
  out.end = () => out;
  out.send = body => { out.body = body; return out; };
  return out;
}
const req = headers => ({ method: 'POST', url: '/', headers, body: { email: 'a@b.test', password: 'x'.repeat(10) }, socket: {} });
async function call(route, headers) {
  const { default: handler } = await ROUTES[route]();
  const r = res();
  try { await handler(req(headers), r); } catch (error) { if (!error.passed) throw error; r.passed = true; }
  return r;
}

afterEach(() => vi.clearAllMocks());

describe('MOO-03 — rotas de sessão e cobrança recusam formulário de outro site', () => {
  it.each(Object.keys(ROUTES))('%s: Origin de outro site → 403 sem cookie', async (route) => {
    const r = await call(route, { origin: 'https://evil.example', 'content-type': 'application/json' });
    expect(r.statusCode).toBe(403);
    expect(r.headers['set-cookie']).toBeUndefined();
  });

  it.each(Object.keys(ROUTES))('%s: Sec-Fetch-Site cross-site → 403', async (route) => {
    const r = await call(route, { 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' });
    expect(r.statusCode).toBe(403);
  });

  it.each(JSON_ROUTES)('%s: corpo de formulário → 415', async (route) => {
    const r = await call(route, { origin: 'https://moont.ai', 'content-type': 'application/x-www-form-urlencoded' });
    expect(r.statusCode).toBe(415);
  });

  it.each(Object.keys(ROUTES))('%s: mesma origem com JSON segue adiante', async (route) => {
    const r = await call(route, { origin: 'https://moont.ai', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' });
    expect([403, 415]).not.toContain(r.statusCode);
  });
});
