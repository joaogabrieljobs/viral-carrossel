// Task 03 — RF-04 (sessão/cookie completo), RF-05 (Google), RF-06 (logout).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));

import { makeReq, makeRes, setCookies, cookieValue } from '../helpers/http.js';
import { createAccessToken, COOKIE_NAME } from '../../api/lib/access.js';
import sessionHandler from '../../api/auth/session.js';
import logoutHandler from '../../api/auth/logout.js';
import googleStartHandler from '../../api/auth/google.js';
import googleCallbackHandler from '../../api/auth/google/callback.js';

const APP = 'https://viral-carrossel.vercel.app';
const cookieFor = (customerId, email) =>
  `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId, email }))}`;

beforeEach(resetStripeMock);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('GET /api/auth/session (RF-04)', () => {
  it('sem cookie → anonymous', async () => {
    const res = makeRes();
    await sessionHandler(makeReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ active: false, status: 'anonymous' });
  });

  it('cookie válido + assinatura ativa → active com currentPeriodEnd', async () => {
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subAtiva('cus_1')] });
    const res = makeRes();
    await sessionHandler(makeReq({ cookie: cookieFor('cus_1', 'user1@teste.exemplo') }), res);
    expect(res.body).toMatchObject({ active: true, email: 'user1@teste.exemplo', status: 'active' });
    expect(res.body.customerId).toBeUndefined();
    expect(typeof res.body.currentPeriodEnd).toBe('string');
  });

  it('cookie válido sem assinatura → inactive', async () => {
    const res = makeRes();
    await sessionHandler(makeReq({ cookie: cookieFor('cus_2', 'user2@teste.exemplo') }), res);
    expect(res.body).toMatchObject({ active: false, status: 'inactive', email: 'user2@teste.exemplo' });
    expect(res.body.customerId).toBeUndefined();
  });

  it('cookie adulterado → anonymous (não vaza erro)', async () => {
    const good = createAccessToken({ customerId: 'cus_3', email: 'user3@teste.exemplo' });
    const bad = good.slice(0, -2) + 'xx';
    const res = makeRes();
    await sessionHandler(makeReq({ cookie: `${COOKIE_NAME}=${encodeURIComponent(bad)}` }), res);
    expect(res.body).toMatchObject({ active: false, status: 'anonymous' });
  });

  it('token com mais de 30 dias expira → anonymous', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() - 31 * 24 * 3600 * 1000);
    const oldCookie = cookieFor('cus_4', 'user4@teste.exemplo');
    vi.useRealTimers();
    const res = makeRes();
    await sessionHandler(makeReq({ cookie: oldCookie }), res);
    expect(res.body).toMatchObject({ active: false, status: 'anonymous' });
  });

  it('método errado → 405', async () => {
    const res = makeRes();
    await sessionHandler(makeReq({ method: 'DELETE' }), res);
    expect(res.statusCode).toBe(405);
  });
});

describe('POST /api/auth/logout (RF-06)', () => {
  it('limpa o cookie (Max-Age=0) e responde ok', async () => {
    const res = makeRes();
    await logoutHandler(makeReq({ method: 'POST', cookie: cookieFor('cus_1', 'user1@teste.exemplo') }), res);
    expect(res.body).toEqual({ ok: true });
    const cleared = setCookies(res).find((c) => c.startsWith(`${COOKIE_NAME}=`));
    expect(cleared).toContain('Max-Age=0');
  });
});

describe('GET /api/auth/google — início (RF-05)', () => {
  it('não configurado → redirect google_unconfigured', async () => {
    const savedId = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.VITE_GOOGLE_CLIENT_ID;
    const res = makeRes();
    await googleStartHandler(makeReq(), res);
    process.env.GOOGLE_CLIENT_ID = savedId;
    expect(res.statusCode).toBe(302);
    expect(res.redirectUrl).toBe(`${APP}/?login=google_unconfigured`);
  });

  it('configurado → 302 para accounts.google.com com state no cookie e na URL', async () => {
    const res = makeRes();
    await googleStartHandler(makeReq(), res);
    expect(res.statusCode).toBe(302);
    expect(res.redirectUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
    const state = cookieValue(res, 'vc_google_oauth');
    expect(state).toBeTruthy();
    expect(new URL(res.redirectUrl).searchParams.get('state')).toBe(state);
  });
});

describe('GET /api/auth/google/callback (RF-05)', () => {
  const stubGoogleFetch = (email = 'assinante@teste.exemplo') =>
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
      if (String(url).includes('oauth2.googleapis.com/token')) {
        return { ok: true, json: async () => ({ access_token: 'ya29.fake' }) };
      }
      if (String(url).includes('openidconnect.googleapis.com/v1/userinfo')) {
        return { ok: true, json: async () => ({ email, email_verified: true }) };
      }
      throw new Error(`fetch inesperado em teste: ${url}`);
    }));

  it('usuário negou permissão → ?login=denied', async () => {
    const res = makeRes();
    await googleCallbackHandler(makeReq({ url: '/api/auth/google/callback?error=access_denied' }), res);
    expect(res.redirectUrl).toBe(`${APP}/?login=denied`);
  });

  it('state divergente do cookie → ?login=invalid_state', async () => {
    const res = makeRes();
    await googleCallbackHandler(
      makeReq({ url: '/api/auth/google/callback?code=abc&state=X', cookie: 'vc_google_oauth=Y' }),
      res,
    );
    expect(res.redirectUrl).toBe(`${APP}/?login=invalid_state`);
  });

  it('conta Google sem assinatura → ?login=no_subscription com e-mail', async () => {
    stubGoogleFetch('semplano@teste.exemplo');
    stripeMock.customers.list.mockResolvedValue({ data: [] });
    const res = makeRes();
    await googleCallbackHandler(
      makeReq({ url: '/api/auth/google/callback?code=abc&state=S', cookie: 'vc_google_oauth=S' }),
      res,
    );
    expect(res.redirectUrl).toBe(`${APP}/?login=no_subscription&email=semplano%40teste.exemplo`);
    expect(cookieValue(res, COOKIE_NAME)).toBeNull();
  });

  it('assinante ativo → cookie vc_access + ?billing=restored&login=google', async () => {
    stubGoogleFetch('assinante@teste.exemplo');
    stripeMock.customers.list.mockResolvedValue({ data: [{ id: 'cus_google_1', email: 'assinante@teste.exemplo' }] });
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subAtiva('cus_google_1')] });
    const res = makeRes();
    await googleCallbackHandler(
      makeReq({ url: '/api/auth/google/callback?code=abc&state=S', cookie: 'vc_google_oauth=S' }),
      res,
    );
    expect(res.redirectUrl).toBe(`${APP}/?billing=restored&login=google`);
    const token = cookieValue(res, COOKIE_NAME);
    expect(token).toBeTruthy();
  });
});
