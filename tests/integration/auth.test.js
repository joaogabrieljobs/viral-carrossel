// Task 03 — RF-04 (sessão/cookie completo), RF-05 (Google), RF-06 (logout).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));
vi.mock('../../api/lib/library-sync-store.js', () => ({
  getLibrarySyncMeta: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../api/lib/library-sync-postgres.js', () => ({
  getLibrarySyncMeta: vi.fn().mockResolvedValue(null),
}));

import { makeReq, makeRes, setCookies, cookieValue } from '../helpers/http.js';
import {
  createAccessToken, COOKIE_NAME, CHECKOUT_IDENTITY_COOKIE, readCheckoutIdentityCookie,
  readCurrentAccessCookie, setCheckoutIdentityCookie, setCheckoutCookie,
} from '../../api/lib/access.js';
import { getAuthRecord, hashPassword } from '../../api/lib/password-auth.js';
import sessionHandler from '../../api/auth/session.js';
import logoutHandler from '../../api/auth/logout.js';
import googleStartHandler from '../../api/auth/google.js';
import googleCallbackHandler from '../../api/auth/google/callback.js';
import loginHandler from '../../api/auth/login.js';
import registerHandler from '../../api/auth/register.js';
import checkoutHandler from '../../api/stripe/checkout.js';
import confirmHandler from '../../api/stripe/confirm.js';
import { getLibrarySyncMeta } from '../../api/lib/library-sync-store.js';
import { getLibrarySyncMeta as getPostgresLibrarySyncMeta } from '../../api/lib/library-sync-postgres.js';
import { requireActiveSubscription, resetActiveAccessCacheForTests } from '../../api/lib/require-access.js';

const APP = 'https://moont.ai';
const cookieFor = (customerId, email) =>
  `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId, email }))}`;
const checkoutIdentityFrom = (res) => {
  const cookie = setCookies(res).filter((entry) => entry.startsWith(`${CHECKOUT_IDENTITY_COOKIE}=`)).at(-1);
  return cookie ? readCheckoutIdentityCookie(makeReq({ cookie: cookie.split(';')[0] })) : null;
};

