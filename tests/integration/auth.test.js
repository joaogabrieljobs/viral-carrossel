// Task 03 — RF-04 (sessão/cookie completo), RF-05 (Google), RF-06 (logout).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));
vi.mock('../../api/lib/library-sync-store.js', () => ({
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
import { requireActiveSubscription, resetActiveAccessCacheForTests } from '../../api/lib/require-access.js';

const APP = 'https://viralcarrossel.com.br';
const cookieFor = (customerId, email) =>
  `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId, email }))}`;
const checkoutIdentityFrom = (res) => {
  const cookie = setCookies(res).filter((entry) => entry.startsWith(`${CHECKOUT_IDENTITY_COOKIE}=`)).at(-1);
  return cookie ? readCheckoutIdentityCookie(makeReq({ cookie: cookie.split(';')[0] })) : null;
};

beforeEach(() => {
  resetStripeMock();
  getLibrarySyncMeta.mockReset().mockResolvedValue(null);
  resetActiveAccessCacheForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
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

  it('conta Google sem assinatura → ?login=no_subscription e e-mail só no cookie', async () => {
    stubGoogleFetch('semplano@teste.exemplo');
    stripeMock.customers.list.mockResolvedValue({ data: [] });
    const res = makeRes();
    await googleCallbackHandler(
      makeReq({ url: '/api/auth/google/callback?code=abc&state=S', cookie: 'vc_google_oauth=S' }),
      res,
    );
    expect(res.redirectUrl).toBe(`${APP}/?login=no_subscription`);
    expect(res.redirectUrl).not.toContain('email=');
    expect(cookieValue(res, 'vc_login_hint')).toBe('semplano@teste.exemplo');
    expect(cookieValue(res, COOKIE_NAME)).toBeNull();
  });

  it('Google verificado com assinatura inativa deixa prova curta ligada ao customer antigo', async () => {
    stubGoogleFetch('dona@teste.exemplo');
    stripeMock.customers.list.mockResolvedValue({ data: [{ id: 'cus_antigo', email: 'dona@teste.exemplo' }] });
    const res = makeRes();
    await googleCallbackHandler(
      makeReq({ url: '/api/auth/google/callback?code=abc&state=S', cookie: 'vc_google_oauth=S' }), res,
    );
    expect(res.redirectUrl).toBe(`${APP}/?login=no_subscription`);
    expect(checkoutIdentityFrom(res)).toMatchObject({
      email: 'dona@teste.exemplo', customerId: 'cus_antigo', source: 'verified_login',
      identityEpoch: expect.any(String),
    });
    expect(cookieValue(res, COOKIE_NAME)).toBeNull();
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
    expect(google.redirectUrl).toBe(`${APP}/?login=no_subscription`);
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
    expect(google.redirectUrl).toBe(`${APP}/?login=no_subscription`);

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

  it('login por senha pausado durante vínculo Google não cria prova utilizável', async () => {
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
    expect(login.statusCode).toBe(402);
    const proof = setCookies(login).filter((entry) => entry.startsWith(`${CHECKOUT_IDENTITY_COOKIE}=`)).at(-1).split(';')[0];
    const checkout = makeRes();
    await checkoutHandler(makeReq({ method: 'POST', body: { email: customer.email }, cookie: proof }), checkout);
    expect(checkout.statusCode).toBe(403);
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
  it('senha correta com assinatura inativa prepara o checkout do customer original', async () => {
    const { salt, hash } = hashPassword('MinhaSenha123!');
    const customer = { id: 'cus_antigo', email: 'dona@teste.exemplo', metadata: { vc_pw_salt: salt, vc_pw_hash: hash } };
    stripeMock.customers.list.mockResolvedValue({ data: [customer] });
    stripeMock.customers.retrieve.mockResolvedValue(customer);
    const res = makeRes();
    await loginHandler(makeReq({ method: 'POST', body: { email: customer.email, password: 'MinhaSenha123!' } }), res);
    expect(res.statusCode).toBe(402);
    expect(res.body.needCheckout).toBe(true);
    expect(checkoutIdentityFrom(res)).toEqual({
      email: customer.email, customerId: customer.id, source: 'verified_login',
    });
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
    expect(res.statusCode).toBe(402); // assinatura antiga inativa; identidade validada
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
    expect(res.statusCode).toBe(409);
    expect(res.body.requireLogin).toBe(true);
    expect(stripeMock.customers.update).not.toHaveBeenCalled();
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
    expect(cookieValue(res, COOKIE_NAME)).toBeNull();
  });

  it('cadastro novo cria customer próprio e prova apenas para assinar esse customer', async () => {
    const res = makeRes();
    await registerHandler(makeReq({ method: 'POST', body: { email: 'nova@teste.exemplo', password: 'MinhaSenha123!' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.needCheckout).toBe(true);
    expect(stripeMock.customers.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'nova@teste.exemplo', metadata: expect.objectContaining({ vc_pw_hash: expect.any(String) }),
    }));
    expect(checkoutIdentityFrom(res)).toEqual({
      email: 'nova@teste.exemplo', customerId: 'cus_novo_nova', source: 'new_registration',
    });
    expect(cookieValue(res, COOKIE_NAME)).toBeNull();

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
    }));
    expect(stripeMock.customers.create).toHaveBeenCalledTimes(1);
  });
});
