// AUTH-07 (auditoria 23/11): o checkout reaproveitava uma sessão de pagamento
// criada antes de um logout. A versão da conta já tinha mudado, e a confirmação
// depois do pagamento respondia 403. Stripe sempre mockado.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));

import { makeReq, makeRes, cookieValue } from '../helpers/http.js';
import {
  COOKIE_NAME, CHECKOUT_IDENTITY_COOKIE, checkoutCookieName, setCheckoutIdentityCookie,
} from '../../api/lib/access.js';
import checkoutHandler from '../../api/stripe/checkout.js';
import confirmHandler from '../../api/stripe/confirm.js';

const EMAIL = 'dona@teste.exemplo';
const CUSTOMER = 'cus_saiu_e_voltou';
// A versão da conta é hexadecimal (o cookie de prova recusa outro formato).
const E1 = 'a1'.repeat(16);
const E2 = 'b2'.repeat(16);

const post = (body, cookie) => makeReq({ method: 'POST', body, cookie });

function provaDeLogin(identityEpoch) {
  const proof = makeRes();
  setCheckoutIdentityCookie(proof, {
    email: EMAIL, customerId: CUSTOMER, source: 'verified_login', identityEpoch,
  });
  return `${CHECKOUT_IDENTITY_COOKIE}=${encodeURIComponent(cookieValue(proof, CHECKOUT_IDENTITY_COOKIE))}`;
}

const sessaoAberta = (id, identityEpoch) => ({
  id,
  status: 'open',
  mode: 'subscription',
  url: `https://checkout.stripe.com/c/pay/${id}`,
  metadata: {
    product: 'viral-carrossel', email: EMAIL, tier: 'creator',
    ...(identityEpoch ? { vc_identity_epoch: identityEpoch } : {}),
  },
});

beforeEach(() => {
  resetStripeMock();
  stripeMock.customers.retrieve.mockResolvedValue({
    id: CUSTOMER, email: EMAIL, metadata: { vc_identity_epoch: E2 },
  });
  stripeMock.checkout.sessions.create.mockImplementation(async (params) => ({
    id: 'cs_nova', url: 'https://checkout.stripe.com/c/pay/cs_nova', ...params,
  }));
});

describe('AUTH-07: checkout não reaproveita sessão de pagamento de antes do logout', () => {
  it('sessão aberta em E1 e conta em E2: expira a antiga, cria outra em E2 e a confirmação responde 200', async () => {
    stripeMock.checkout.sessions.list.mockResolvedValue({ data: [sessaoAberta('cs_antiga', E1)] });
    const res = makeRes();
    await checkoutHandler(post({ email: EMAIL, tier: 'creator' }, provaDeLogin(E2)), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.sessionId).toBe('cs_nova');
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
    expect(stripeMock.checkout.sessions.expire).toHaveBeenCalledWith('cs_antiga');
    const [created] = stripeMock.checkout.sessions.create.mock.calls.at(-1);
    expect(created.metadata.vc_identity_epoch).toBe(E2);

    // A pessoa paga a sessão nova e volta ao app.
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_nova',
      mode: 'subscription',
      payment_status: 'paid',
      status: 'complete',
      customer: CUSTOMER,
      customer_details: { email: EMAIL },
      subscription: subAtiva(CUSTOMER),
      metadata: created.metadata,
    });
    const checkoutCookie = `${checkoutCookieName('cs_nova')}=${encodeURIComponent(cookieValue(res, checkoutCookieName('cs_nova')))}`;
    const confirmed = makeRes();
    await confirmHandler(post({ sessionId: 'cs_nova' }, checkoutCookie), confirmed);
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.body).toMatchObject({ active: true, email: EMAIL });
    expect(cookieValue(confirmed, COOKIE_NAME)).toBeTruthy();
  });

  it('sessão aberta na mesma versão da conta continua sendo reaproveitada', async () => {
    stripeMock.checkout.sessions.list.mockResolvedValue({ data: [sessaoAberta('cs_atual', E2)] });
    const res = makeRes();
    await checkoutHandler(post({ email: EMAIL, tier: 'creator' }, provaDeLogin(E2)), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.sessionId).toBe('cs_atual');
    expect(stripeMock.checkout.sessions.expire).not.toHaveBeenCalled();
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('conta sem versão registrada reaproveita sessão sem versão', async () => {
    stripeMock.customers.retrieve.mockResolvedValue({ id: CUSTOMER, email: EMAIL, metadata: {} });
    stripeMock.checkout.sessions.list.mockResolvedValue({ data: [sessaoAberta('cs_sem_versao')] });
    const res = makeRes();
    await checkoutHandler(post({ email: EMAIL, tier: 'creator' }, provaDeLogin()), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.sessionId).toBe('cs_sem_versao');
    expect(stripeMock.checkout.sessions.expire).not.toHaveBeenCalled();
  });
});