beforeEach(() => {
  resetStripeMock();
  getLibrarySyncMeta.mockReset().mockResolvedValue(null);
  getPostgresLibrarySyncMeta.mockReset().mockResolvedValue(null);
  resetActiveAccessCacheForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it('login falha fechado em produção quando não há limitador partilhado', async () => {
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('RATE_LIMIT_BACKEND', '');
  vi.stubEnv('UPSTASH_DISABLED', '1');
  const res = makeRes();
  await loginHandler(makeReq({ method: 'POST', body: {
    email: 'pessoa@teste.exemplo', password: 'SenhaSegura123',
  } }), res);
  expect(res.statusCode).toBe(503);
  expect(res.body).toMatchObject({ code: 'rate_limit_unavailable' });
  expect(stripeMock.customers.list).not.toHaveBeenCalled();
});

it('gate em produção verifica a epoch a cada chamada, sem reutilizar cache após revogação', async () => {
  vi.stubEnv('VERCEL_ENV', 'production');
  const customer = { id: 'cus_gate', email: 'dona@teste.exemplo', metadata: {
    vc_identity_epoch: 'a'.repeat(32),
  } };
  stripeMock.customers.retrieve.mockImplementation(async () => structuredClone(customer));
  stripeMock.subscriptions.list.mockResolvedValue({ data: [subAtiva(customer.id)] });
  const cookie = `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({
    customerId: customer.id, email: customer.email, identityEpoch: customer.metadata.vc_identity_epoch,
  }))}`;
  const first = makeRes();
  expect((await requireActiveSubscription(makeReq({ cookie }), first))?.customerId).toBe(customer.id);
  customer.metadata.vc_identity_epoch = 'b'.repeat(32);
  const afterClaim = makeRes();
  expect(await requireActiveSubscription(makeReq({ cookie }), afterClaim)).toBeNull();
  expect(afterClaim.statusCode).toBe(401);
});

describe('GET /api/auth/session (RF-04)', () => {
  it('sem cookie → anonymous', async () => {
    const res = makeRes();
    await sessionHandler(makeReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ active: false, status: 'anonymous' });
    expect(res.body.customerId).toBeUndefined();
  });

  it('cookie válido + assinatura ativa → active com currentPeriodEnd', async () => {
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subAtiva('cus_1')] });
    const res = makeRes();
    await sessionHandler(makeReq({ cookie: cookieFor('cus_1', 'user1@teste.exemplo') }), res);
    expect(res.body).toMatchObject({ active: true, email: 'user1@teste.exemplo', status: 'active' });
    expect(res.body.customerId).toBe('cus_1');
    expect(typeof res.body.currentPeriodEnd).toBe('string');
  });

  it('cookie válido sem assinatura → plano grátis: identificado, mas nunca ativo', async () => {
    const res = makeRes();
    await sessionHandler(makeReq({ cookie: cookieFor('cus_2', 'user2@teste.exemplo') }), res);
    expect(res.body).toMatchObject({
      active: false, free: true, status: 'inactive', tier: 'free',
      email: 'user2@teste.exemplo', customerId: 'cus_2',
      plan: { id: 'free', imageQuota: 0, projectLimit: 3 },
    });
    // Nada de quota, período ou origem de acesso: isso só existe para quem pagou.
    expect(res.body.imageQuota).toBeUndefined();
    expect(res.body.accessSource).toBeUndefined();
    expect(res.body.currentPeriodEnd).toBeUndefined();
  });

  it('cookie adulterado → anonymous (não vaza erro)', async () => {
    const good = createAccessToken({ customerId: 'cus_3', email: 'user3@teste.exemplo' });
    const bad = good.slice(0, -2) + 'xx';
    const res = makeRes();
    await sessionHandler(makeReq({ cookie: `${COOKIE_NAME}=${encodeURIComponent(bad)}` }), res);
    expect(res.body).toMatchObject({ active: false, status: 'anonymous' });
  });

  it('cookie com percent-encoding inválido → anonymous sem erro 500', async () => {
    const res = makeRes();
    await sessionHandler(makeReq({ cookie: 'vc_access=%E0%A4%A' }), res);
    expect(res.statusCode).toBe(200);
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
  it('limpa o cookie (Max-Age=0), revoga a sessão e responde ok', async () => {
    const res = makeRes();
    await logoutHandler(makeReq({ method: 'POST', cookie: cookieFor('cus_1', 'user1@teste.exemplo') }), res);
    expect(res.body).toEqual({ ok: true, localCookieCleared: true, sessionsRevoked: true });
    const cleared = setCookies(res).find((c) => c.startsWith(`${COOKIE_NAME}=`));
    expect(cleared).toContain('Max-Age=0');
    expect(stripeMock.customers.update).toHaveBeenCalledWith('cus_1', {
      metadata: { vc_session_revoked_before: expect.any(String), vc_identity_epoch: expect.any(String) },
    });
  });

  it('logout impede repetir confirmação já concluída com cookie antigo do checkout', async () => {
    const customer = { id: 'cus_logout_replay', email: 'dona@teste.exemplo', metadata: {} };
    stripeMock.customers.retrieve.mockImplementation(async () => structuredClone(customer));
    stripeMock.customers.update.mockImplementation(async (_, data) => {
      customer.metadata = { ...customer.metadata, ...data.metadata };
      return structuredClone(customer);
    });
    const session = {
      id: 'cs_logout_replay', mode: 'subscription', payment_status: 'paid',
      customer: customer.id, customer_details: { email: customer.email },
      subscription: subAtiva(customer.id), metadata: {},
    };
    stripeMock.checkout.sessions.retrieve.mockImplementation(async () => structuredClone(session));
    stripeMock.checkout.sessions.update.mockImplementation(async (_, data) => {
      session.metadata = { ...session.metadata, ...data.metadata };
      return structuredClone(session);
    });
    const checkout = makeRes();
    setCheckoutCookie(checkout, session.id);
    const checkoutCookie = setCookies(checkout).at(-1).split(';')[0];
    const confirmOnce = async () => {
      const response = makeRes();
      await confirmHandler(makeReq({ method: 'POST', cookie: checkoutCookie,
        body: { sessionId: session.id } }), response);
      return response;
    };
    const first = await confirmOnce();
    expect(first.statusCode).toBe(200);
    const access = `${COOKIE_NAME}=${encodeURIComponent(cookieValue(first, COOKIE_NAME))}`;
    const logout = makeRes();
    await logoutHandler(makeReq({ method: 'POST', cookie: access }), logout);
    expect(logout.body.sessionsRevoked).toBe(true);
    expect(customer.metadata.vc_identity_epoch).toMatch(/^[a-f0-9]{32}$/);
    const replay = await confirmOnce();
    expect(replay.statusCode).toBe(403);
    expect(cookieValue(replay, COOKIE_NAME)).toBeNull();
  });

  it('falha de revogação limpa o cookie local e não afirma revogação global', async () => {
    stripeMock.customers.update.mockRejectedValue(new Error('Stripe indisponível'));
    const res = makeRes();
    await logoutHandler(makeReq({ method: 'POST', cookie: cookieFor('cus_1', 'user1@teste.exemplo') }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      ok: true, localCookieCleared: true, sessionsRevoked: false, warning: 'revocation_failed',
    });
    expect(setCookies(res).find((c) => c.startsWith(`${COOKIE_NAME}=`))).toContain('Max-Age=0');
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
        return { ok: true, json: async () => ({ email, email_verified: true, sub: 'google-sub-owner' }) };
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

  it('primeira entrada com Google cria a conta no plano grátis; e-mail só no cookie', async () => {
    stubGoogleFetch('semplano@teste.exemplo');
    stripeMock.customers.list.mockResolvedValue({ data: [] });
    const created = { id: 'cus_google_novo', email: 'semplano@teste.exemplo', metadata: { product: 'viral-carrossel' } };
    stripeMock.customers.create.mockResolvedValue(structuredClone(created));
    stripeMock.customers.update.mockImplementation(async (_, data) => {
      created.metadata = { ...created.metadata, ...data.metadata };
      return structuredClone(created);
    });
    stripeMock.customers.retrieve.mockImplementation(async () => structuredClone(created));
    const res = makeRes();
    await googleCallbackHandler(
      makeReq({ url: '/api/auth/google/callback?code=abc&state=S', cookie: 'vc_google_oauth=S' }),
      res,
    );
    expect(res.redirectUrl).toBe(`${APP}/?login=google&plan=free`);
    expect(res.redirectUrl).not.toContain('email=');
    expect(cookieValue(res, 'vc_login_hint')).toBe('semplano@teste.exemplo');
    expect(stripeMock.customers.create).toHaveBeenCalledWith(
      { email: 'semplano@teste.exemplo', preferred_locales: ['pt-BR'], metadata: { product: 'viral-carrossel' } },
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^moont-google-signup-[a-f0-9]{64}$/) }),
    );
    expect(created.metadata.vc_google_sub).toBe('google-sub-owner');

    // A sessão identifica a conta, mas não é assinatura: sessão grátis e IA recusada.
    const access = `${COOKIE_NAME}=${encodeURIComponent(cookieValue(res, COOKIE_NAME))}`;
    const session = makeRes();
    await sessionHandler(makeReq({ cookie: access }), session);
    expect(session.body).toMatchObject({ active: false, free: true, customerId: 'cus_google_novo' });
    const gate = makeRes();
    expect(await requireActiveSubscription(makeReq({ cookie: access }), gate)).toBeNull();
    expect(gate.statusCode).toBe(402);
  });

  it('Google verificado com assinatura inativa entra no grátis e deixa prova curta ligada ao customer antigo', async () => {
    stubGoogleFetch('dona@teste.exemplo');
    stripeMock.customers.list.mockResolvedValue({ data: [{ id: 'cus_antigo', email: 'dona@teste.exemplo' }] });
    const res = makeRes();
    await googleCallbackHandler(
      makeReq({ url: '/api/auth/google/callback?code=abc&state=S', cookie: 'vc_google_oauth=S' }), res,
    );
    expect(res.redirectUrl).toBe(`${APP}/?login=google&plan=free`);
    expect(checkoutIdentityFrom(res)).toMatchObject({
      email: 'dona@teste.exemplo', customerId: 'cus_antigo', source: 'verified_login',
      identityEpoch: expect.any(String),
    });
    // Plano grátis: a sessão é do customer antigo, com a mesma versão da identidade da prova.
    expect(cookieValue(res, COOKIE_NAME)).toBeTruthy();
  });

  it('Google encontra assinatura ativa mesmo quando o primeiro customer duplicado está inativo', async () => {
    stubGoogleFetch('dona@teste.exemplo');
    stripeMock.customers.list.mockResolvedValue({ data: [
      { id: 'cus_inativo', email: 'dona@teste.exemplo', created: 1 },
      { id: 'cus_ativo', email: 'dona@teste.exemplo', created: 2 },
    ] });
    stripeMock.subscriptions.list.mockImplementation(async ({ customer }) => ({
      data: customer === 'cus_ativo' ? [subAtiva(customer)] : [],
    }));
    const res = makeRes();
    await googleCallbackHandler(
      makeReq({ url: '/api/auth/google/callback?code=abc&state=S', cookie: 'vc_google_oauth=S' }), res,
    );
    expect(res.redirectUrl).toBe(`${APP}/?billing=restored&login=google`);
    expect(stripeMock.subscriptions.list).toHaveBeenCalled();
    expect(cookieValue(res, COOKIE_NAME)).toBeTruthy();
    expect(checkoutIdentityFrom(res)).toBeNull();
  });

  it('Google reivindica pré-cadastro anônimo antes da renovação; senha antiga e sessão antiga perdem acesso', async () => {
    const password = 'SenhaDeOutraPessoa123!';
    const { salt, hash } = hashPassword(password);
    const customer = { id: 'cus_preclaim', email: 'dona@teste.exemplo', metadata: {
      vc_pw_salt: salt, vc_pw_hash: hash,
    } };
    stripeMock.customers.list.mockResolvedValue({ data: [customer] });
    stripeMock.customers.retrieve.mockImplementation(async () => structuredClone(customer));
    stripeMock.customers.update.mockImplementation(async (_, data) => {
      customer.metadata = { ...customer.metadata, ...data.metadata };
      return structuredClone(customer);
    });
    const oldAccess = cookieFor(customer.id, customer.email);
    stubGoogleFetch(customer.email);
    const google = makeRes();
    await googleCallbackHandler(makeReq({
      url: '/api/auth/google/callback?code=abc&state=S', cookie: 'vc_google_oauth=S',
    }), google);
    expect(google.redirectUrl).toBe(`${APP}/?login=google&plan=free`);
    const proof = checkoutIdentityFrom(google);
    expect(proof).toMatchObject({ customerId: customer.id, identityEpoch: expect.any(String) });
    expect(customer.metadata).toMatchObject({
      vc_google_sub: 'google-sub-owner', vc_pw_hash: '', vc_pw_salt: '',
    });
    expect(await readCurrentAccessCookie(makeReq({ cookie: oldAccess }))).toBeNull();

    const proofCookie = setCookies(google).filter((entry) => entry.startsWith(`${CHECKOUT_IDENTITY_COOKIE}=`)).at(-1).split(';')[0];
    const checkout = makeRes();
    await checkoutHandler(makeReq({ method: 'POST', body: { email: customer.email }, cookie: proofCookie }), checkout);
    expect(checkout.statusCode).toBe(200);
    expect(checkout.body).toHaveProperty('sessionId');
    expect(stripeMock.checkout.sessions.create.mock.calls[0][0].metadata.vc_identity_epoch)
      .toBe(proof.identityEpoch);

    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      id: checkout.body.sessionId, mode: 'subscription', payment_status: 'paid',
      customer: customer.id, customer_details: { email: customer.email },
      subscription: subAtiva(customer.id),
      metadata: { vc_identity_epoch: proof.identityEpoch },
    });
    const checkoutCookie = setCookies(checkout).find((entry) => entry.startsWith('vc_checkout_')).split(';')[0];
    const confirmed = makeRes();
    await confirmHandler(makeReq({ method: 'POST', cookie: checkoutCookie,
      body: { sessionId: checkout.body.sessionId } }), confirmed);
    expect(confirmed.statusCode).toBe(200);
    const newAccess = `${COOKIE_NAME}=${encodeURIComponent(cookieValue(confirmed, COOKIE_NAME))}`;
    expect((await readCurrentAccessCookie(makeReq({ cookie: newAccess })))?.customerId).toBe(customer.id);

    const attacker = makeRes();
    await loginHandler(makeReq({ method: 'POST', body: { email: customer.email, password } }), attacker);
    expect(attacker.statusCode).toBe(401);
    expect(cookieValue(attacker, COOKIE_NAME)).toBeNull();
  });

  it('logins Google posteriores preservam a senha criada depois do primeiro vínculo', async () => {
    const { salt, hash } = hashPassword('SenhaLegitima123!');
    const customer = { id: 'cus_bound', email: 'dona@teste.exemplo', metadata: {
      vc_google_sub: 'google-sub-owner', vc_identity_epoch: 'a'.repeat(32),
      vc_pw_salt: salt, vc_pw_hash: hash,
    } };
    stripeMock.customers.list.mockResolvedValue({ data: [customer] });
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subAtiva(customer.id)] });
    stubGoogleFetch(customer.email);
    const google = makeRes();
    await googleCallbackHandler(makeReq({ url: '/api/auth/google/callback?code=abc&state=S',
      cookie: 'vc_google_oauth=S' }), google);
    expect(google.redirectUrl).toBe(`${APP}/?billing=restored&login=google`);
    expect(stripeMock.customers.update).not.toHaveBeenCalled();
    expect(customer.metadata.vc_pw_hash).toBe(hash);
  });

  it('provas e checkouts anteriores ao vínculo Google são rejeitados mesmo no mesmo segundo', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T12:00:00.000Z'));
    const customer = { id: 'cus_replay', email: 'dona@teste.exemplo', metadata: {} };
    stripeMock.customers.list.mockResolvedValue({ data: [customer] });
    stripeMock.customers.retrieve.mockImplementation(async () => structuredClone(customer));
    stripeMock.customers.update.mockImplementation(async (_, data) => {
      customer.metadata = { ...customer.metadata, ...data.metadata };
      return structuredClone(customer);
    });
    const proofRes = makeRes();
    setCheckoutIdentityCookie(proofRes, { email: customer.email, customerId: customer.id, source: 'verified_login' });
    const oldProof = setCookies(proofRes).at(-1).split(';')[0];
    const oldCheckoutRes = makeRes();
    setCheckoutCookie(oldCheckoutRes, 'cs_preclaim');
    const oldCheckout = setCookies(oldCheckoutRes).at(-1).split(';')[0];

    stubGoogleFetch(customer.email);
    const google = makeRes();
    await googleCallbackHandler(makeReq({ url: '/api/auth/google/callback?code=abc&state=S',
      cookie: 'vc_google_oauth=S' }), google);
    expect(google.redirectUrl).toBe(`${APP}/?login=google&plan=free`);

    const renewed = makeRes();
    await checkoutHandler(makeReq({ method: 'POST', body: { email: customer.email }, cookie: oldProof }), renewed);
    expect(renewed.statusCode).toBe(403);
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_preclaim', mode: 'subscription', payment_status: 'paid', customer: customer.id,
      customer_details: { email: customer.email }, subscription: subAtiva(customer.id),
      metadata: {},
    });
    const replay = makeRes();
    await confirmHandler(makeReq({ method: 'POST', cookie: oldCheckout,
      body: { sessionId: 'cs_preclaim' } }), replay);
    expect(replay.statusCode).toBe(403);
    expect(cookieValue(replay, COOKIE_NAME)).toBeNull();
  });

  it('duplicados com projetos em apenas uma conta preservam essa biblioteca; ambiguidade bloqueia login', async () => {
    stubGoogleFetch('dona@teste.exemplo');
    stripeMock.customers.list.mockResolvedValue({ data: [
      { id: 'cus_antigo', email: 'dona@teste.exemplo', metadata: {} },
      { id: 'cus_projetos', email: 'dona@teste.exemplo', metadata: {} },
    ] });
    getLibrarySyncMeta.mockImplementation(async (id) => ({ projectCount: id === 'cus_projetos' ? 3 : 0 }));
    const selected = makeRes();
    await googleCallbackHandler(makeReq({ url: '/api/auth/google/callback?code=abc&state=S',
      cookie: 'vc_google_oauth=S' }), selected);
    expect(checkoutIdentityFrom(selected)?.customerId).toBe('cus_projetos');

    getLibrarySyncMeta.mockResolvedValue({ projectCount: 3 });
    const conflict = makeRes();
    await googleCallbackHandler(makeReq({ url: '/api/auth/google/callback?code=abc&state=S',
      cookie: 'vc_google_oauth=S' }), conflict);
    expect(conflict.redirectUrl).toBe(`${APP}/?login=account_conflict`);
    expect(cookieValue(conflict, COOKIE_NAME)).toBeNull();
  });

  it('Google escolhe a conta com projetos no Postgres após a migração', async () => {
    vi.stubEnv('LIBRARY_SYNC_BACKEND', 'postgres');
    stubGoogleFetch('dona@teste.exemplo');
    stripeMock.customers.list.mockResolvedValue({ data: [
      { id: 'cus_antigo', email: 'dona@teste.exemplo', metadata: {} },
      { id: 'cus_projetos', email: 'dona@teste.exemplo', metadata: {} },
    ] });
    getPostgresLibrarySyncMeta.mockImplementation(async (id) => ({
      projectCount: id === 'cus_projetos' ? 1 : 0,
    }));
    const response = makeRes();
    await googleCallbackHandler(makeReq({ url: '/api/auth/google/callback?code=abc&state=S',
      cookie: 'vc_google_oauth=S' }), response);
    expect(checkoutIdentityFrom(response)?.customerId).toBe('cus_projetos');
    expect(getLibrarySyncMeta).not.toHaveBeenCalled();
  });

  it('prova Google recente prevalece sobre sessão antiga de outro customer com o mesmo e-mail', async () => {
    const email = 'dona@teste.exemplo';
    const customer = { id: 'cus_projetos', email, metadata: { vc_identity_epoch: 'a'.repeat(32) } };
    stripeMock.customers.retrieve.mockImplementation(async (id) =>
      id === customer.id ? customer : { id, email, metadata: {} });
    const proofRes = makeRes();
    setCheckoutIdentityCookie(proofRes, { email, customerId: customer.id,
      source: 'verified_login', identityEpoch: customer.metadata.vc_identity_epoch });
    const proof = setCookies(proofRes).at(-1).split(';')[0];
    const staleAccess = cookieFor('cus_outro', email);
    const checkout = makeRes();
    await checkoutHandler(makeReq({ method: 'POST', body: { email },
      cookie: `${staleAccess}; ${proof}` }), checkout);
    expect(checkout.statusCode).toBe(200);
    expect(checkout.body.sessionId).toBe('cs_test_fake');
    expect(stripeMock.checkout.sessions.create.mock.calls[0][0].customer).toBe(customer.id);
  });

  it('login por senha pausado durante vínculo Google não cria prova nem sessão utilizável', async () => {
    const password = 'SenhaPreClaim123!';
    const { salt, hash } = hashPassword(password);
    const customer = { id: 'cus_race', email: 'dona@teste.exemplo', metadata: {
      vc_pw_salt: salt, vc_pw_hash: hash,
    } };
    stripeMock.customers.list.mockResolvedValue({ data: [customer] });
    stripeMock.customers.retrieve.mockImplementation(async () => structuredClone(customer));
    let continueSubscription;
    let subscriptionReached;
    const reached = new Promise((resolve) => { subscriptionReached = resolve; });
    const paused = new Promise((resolve) => { continueSubscription = resolve; });
    stripeMock.subscriptions.list.mockImplementation(async () => {
      subscriptionReached();
      await paused;
      return { data: [] };
    });
    const login = makeRes();
    const pendingLogin = loginHandler(makeReq({ method: 'POST',
      body: { email: customer.email, password } }), login);
    await reached;
    customer.metadata = { ...customer.metadata, vc_identity_epoch: 'b'.repeat(32),
      vc_pw_hash: '', vc_pw_salt: '', vc_session_revoked_before: String(Date.now()) };
    continueSubscription();
    await pendingLogin;
    expect(login.statusCode).toBe(200);
    expect(login.body).toMatchObject({ active: false, free: true });
    const proof = setCookies(login).filter((entry) => entry.startsWith(`${CHECKOUT_IDENTITY_COOKIE}=`)).at(-1).split(';')[0];
    const checkout = makeRes();
    await checkoutHandler(makeReq({ method: 'POST', body: { email: customer.email }, cookie: proof }), checkout);
    expect(checkout.statusCode).toBe(403);
    // A sessão grátis emitida por esse login nasceu com a identidade antiga:
    // depois do vínculo Google ela não identifica mais ninguém.
    const staleAccess = `${COOKIE_NAME}=${encodeURIComponent(cookieValue(login, COOKIE_NAME))}`;
    expect(await readCurrentAccessCookie(makeReq({ cookie: staleAccess }))).toBeNull();
    const session = makeRes();
    await sessionHandler(makeReq({ cookie: staleAccess }), session);
    expect(session.body).toMatchObject({ active: false, status: 'anonymous' });
    expect(session.body.free).toBeUndefined();
  });

  it('confirmação pausada durante mudança da identidade não reabre acesso', async () => {
    const customer = { id: 'cus_confirm_race', email: 'dona@teste.exemplo', metadata: {
      vc_identity_epoch: 'c'.repeat(32),
    } };
    stripeMock.customers.retrieve.mockImplementation(async () => structuredClone(customer));
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_confirm_race', mode: 'subscription', payment_status: 'paid',
      customer: customer.id, customer_details: { email: customer.email },
      subscription: subAtiva(customer.id),
      metadata: { vc_identity_epoch: customer.metadata.vc_identity_epoch },
    });
    let continueUpdate;
    let updateReached;
    const reached = new Promise((resolve) => { updateReached = resolve; });
    const paused = new Promise((resolve) => { continueUpdate = resolve; });
    stripeMock.checkout.sessions.update.mockImplementation(async () => {
      updateReached();
      await paused;
      return {};
    });
    const checkoutRes = makeRes();
    setCheckoutCookie(checkoutRes, 'cs_confirm_race');
    const checkoutCookie = setCookies(checkoutRes).at(-1).split(';')[0];
    const confirmed = makeRes();
    const pending = confirmHandler(makeReq({ method: 'POST', cookie: checkoutCookie,
      body: { sessionId: 'cs_confirm_race' } }), confirmed);
    await reached;
    customer.metadata.vc_identity_epoch = 'd'.repeat(32);
    continueUpdate();
    await pending;
    expect(confirmed.statusCode).toBe(200);
    const access = `${COOKIE_NAME}=${encodeURIComponent(cookieValue(confirmed, COOKIE_NAME))}`;
    expect(await readCurrentAccessCookie(makeReq({ cookie: access }))).toBeNull();
  });

  it('Google não autentica perfil sem confirmação explícita do e-mail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) =>
      String(url).includes('/token')
        ? { ok: true, json: async () => ({ access_token: 'ya29.fake' }) }
        : { ok: true, json: async () => ({ email: 'dona@teste.exemplo' }) }));
    const res = makeRes();
    await googleCallbackHandler(
      makeReq({ url: '/api/auth/google/callback?code=abc&state=S', cookie: 'vc_google_oauth=S' }), res,
    );
    expect(res.redirectUrl).toBe(`${APP}/?login=error`);
    expect(stripeMock.customers.list).not.toHaveBeenCalled();
    expect(checkoutIdentityFrom(res)).toBeNull();
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

