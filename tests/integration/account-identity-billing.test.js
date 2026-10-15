import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

const identityState = vi.hoisted(() => ({
  account: null,
  revoke: vi.fn(),
}));
vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));
vi.mock('../../api/lib/account-identity-postgres.js', () => ({
  accountIdentityBackendEnabled: () => process.env.ACCOUNT_IDENTITY_BACKEND === 'postgres',
  getOrCreateAccountForStripeCustomer: async (id) =>
    identityState.account?.stripeCustomerId === id ? identityState.account : null,
  revokeAccountSessions: identityState.revoke,
}));

import { makeReq, makeRes, cookieValue, setCookies } from '../helpers/http.js';
import {
  CHECKOUT_IDENTITY_COOKIE, COOKIE_NAME, createAccessToken,
  readCurrentAccessCookie, setCheckoutCookie, setCheckoutIdentityCookie,
  verifyAccessToken,
} from '../../api/lib/access.js';
import checkoutHandler from '../../api/stripe/checkout.js';
import confirmHandler from '../../api/stripe/confirm.js';
import logoutHandler from '../../api/auth/logout.js';

const owner = {
  id: '00000000-0000-4000-8000-000000000014',
  stripeCustomerId: 'cus_billing_identity',
  email: 'dona@example.com',
  identityEpoch: 'a'.repeat(32),
  sessionRevokedBefore: 0,
};

beforeEach(() => {
  resetStripeMock();
  identityState.account = { ...owner };
  identityState.revoke.mockReset().mockImplementation(async (id) => {
    expect(id).toBe(owner.stripeCustomerId);
    identityState.account = {
      ...identityState.account,
      identityEpoch: 'revoked-epoch', sessionRevokedBefore: Date.now(),
    };
    return identityState.account;
  });
  vi.stubEnv('ACCOUNT_IDENTITY_BACKEND', 'postgres');
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_billing_identity');
  vi.stubEnv('ACCESS_COOKIE_SECRET', 'billing-identity-cookie-secret');
  vi.stubEnv('STRIPE_PRICE_ID_CREATOR', 'price_creator_test');
  vi.stubEnv('APP_URL', 'https://viralcarrossel.com.br');
  stripeMock.customers.retrieve.mockResolvedValue({
    id: owner.stripeCustomerId, email: owner.email,
    metadata: { vc_identity_epoch: 'stale-stripe-epoch' },
  });
});
afterEach(() => vi.unstubAllEnvs());

function verifiedProof(epoch = owner.identityEpoch) {
  const response = makeRes();
  setCheckoutIdentityCookie(response, {
    email: owner.email, customerId: owner.stripeCustomerId,
    source: 'verified_login', identityEpoch: epoch,
  });
  return setCookies(response).find((value) => value.startsWith(`${CHECKOUT_IDENTITY_COOKIE}=`)).split(';')[0];
}

function boundCheckout(sessionId) {
  const response = makeRes();
  setCheckoutCookie(response, sessionId);
  return setCookies(response).find((value) => value.startsWith('vc_checkout_')).split(';')[0];
}

describe('checkout e logout com identidade no Postgres', () => {
  it('checkout aceita apenas a versão de identidade do banco e a grava no Stripe Session', async () => {
    const stale = makeRes();
    await checkoutHandler(makeReq({ method: 'POST', cookie: verifiedProof('b'.repeat(32)),
      body: { email: owner.email, tier: 'creator' } }), stale);
    expect(stale.statusCode).toBe(403);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();

    const response = makeRes();
    await checkoutHandler(makeReq({ method: 'POST', cookie: verifiedProof(),
      body: { email: owner.email, tier: 'creator' } }), response);
    expect(response.statusCode).toBe(200);
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({
        vc_identity_epoch: owner.identityEpoch,
      }) }),
    );
  });

  it('confirm emite accountId e logout revoga no banco sem atualizar metadata do Stripe', async () => {
    const sessionId = 'cs_identity_billing';
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      id: sessionId, mode: 'subscription', payment_status: 'paid',
      customer: owner.stripeCustomerId, customer_email: owner.email,
      subscription: subAtiva(owner.stripeCustomerId),
      metadata: { vc_identity_epoch: owner.identityEpoch },
    });
    const response = makeRes();
    await confirmHandler(makeReq({ method: 'POST', cookie: boundCheckout(sessionId),
      body: { sessionId } }), response);
    expect(response.statusCode).toBe(200);
    const token = cookieValue(response, COOKIE_NAME);
    expect(verifyAccessToken(token)).toMatchObject({
      accountId: owner.id, customerId: owner.stripeCustomerId,
      identityEpoch: owner.identityEpoch,
    });
    const accessCookie = `${COOKIE_NAME}=${encodeURIComponent(token)}`;
    expect(await readCurrentAccessCookie(makeReq({ cookie: accessCookie }))).toMatchObject({
      accountId: owner.id,
    });

    const logout = makeRes();
    await logoutHandler(makeReq({ method: 'POST', cookie: accessCookie }), logout);
    expect(logout.body).toMatchObject({ ok: true, sessionsRevoked: true });
    expect(identityState.revoke).toHaveBeenCalledOnce();
    expect(stripeMock.customers.update).not.toHaveBeenCalled();
    expect(await readCurrentAccessCookie(makeReq({ cookie: accessCookie }))).toBeNull();
  });

  it('checkout anterior à revogação não reabre a conta', async () => {
    const sessionId = 'cs_old_identity';
    identityState.account.identityEpoch = 'new-epoch';
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      id: sessionId, mode: 'subscription', payment_status: 'paid',
      customer: owner.stripeCustomerId, customer_email: owner.email,
      subscription: subAtiva(owner.stripeCustomerId),
      metadata: { vc_identity_epoch: owner.identityEpoch },
    });
    const response = makeRes();
    await confirmHandler(makeReq({ method: 'POST', cookie: boundCheckout(sessionId),
      body: { sessionId } }), response);
    expect(response.statusCode).toBe(403);
    expect(cookieValue(response, COOKIE_NAME)).toBeNull();
  });
});
