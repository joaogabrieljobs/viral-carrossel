// Task 05 — RF-12/13/14 + gate do proxy IA (DEC-005).
// Regressão dos endurecimentos de 2026-08-07: reintroduzir o problema quebra a suíte.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));

import { makeReq, makeRes } from '../helpers/http.js';
import { createAccessToken, billingDisabled, COOKIE_NAME } from '../../api/lib/access.js';
import sessionHandler from '../../api/auth/session.js';
import anthropicProxy from '../../api/anthropic/v1/messages.js';

const APP = 'https://viral-carrossel.vercel.app';

beforeEach(resetStripeMock);

afterEach(() => {
  vi.unstubAllGlobals();
  // restaura env padrão da suíte
  process.env.ACCESS_COOKIE_SECRET = 'test-secret-suite-confianca-nao-usar-em-producao';
  delete process.env.BILLING_DISABLED;
  delete process.env.VERCEL_ENV;
  delete process.env.ANTHROPIC_API_KEY;
});

describe('RF-12 — CORS allowlist nos endpoints de billing', () => {
  it('origin desconhecido NÃO recebe Access-Control-Allow-Origin (nem credentials)', async () => {
    const res = makeRes();
    await sessionHandler(makeReq({ headers: { origin: 'https://site-malicioso.exemplo' } }), res);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('origin da allowlist (APP_URL) recebe ACAO + credentials + Vary: Origin', async () => {
    const res = makeRes();
    await sessionHandler(makeReq({ headers: { origin: APP } }), res);
    expect(res.headers['access-control-allow-origin']).toBe(APP);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers.vary).toBe('Origin');
  });

  it('domínio próprio viralcarrossel.com.br está na allowlist', async () => {
    const origin = 'https://viralcarrossel.com.br';
    const res = makeRes();
    await sessionHandler(makeReq({ headers: { origin } }), res);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });
});

describe('RF-13 — cookie secret obrigatória', () => {
  it('sem ACCESS_COOKIE_SECRET, emitir token lança (sem fallback pra STRIPE_SECRET_KEY)', () => {
    delete process.env.ACCESS_COOKIE_SECRET;
    // STRIPE_SECRET_KEY continua setada — o fallback antigo usaria ela.
    expect(process.env.STRIPE_SECRET_KEY).toBeTruthy();
    expect(() => createAccessToken({ customerId: 'cus_x', email: 'x@teste.exemplo' }))
      .toThrow('ACCESS_COOKIE_SECRET em falta');
  });
});

describe('RF-14 — BILLING_DISABLED não vale em produção', () => {
  it('flag ligada em produção (VERCEL_ENV) é ignorada', async () => {
    process.env.BILLING_DISABLED = 'true';
    process.env.VERCEL_ENV = 'production';
    expect(billingDisabled()).toBe(false);
    const res = makeRes();
    await sessionHandler(makeReq(), res);
    expect(res.body).toMatchObject({ active: false, status: 'anonymous' });
  });

  it('flag ligada fora de produção libera com transparência (billingDisabled: true)', async () => {
    process.env.BILLING_DISABLED = 'true';
    const res = makeRes();
    await sessionHandler(makeReq(), res);
    expect(res.body).toMatchObject({ active: true, billingDisabled: true, status: 'disabled' });
  });
});

describe('Gate do proxy Anthropic (assinatura obrigatória)', () => {
  const stubUpstream = () => {
    const fn = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => '{"content":[{"type":"text","text":"ok"}]}',
      headers: { get: () => 'application/json' },
    });
    vi.stubGlobal('fetch', fn);
    return fn;
  };

  const cookieAtivo = (customerId = 'cus_ok', email = 'ok@teste.exemplo') => {
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subAtiva(customerId)] });
    return `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId, email }))}`;
  };

  it('anônimo sem chave própria NÃO consome a chave do host → 401', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-chave-do-host';
    stubUpstream();
    const res = makeRes();
    await anthropicProxy(makeReq({ method: 'POST', body: {} }), res);
    expect(res.statusCode).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('assinante com sessão usa a chave do host', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-chave-do-host';
    const spy = stubUpstream();
    const cookie = cookieAtivo();
    const res = makeRes();
    await anthropicProxy(makeReq({ method: 'POST', body: {}, cookie }), res);
    expect(res.statusCode).toBe(200);
    expect(spy.mock.calls[0][1].headers['x-api-key']).toBe('sk-ant-chave-do-host');
  });

  it('BYOK sem sessão é rejeitado → 401', async () => {
    stubUpstream();
    const res = makeRes();
    await anthropicProxy(
      makeReq({ method: 'POST', body: {}, headers: { 'x-anthropic-key': 'sk-ant-do-usuario' } }),
      res,
    );
    expect(res.statusCode).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('BYOK com sessão ativa usa a chave do utilizador', async () => {
    const spy = stubUpstream();
    const cookie = cookieAtivo('cus_byok', 'byok@teste.exemplo');
    const res = makeRes();
    await anthropicProxy(
      makeReq({
        method: 'POST',
        body: {},
        cookie,
        headers: { 'x-anthropic-key': 'sk-ant-do-usuario' },
      }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(spy.mock.calls[0][1].headers['x-api-key']).toBe('sk-ant-do-usuario');
  });

  it('cookie sem assinatura ativa → 402', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-chave-do-host';
    stubUpstream();
    stripeMock.subscriptions.list.mockResolvedValue({ data: [] });
    const cookie = `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId: 'cus_off', email: 'off@teste.exemplo' }))}`;
    const res = makeRes();
    await anthropicProxy(makeReq({ method: 'POST', body: {}, cookie }), res);
    expect(res.statusCode).toBe(402);
    expect(fetch).not.toHaveBeenCalled();
  });
});