describe('identidade para renovar assinatura por senha', () => {
  it('senha correta com assinatura inativa entra no grátis e prepara o checkout do customer original', async () => {
    const { salt, hash } = hashPassword('MinhaSenha123!');
    const customer = { id: 'cus_antigo', email: 'dona@teste.exemplo', metadata: { vc_pw_salt: salt, vc_pw_hash: hash } };
    stripeMock.customers.list.mockResolvedValue({ data: [customer] });
    stripeMock.customers.retrieve.mockResolvedValue(customer);
    const res = makeRes();
    await loginHandler(makeReq({ method: 'POST', body: { email: customer.email, password: 'MinhaSenha123!' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ active: false, free: true, plan: 'free', customerId: customer.id });
    expect(res.body.needCheckout).toBeUndefined();
    expect(checkoutIdentityFrom(res)).toEqual({
      email: customer.email, customerId: customer.id, source: 'verified_login',
    });
    const access = `${COOKIE_NAME}=${encodeURIComponent(cookieValue(res, COOKIE_NAME))}`;
    expect((await readCurrentAccessCookie(makeReq({ cookie: access })))?.customerId).toBe(customer.id);
  });

  it('senha errada não emite prova para renovar assinatura', async () => {
    const { salt, hash } = hashPassword('MinhaSenha123!');
    stripeMock.customers.list.mockResolvedValue({ data: [{
      id: 'cus_antigo', email: 'dona@teste.exemplo', metadata: { vc_pw_salt: salt, vc_pw_hash: hash },
    }] });
    const res = makeRes();
    await loginHandler(makeReq({ method: 'POST', body: {
      email: 'dona@teste.exemplo', password: 'SenhaErrada123!',
    } }), res);
    expect(res.statusCode).toBe(401);
    expect(checkoutIdentityFrom(res)).toBeNull();
  });

  it('customer duplicado mais novo sem senha não mascara a senha do customer antigo', async () => {
    const { salt, hash } = hashPassword('SenhaDaDona123!');
    const old = { id: 'cus_antigo', email: 'dona@teste.exemplo', created: 1,
      metadata: { vc_pw_salt: salt, vc_pw_hash: hash } };
    const duplicate = { id: 'cus_duplicado', email: old.email, created: 2, metadata: {} };
    stripeMock.customers.list.mockResolvedValue({ data: [duplicate, old], has_more: false });
    stripeMock.customers.retrieve.mockImplementation(async (id) => id === old.id ? old : duplicate);
    stripeMock.subscriptions.list.mockImplementation(async ({ customer }) => ({
      data: customer === old.id ? [subAtiva(old.id)] : [],
    }));

    expect((await getAuthRecord(old.email)).customerId).toBe(old.id);
    const res = makeRes();
    await loginHandler(makeReq({ method: 'POST', body: {
      email: old.email, password: 'SenhaDaDona123!',
    } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.customerId).toBe(old.id);
    expect(stripeMock.subscriptions.list).toHaveBeenCalledWith(expect.objectContaining({ customer: old.id }));
  });

  it('busca a senha correta em página posterior sem confiar somente no e-mail', async () => {
    const { salt, hash } = hashPassword('SenhaDaDona123!');
    const old = { id: 'cus_antigo', email: 'dona@teste.exemplo', created: 1,
      metadata: { vc_pw_salt: salt, vc_pw_hash: hash } };
    stripeMock.customers.list
      .mockResolvedValueOnce({ data: [{ id: 'cus_novo', email: old.email, metadata: {} }], has_more: true })
      .mockResolvedValueOnce({ data: [old], has_more: false });
    stripeMock.customers.retrieve.mockResolvedValue(old);
    const res = makeRes();
    await loginHandler(makeReq({ method: 'POST', body: {
      email: old.email, password: 'SenhaDaDona123!',
    } }), res);
    expect(res.statusCode).toBe(200); // assinatura antiga inativa; identidade validada → plano grátis
    expect(res.body).toMatchObject({ active: false, free: true });
    expect(checkoutIdentityFrom(res)?.customerId).toBe(old.id);
    expect(stripeMock.customers.list).toHaveBeenNthCalledWith(2, {
      email: old.email, limit: 100, starting_after: 'cus_novo',
    });
  });

  it('senhas iguais em customers distintos não escolhem um dono arbitrário', async () => {
    const { salt, hash } = hashPassword('SenhaIgual123!');
    stripeMock.customers.list.mockResolvedValue({ data: [
      { id: 'cus_primeiro', email: 'dona@teste.exemplo', created: 1, metadata: { vc_pw_salt: salt, vc_pw_hash: hash } },
      { id: 'cus_segundo', email: 'dona@teste.exemplo', created: 2, metadata: { vc_pw_salt: salt, vc_pw_hash: hash } },
    ] });
    const res = makeRes();
    await loginHandler(makeReq({ method: 'POST', body: {
      email: 'dona@teste.exemplo', password: 'SenhaIgual123!',
    } }), res);
    expect(res.statusCode).toBe(409);
    expect(cookieValue(res, COOKIE_NAME)).toBeNull();
    expect(checkoutIdentityFrom(res)).toBeNull();
  });

  it('cadastro anônimo não define senha nem concede acesso no customer preexistente sem senha', async () => {
    stripeMock.customers.list.mockResolvedValue({ data: [{ id: 'cus_vitima', email: 'vitima@teste.exemplo', metadata: {} }] });
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subAtiva('cus_vitima')] });
    const res = makeRes();
    await registerHandler(makeReq({ method: 'POST', body: { email: 'vitima@teste.exemplo', password: 'SenhaAtacante123!' } }), res);
    // Resposta neutra (MOO-16): não revela que o e-mail já tem conta.
    expect(res.statusCode).toBe(200);
    expect(res.body.checkEmail).toBe(true);
    expect(stripeMock.customers.update).not.toHaveBeenCalled();
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
    expect(cookieValue(res, COOKIE_NAME)).toBeNull();
  });

  it('cadastro novo cria customer próprio, entra no grátis e a prova só assina esse customer', async () => {
    const res = makeRes();
    await registerHandler(makeReq({ method: 'POST', body: { email: 'nova@teste.exemplo', password: 'MinhaSenha123!' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ active: false, free: true, plan: 'free', customerId: 'cus_novo_nova' });
    expect(res.body.needCheckout).toBeUndefined();
    expect(stripeMock.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'nova@teste.exemplo', metadata: { product: 'viral-carrossel' },
      }),
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^moont-register-customer-/) }),
    );
    expect(stripeMock.customers.update).toHaveBeenCalledWith(
      'cus_novo_nova',
      expect.objectContaining({ metadata: expect.objectContaining({ vc_pw_hash: expect.any(String) }) }),
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^moont-register-credential-/) }),
    );
    expect(checkoutIdentityFrom(res)).toEqual({
      email: 'nova@teste.exemplo', customerId: 'cus_novo_nova', source: 'new_registration',
    });
    // A sessão é do customer recém-criado, e só dele.
    const token = cookieValue(res, COOKIE_NAME);
    expect(JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')))
      .toMatchObject({ customerId: 'cus_novo_nova', email: 'nova@teste.exemplo' });

    // A mesma aba assina precisamente o customer recém-criado; não abre outro.
    stripeMock.customers.retrieve.mockResolvedValue({ id: 'cus_novo_nova', email: 'nova@teste.exemplo' });
    const proofCookie = setCookies(res).find((entry) => entry.startsWith(`${CHECKOUT_IDENTITY_COOKIE}=`)).split(';')[0];
    const checkout = makeRes();
    await checkoutHandler(makeReq({
      method: 'POST', cookie: proofCookie, body: { email: 'nova@teste.exemplo', tier: 'creator' },
    }), checkout);
    expect(checkout.statusCode).toBe(200);
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      customer: 'cus_novo_nova',
    }), expect.any(Object));
    expect(stripeMock.customers.create).toHaveBeenCalledTimes(1);
  });

  it('dois cadastros simultâneos convergem no mesmo customer e o segundo recebe a resposta neutra', async () => {
    stripeMock.customers.list.mockResolvedValue({ data: [], has_more: false });
    stripeMock.customers.create.mockResolvedValue({
      id: 'cus_concorrente', email: 'concorrente@teste.exemplo', metadata: { product: 'viral-carrossel' },
    });
    stripeMock.customers.update
      .mockResolvedValueOnce({ id: 'cus_concorrente' })
      .mockRejectedValueOnce(Object.assign(new Error('same key, different params'), {
        type: 'StripeIdempotencyError',
      }));
    const first = makeRes();
    const second = makeRes();

    await Promise.all([
      registerHandler(makeReq({ method: 'POST', body: {
        email: 'concorrente@teste.exemplo', password: 'SenhaConcorrente123!',
      } }), first),
      registerHandler(makeReq({ method: 'POST', body: {
        email: 'concorrente@teste.exemplo', password: 'OutraSenhaConcorrente456!',
      } }), second),
    ]);

    expect([first.statusCode, second.statusCode]).toEqual([200, 200]);
    expect([first.body.checkEmail, second.body.checkEmail].filter(Boolean)).toHaveLength(1);
    expect([first, second].filter((r) => cookieValue(r, COOKIE_NAME))).toHaveLength(1);
    expect(stripeMock.customers.create).toHaveBeenCalledTimes(2);
    expect(new Set(stripeMock.customers.create.mock.calls.map((call) => call[1].idempotencyKey)).size).toBe(1);
    expect(stripeMock.customers.update).toHaveBeenCalledTimes(2);
  });
});

