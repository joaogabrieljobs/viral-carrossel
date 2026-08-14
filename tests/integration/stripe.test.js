// Task 04 — RF-07 (checkout), RF-08 (confirm), RF-10 (portal).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));

import { makeReq, makeRes, cookieValue } from '../helpers/http.js';
import { createAccessToken, COOKIE_NAME } from '../../api/lib/access.js';
import checkoutHandler from '../../api/stripe/checkout.js';
import confirmHandler from '../../api/stripe/confirm.js';
import portalHandler from '../../api/stripe/portal.js';

const post = (body, extra = {}) => makeReq({ method: 'POST', body, ...extra });

beforeEach(resetStripeMock);

describe('POST /api/stripe/checkout (RF-07)', () => {
  it('e-mail inválido → 400', async () => {
    const res = makeRes();
    await checkoutHandler(post({ email: 'nao-e-email' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Informe um e-mail válido');
  });

  it('cliente novo: cria customer e retorna url do Checkout', async () => {
    const res = makeRes();
    await checkoutHandler(post({ email: 'User5@Teste.Exemplo ' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.url).toContain('https://checkout.stripe.com/');
    // e-mail normalizado (trim + lowercase)
    expect(stripeMock.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user5@teste.exemplo' }),
    );
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'subscription' }),
    );
  });

  it('assinatura já ativa → alreadyActive + cookie de acesso (restauração)', async () => {
    stripeMock.customers.list.mockResolvedValue({ data: [{ id: 'cus_9', email: 'user9@teste.exemplo' }] });
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subAtiva('cus_9')] });
    const res = makeRes();
    await checkoutHandler(post({ email: 'user9@teste.exemplo' }), res);
    expect(res.body.alreadyActive).toBe(true);
    expect(res.body.url).toContain('billing=restored');
    expect(cookieValue(res, COOKIE_NAME)).toBeTruthy();
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('método errado → 405', async () => {
    const res = makeRes();
    await checkoutHandler(makeReq({ method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
  });
});

describe('POST /api/stripe/confirm (RF-08)', () => {
  it('sem sessionId → 400', async () => {
    const res = makeRes();
    await confirmHandler(post({}), res);
    expect(res.statusCode).toBe(400);
  });

  it('sessão que não é de assinatura → 400', async () => {
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({ mode: 'payment' });
    const res = makeRes();
    await confirmHandler(post({ sessionId: 'cs_x' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Sessão inválida');
  });

  it('pagamento pendente → 402', async () => {
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      mode: 'subscription',
      payment_status: 'unpaid',
      status: 'open',
    });
    const res = makeRes();
    await confirmHandler(post({ sessionId: 'cs_x' }), res);
    expect(res.statusCode).toBe(402);
  });

  it('sessão paga → active + cookie do customer certo', async () => {
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      mode: 'subscription',
      payment_status: 'paid',
      status: 'complete',
      customer: 'cus_7',
      customer_details: { email: 'user7@teste.exemplo' },
      subscription: subAtiva('cus_7'),
    });
    const res = makeRes();
    await confirmHandler(post({ sessionId: 'cs_ok' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ active: true, email: 'user7@teste.exemplo' });
    expect(res.body.customerId).toBeUndefined();
    expect(cookieValue(res, COOKIE_NAME)).toBeTruthy();
  });
});

describe('POST /api/stripe/portal (RF-10)', () => {
  it('anônimo → 401', async () => {
    const res = makeRes();
    await portalHandler(post(undefined), res);
    expect(res.statusCode).toBe(401);
  });

  it('com sessão → url do Customer Portal do próprio customer', async () => {
    const cookie = `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId: 'cus_8', email: 'user8@teste.exemplo' }))}`;
    const res = makeRes();
    await portalHandler(post(undefined, { cookie }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.url).toContain('https://billing.stripe.com/');
    expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_8' }),
    );
  });
});
