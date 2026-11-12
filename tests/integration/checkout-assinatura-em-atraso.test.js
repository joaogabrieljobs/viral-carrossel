/** Auditoria 11/11, achado 5: o checkout não pode criar uma segunda assinatura
 *  quando o cliente já tem uma em atraso (past_due, unpaid) ou com a primeira
 *  fatura pendente (incomplete). Ele manda regularizar a que existe. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));

import { makeReq, makeRes, cookieValue } from '../helpers/http.js';
import {
  CHECKOUT_IDENTITY_COOKIE,
  checkoutCookieName,
  readCheckoutIdentityCookie,
  setCheckoutIdentityCookie,
} from '../../api/lib/access.js';
import {
  findActiveSubscription,
  findRecoverableSubscription,
  isSubscriptionActive,
} from '../../api/lib/stripe.js';
import checkoutHandler from '../../api/stripe/checkout.js';

const EMAIL = 'dona@teste.exemplo';
const CUSTOMER = 'cus_dona';

function provaDeIdentidade() {
  const proof = makeRes();
  setCheckoutIdentityCookie(proof, { email: EMAIL, customerId: CUSTOMER, source: 'verified_login' });
  return `${CHECKOUT_IDENTITY_COOKIE}=${encodeURIComponent(cookieValue(proof, CHECKOUT_IDENTITY_COOKIE))}`;
}

const sub = (status, extra = {}) => ({ ...subAtiva(CUSTOMER), id: `sub_${status}`, status, ...extra });

async function checkoutCom(subscriptions) {
  stripeMock.customers.retrieve.mockResolvedValue({ id: CUSTOMER, email: EMAIL, metadata: {} });
  stripeMock.subscriptions.list.mockResolvedValue({ data: subscriptions });
  const res = makeRes();
  await checkoutHandler(makeReq({ method: 'POST', body: { email: EMAIL }, cookie: provaDeIdentidade() }), res);
  return res;
}

beforeEach(resetStripeMock);
afterEach(() => vi.unstubAllEnvs());

describe('checkout com assinatura em atraso (achado 5)', () => {
  it.each(['past_due', 'unpaid'])('assinatura %s: devolve o portal do próprio cliente e não cria sessão nova', async (status) => {
    const res = await checkoutCom([sub(status)]);
    expect(res.statusCode).toBe(200);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
    expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: CUSTOMER, return_url: 'https://moont.ai/?app=1' }),
    );
    expect(res.body.url).toBe('https://billing.stripe.com/p/session_fake');
    expect(res.body.billingIssue).toBe(true);
    expect(res.body.subscriptionStatus).toBe(status);
    expect(res.body.sessionId).toBeUndefined();
    // Nenhum cookie de checkout: não existe sessão de checkout para confirmar.
    expect(cookieValue(res, checkoutCookieName('cs_test_fake'))).toBeNull();
  });

  it('assinatura incomplete com fatura aberta: retoma a fatura em vez de abrir outra assinatura', async () => {
    const res = await checkoutCom([sub('incomplete', {
      latest_invoice: { id: 'in_1', status: 'open', hosted_invoice_url: 'https://invoice.stripe.com/i/acct_1/in_1' },
    })]);
    expect(res.statusCode).toBe(200);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
    expect(stripeMock.billingPortal.sessions.create).not.toHaveBeenCalled();
    expect(res.body.url).toBe('https://invoice.stripe.com/i/acct_1/in_1');
    expect(res.body.subscriptionStatus).toBe('incomplete');
  });

  it('assinatura incomplete sem link de fatura cai no portal', async () => {
    const res = await checkoutCom([sub('incomplete', { latest_invoice: 'in_2' })]);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
    expect(res.body.url).toBe('https://billing.stripe.com/p/session_fake');
  });

  it('a prova de identidade continua valendo para a pessoa tentar de novo depois de regularizar', async () => {
    const res = await checkoutCom([sub('past_due')]);
    expect(cookieValue(res, CHECKOUT_IDENTITY_COOKIE)).toBeNull();
  });

  it.each(['canceled', 'incomplete_expired'])('assinatura %s não bloqueia: o checkout novo segue como hoje', async (status) => {
    const res = await checkoutCom([sub(status)]);
    expect(res.statusCode).toBe(200);
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(stripeMock.billingPortal.sessions.create).not.toHaveBeenCalled();
    expect(res.body.url).toContain('https://checkout.stripe.com/');
  });

  it('assinatura ativa continua respondendo alreadyActive, mesmo com outra em atraso', async () => {
    const res = await checkoutCom([sub('past_due'), sub('active')]);
    expect(res.body.alreadyActive).toBe(true);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
    expect(stripeMock.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it('o acesso ao estúdio não muda: em atraso continua sem contar como ativa', async () => {
    for (const status of ['past_due', 'unpaid', 'incomplete']) expect(isSubscriptionActive(sub(status))).toBe(false);
    stripeMock.subscriptions.list.mockResolvedValue({ data: [sub('canceled'), sub('past_due')] });
    expect((await findRecoverableSubscription(CUSTOMER)).status).toBe('past_due');
  });

  it('assinatura ativa de outro produto Stripe não libera o Moont', async () => {
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [{
        ...sub('active'),
        metadata: { product: 'outro-produto' },
        items: { data: [{ price: { id: 'price_outro_produto' } }] },
      }],
    });
    expect(await findActiveSubscription(CUSTOMER)).toBeNull();
  });

  it('tier genérico sem product e com preço externo não libera o Moont', async () => {
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [{
        ...sub('active'),
        metadata: { tier: 'creator' },
        items: { data: [{ price: { id: 'price_de_outro_produto' } }] },
      }],
    });
    expect(await findActiveSubscription(CUSTOMER)).toBeNull();
  });

  it('checkout cancelado pode ser repetido no mesmo navegador sem criar outra conta', async () => {
    stripeMock.customers.retrieve.mockImplementation(async (id) => ({
      id,
      email: EMAIL,
      metadata: {},
    }));

    const first = makeRes();
    await checkoutHandler(makeReq({ method: 'POST', body: { email: EMAIL } }), first);
    expect(first.statusCode).toBe(200);
    const provisional = cookieValue(first, CHECKOUT_IDENTITY_COOKIE);
    expect(provisional).toBeTruthy();

    const second = makeRes();
    await checkoutHandler(makeReq({
      method: 'POST',
      body: { email: EMAIL },
      cookie: `${CHECKOUT_IDENTITY_COOKIE}=${encodeURIComponent(provisional)}`,
    }), second);

    expect(second.statusCode).toBe(200);
    expect(second.body.requireLogin).toBeUndefined();
    expect(second.body.url).toContain('https://checkout.stripe.com/');
    expect(stripeMock.customers.create).toHaveBeenCalledTimes(1);
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(2);
  });

  it('duas tentativas anônimas concorrentes usam as mesmas chaves de customer e sessão', async () => {
    let arrivals = 0;
    let release;
    const bothListed = new Promise((resolve) => { release = resolve; });
    stripeMock.customers.list.mockImplementation(async () => {
      arrivals += 1;
      if (arrivals === 2) release();
      await bothListed;
      return { data: [], has_more: false };
    });
    stripeMock.customers.create.mockResolvedValue({
      id: 'cus_concorrente_checkout', email: EMAIL, metadata: { product: 'viral-carrossel' },
    });
    stripeMock.checkout.sessions.create.mockResolvedValue({
      id: 'cs_concorrente_checkout', url: 'https://checkout.stripe.com/c/pay/cs_concorrente_checkout',
    });

    const first = makeRes();
    const second = makeRes();
    await Promise.all([
      checkoutHandler(makeReq({ method: 'POST', body: { email: EMAIL } }), first),
      checkoutHandler(makeReq({ method: 'POST', body: { email: EMAIL } }), second),
    ]);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const customerKeys = stripeMock.customers.create.mock.calls.map((call) => call[1]?.idempotencyKey);
    const sessionKeys = stripeMock.checkout.sessions.create.mock.calls.map((call) => call[1]?.idempotencyKey);
    expect(customerKeys).toHaveLength(2);
    expect(new Set(customerKeys).size).toBe(1);
    expect(sessionKeys).toHaveLength(2);
    expect(new Set(sessionKeys).size).toBe(1);
  });

  it('falha ao criar sessão ainda devolve prova provisória para repetir', async () => {
    stripeMock.checkout.sessions.create.mockRejectedValueOnce(new Error('Stripe indisponível'));
    const res = makeRes();
    await checkoutHandler(makeReq({ method: 'POST', body: { email: EMAIL } }), res);

    expect(res.statusCode).toBe(500);
    const provisional = cookieValue(res, CHECKOUT_IDENTITY_COOKIE);
    expect(provisional).toBeTruthy();
    expect(readCheckoutIdentityCookie(makeReq({
      cookie: `${CHECKOUT_IDENTITY_COOKIE}=${encodeURIComponent(provisional)}`,
    }))).toMatchObject({ email: EMAIL, source: 'checkout_provisional' });
  });

  it('prova provisória continua válida depois de 11 minutos', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T12:00:00Z'));
    const first = makeRes();
    await checkoutHandler(makeReq({ method: 'POST', body: { email: EMAIL } }), first);
    const provisional = cookieValue(first, CHECKOUT_IDENTITY_COOKIE);
    const customerId = stripeMock.customers.create.mock.results[0].value
      ? 'cus_novo_dona' : CUSTOMER;
    stripeMock.customers.retrieve.mockResolvedValue({
      id: customerId, email: EMAIL, metadata: { product: 'viral-carrossel' },
    });
    vi.advanceTimersByTime(11 * 60_000);

    const second = makeRes();
    await checkoutHandler(makeReq({
      method: 'POST', body: { email: EMAIL },
      cookie: `${CHECKOUT_IDENTITY_COOKIE}=${encodeURIComponent(provisional)}`,
    }), second);

    expect(second.statusCode).toBe(200);
    expect(second.body.requireLogin).toBeUndefined();
    expect(stripeMock.customers.list).toHaveBeenCalledTimes(1);
  });

  it('plano sem price próprio não cai silenciosamente no preço do Criador', async () => {
    vi.stubEnv('STRIPE_PRICE_ID_PRO', '');
    const res = makeRes();
    await checkoutHandler(makeReq({
      method: 'POST',
      body: { email: EMAIL, tier: 'pro' },
    }), res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ code: 'plan_price_not_configured' });
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