describe('confirmar a senha da conta aberta antes de apagar o aparelho', () => {
  const contaComSenha = () => {
    const { salt, hash } = hashPassword('SenhaDaConta123!');
    return { id: 'cus_confirma', email: 'dona@teste.exemplo', metadata: { vc_pw_salt: salt, vc_pw_hash: hash } };
  };
  const confirmar = async (cookie, password, extra = {}) => {
    const res = makeRes();
    await loginHandler(makeReq({ method: 'POST', cookie, body: { purpose: 'confirm', password, ...extra } }), res);
    return res;
  };

  it('senha certa confirma sem emitir nem trocar a sessão', async () => {
    const customer = contaComSenha();
    stripeMock.customers.retrieve.mockResolvedValue(customer);
    const res = await confirmar(cookieFor(customer.id, customer.email), 'SenhaDaConta123!');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ verified: true, hasPassword: true });
    expect(cookieValue(res, COOKIE_NAME)).toBeNull();
    expect(stripeMock.customers.list).not.toHaveBeenCalled();
  });

  it('senha errada é recusada', async () => {
    const customer = contaComSenha();
    stripeMock.customers.retrieve.mockResolvedValue(customer);
    const res = await confirmar(cookieFor(customer.id, customer.email), 'OutraSenha123!');
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ verified: false, hasPassword: true });
  });

  it('a conta vem da sessão: e-mail de outra pessoa no corpo não muda quem é verificado', async () => {
    const customer = contaComSenha();
    stripeMock.customers.retrieve.mockImplementation(async (id) => (id === customer.id ? customer : null));
    const res = await confirmar(cookieFor(customer.id, customer.email), 'SenhaDaConta123!', { email: 'outra@teste.exemplo' });
    expect(res.statusCode).toBe(200);
    expect(stripeMock.customers.retrieve).toHaveBeenCalledWith(customer.id);
  });

  it('conta só com Google responde que não há senha', async () => {
    stripeMock.customers.retrieve.mockResolvedValue({ id: 'cus_google', email: 'g@teste.exemplo', metadata: { vc_google_sub: 'sub' } });
    const res = await confirmar(cookieFor('cus_google', 'g@teste.exemplo'), 'qualquer');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ verified: false, hasPassword: false });
  });

  it('sem sessão não confirma nada', async () => {
    const res = await confirmar('', 'SenhaDaConta123!');
    expect(res.statusCode).toBe(401);
    expect(stripeMock.customers.retrieve).not.toHaveBeenCalled();
  });

  // AUTH-05 (auditoria 23/11): a confirmação saía antes do limite por conta;
  // com a sessão de alguém dava para testar senhas sem teto.
  it('a 6ª confirmação seguida na mesma conta recebe 429 sem conferir a senha', async () => {
    const { salt, hash } = hashPassword('SenhaDaConta123!');
    const customer = { id: 'cus_limite_confirma', email: 'limite@teste.exemplo', metadata: { vc_pw_salt: salt, vc_pw_hash: hash } };
    stripeMock.customers.retrieve.mockImplementation(async (id) => (id === customer.id ? customer
      : { id, email: 'vizinha@teste.exemplo', metadata: { vc_pw_salt: salt, vc_pw_hash: hash } }));
    const statuses = [];
    for (let i = 0; i < 6; i += 1) statuses.push((await confirmar(cookieFor(customer.id, customer.email), `Palpite${i}Errado!`)).statusCode);
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    // Nem a senha certa passa depois do teto: o palpite seguinte não vira oráculo.
    expect((await confirmar(cookieFor(customer.id, customer.email), 'SenhaDaConta123!')).statusCode).toBe(429);
    // Outra conta, no mesmo IP, segue confirmando.
    const vizinha = await confirmar(cookieFor('cus_vizinha_confirma', 'vizinha@teste.exemplo'), 'SenhaDaConta123!');
    expect(vizinha.body).toEqual({ verified: true, hasPassword: true });
  // Seis conferências de senha (scrypt) seguidas: prazo próprio para máquina carregada.
  }, 30_000);
});
