import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

const identityState = vi.hoisted(() => ({ accounts: new Map(), newCustomers: new Map() }));
vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));
vi.mock('../../api/lib/account-identity-postgres.js', () => ({
  accountIdentityBackendEnabled: () => process.env.ACCOUNT_IDENTITY_BACKEND === 'postgres',
  getOrCreateAccountForStripeCustomer: async (id) => {
    if (!identityState.accounts.has(id) && identityState.newCustomers.has(id)) {
      identityState.accounts.set(id, {
        id: '00000000-0000-4000-8000-000000000003',
        stripeCustomerId: id, email: identityState.newCustomers.get(id),
        salt: null, hash: null, identityEpoch: '', sessionRevokedBefore: 0,
      });
    }
    return identityState.accounts.get(id) || null;
  },
  getAccountByStripeCustomerId: async (id) => identityState.accounts.get(id) || null,
  findPasswordCandidatesByEmail: async (email) => [...identityState.accounts.values()]
    .filter((account) => account.email === email && account.hash),
  findAccountsByEmail: async (email) => [...identityState.accounts.values()]
    .filter((account) => account.email === email),
  getPasswordRecordByStripeCustomerId: async (id) => identityState.accounts.get(id) || null,
  setAccountPassword: async (id, { salt, hash, expectedHash, expectedEpoch } = {}) => {
    const account = identityState.accounts.get(id);
    if ((expectedHash !== undefined && expectedHash !== account.hash)
      || (expectedEpoch !== undefined && expectedEpoch !== account.identityEpoch)) {
      throw Object.assign(new Error('conflito'), { code: 'identity_credential_conflict' });
    }
    const updated = { ...account, salt, hash,
      identityEpoch: `epoch-${Date.now()}`,
      sessionRevokedBefore: Date.now() };
    identityState.accounts.set(id, updated);
    return updated;
  },
  linkVerifiedGoogleIdentity: async (id, { sub }) => {
    const account = identityState.accounts.get(id);
    const updated = { ...account, googleSub: sub, salt: null, hash: null,
      identityEpoch: `google-${Date.now()}`, sessionRevokedBefore: Date.now() };
    identityState.accounts.set(id, updated);
    return updated;
  },
  getAccountByGoogleSubject: async (sub) => [...identityState.accounts.values()]
    .find((account) => account.googleSub === sub) || null,
  revokeAccountSessions: async () => null,
}));

import { makeReq, makeRes, cookieValue, setCookies } from '../helpers/http.js';
import { createAccessToken, readCurrentAccessCookie, COOKIE_NAME } from '../../api/lib/access.js';
import { hashPassword, getPasswordRecoveryRecord } from '../../api/lib/password-auth.js';
import { createPasswordResetToken, resetPassword } from '../../api/lib/password-reset.js';
import loginHandler from '../../api/auth/login.js';
import registerHandler from '../../api/auth/register.js';
import googleCallbackHandler from '../../api/auth/google/callback.js';

const accountId = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  resetStripeMock();
  identityState.accounts.clear();
  identityState.newCustomers.clear();
  vi.stubEnv('ACCOUNT_IDENTITY_BACKEND', 'postgres');
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_identity');
  vi.stubEnv('DATABASE_URL', 'postgresql://test@localhost/moont');
  vi.stubEnv('ACCESS_COOKIE_SECRET', 'test-identity-cookie-secret');
  vi.stubEnv('APP_URL', 'https://viralcarrossel.com.br');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function addAccount(id = 'cus_identity', email = 'pessoa@example.com') {
  const secret = hashPassword('SenhaOriginal123');
  const account = { id: accountId, stripeCustomerId: id, email,
    salt: secret.salt, hash: secret.hash,
    identityEpoch: 'legacy-epoch', sessionRevokedBefore: 0 };
  identityState.accounts.set(id, account);
  return account;
}

describe('autenticação com ACCOUNT_IDENTITY_BACKEND=postgres', () => {
  it('login usa scrypt do banco, emite accountId e revoga cookie pela epoch do banco', async () => {
    const account = addAccount();
    stripeMock.customers.list.mockResolvedValue({ data: [{
      id: account.stripeCustomerId, email: account.email, metadata: {
        vc_pw_hash: 'valor-legado-diferente', vc_identity_epoch: 'epoch-antiga',
      },
    }], has_more: false });
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subAtiva(account.stripeCustomerId)] });
    const response = makeRes();
    await loginHandler(makeReq({ method: 'POST', body: {
      email: account.email, password: 'SenhaOriginal123',
    } }), response);
    expect(response.statusCode).toBe(200);
    const token = cookieValue(response, COOKIE_NAME);
    expect(token).toBeTruthy();
    const cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}`;
    expect((await readCurrentAccessCookie(makeReq({ cookie }))).accountId).toBe(account.id);
    // Stripe é só o vínculo de cobrança: a leitura da sessão não consulta sua
    // metadata de senha/epoch quando a flag do banco está ativa.
    expect(stripeMock.customers.retrieve).not.toHaveBeenCalled();
    identityState.accounts.set(account.stripeCustomerId, {
      ...account, identityEpoch: 'new-epoch', sessionRevokedBefore: Date.now(),
    });
    expect(await readCurrentAccessCookie(makeReq({ cookie }))).toBeNull();
  });

  it('reset altera a credencial do banco uma vez e invalida o token anterior', async () => {
    const account = addAccount();
    const token = createPasswordResetToken({
      customerId: account.stripeCustomerId, email: account.email,
      salt: account.salt, hash: account.hash, identityEpoch: account.identityEpoch,
    });
    const result = await resetPassword(token, 'SenhaNovaForte123');
    expect(result.email).toBe(account.email);
    expect(identityState.accounts.get(account.stripeCustomerId).hash).not.toBe(account.hash);
    await expect(resetPassword(token, 'OutraSenhaForte123'))
      .rejects.toMatchObject({ code: 'invalid_reset_link' });
    expect(stripeMock.customers.update).not.toHaveBeenCalled();
  });

  it('reset não escolhe arbitrariamente entre contas com o mesmo email', async () => {
    const first = addAccount('cus_a', 'igual@example.com');
    identityState.accounts.set('cus_b', { ...first,
      id: '00000000-0000-4000-8000-000000000002', stripeCustomerId: 'cus_b',
    });
    stripeMock.customers.list.mockResolvedValue({ data: [
      { id: 'cus_a', email: 'igual@example.com', metadata: {} },
      { id: 'cus_b', email: 'igual@example.com', metadata: {} },
    ], has_more: false });
    expect(await getPasswordRecoveryRecord('igual@example.com')).toBeNull();
  });

  it('cookie com accountId incorreto é rejeitado antes do uso da assinatura', async () => {
    const account = addAccount();
    const token = createAccessToken({
      customerId: account.stripeCustomerId,
      accountId: '00000000-0000-4000-8000-000000000099',
      email: account.email, identityEpoch: account.identityEpoch,
    });
    const cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}`;
    expect(await readCurrentAccessCookie(makeReq({ cookie }))).toBeNull();
  });

  it('cadastro guarda a senha no banco e deixa somente vínculo de produto no Stripe', async () => {
    stripeMock.customers.list.mockResolvedValue({ data: [], has_more: false });
    stripeMock.customers.create.mockImplementation(async ({ email, metadata }) => {
      expect(metadata).toEqual({ product: 'viral-carrossel' });
      identityState.newCustomers.set('cus_new', email);
      return { id: 'cus_new', email, metadata };
    });
    const response = makeRes();
    await registerHandler(makeReq({ method: 'POST', body: {
      email: 'nova@example.com', password: 'NovaSenhaSegura123',
    } }), response);
    expect(response.statusCode).toBe(200);
    expect(response.body.needCheckout).toBe(true);
    expect(identityState.accounts.get('cus_new').hash).toBeTruthy();
    expect(setCookies(response).some((cookie) => cookie.startsWith('vc_identity_checkout='))).toBe(true);
  });

  it('Google verificado vincula o sub ao banco e invalida senha e cookie anteriores', async () => {
    const account = addAccount();
    vi.stubEnv('GOOGLE_CLIENT_ID', 'google-client');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-secret');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
      if (String(url).includes('oauth2.googleapis.com/token')) {
        return { ok: true, json: async () => ({ access_token: 'fake' }) };
      }
      return { ok: true, json: async () => ({ email: account.email,
        email_verified: true, sub: 'google-sub-1' }) };
    }));
    stripeMock.customers.list.mockResolvedValue({ data: [{
      id: account.stripeCustomerId, email: account.email, metadata: {},
    }], has_more: false });
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subAtiva(account.stripeCustomerId)] });
    const oldToken = createAccessToken({ customerId: account.stripeCustomerId,
      email: account.email, identityEpoch: account.identityEpoch });
    const response = makeRes();
    await googleCallbackHandler(makeReq({
      url: '/api/auth/google/callback?code=abc&state=S', cookie: 'vc_google_oauth=S',
    }), response);
    expect(response.redirectUrl).toBe('https://viralcarrossel.com.br/?billing=restored&login=google');
    expect(identityState.accounts.get(account.stripeCustomerId).hash).toBeNull();
    expect(stripeMock.customers.update).not.toHaveBeenCalled();
    expect(await readCurrentAccessCookie(makeReq({ cookie: `${COOKIE_NAME}=${encodeURIComponent(oldToken)}` })))
      .toBeNull();
    const newToken = cookieValue(response, COOKIE_NAME);
    expect((await readCurrentAccessCookie(makeReq({
      cookie: `${COOKIE_NAME}=${encodeURIComponent(newToken)}`,
    }))).accountId).toBe(account.id);
  });
});
