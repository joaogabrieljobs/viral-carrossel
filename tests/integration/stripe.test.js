// Task 04 — RF-07 (checkout), RF-08 (confirm), RF-10 (portal).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));

import { makeReq, makeRes, cookieValue } from '../helpers/http.js';
import {
  createAccessToken, COOKIE_NAME, CHECKOUT_IDENTITY_COOKIE,
  checkoutCookieName, setCheckoutCookie, setCheckoutIdentityCookie,
} from '../../api/lib/access.js';
import checkoutHandler from '../../api/stripe/checkout.js';
import confirmHandler from '../../api/stripe/confirm.js';
import portalHandler from '../../api/stripe/portal.js';

const post = (body, extra = {}) => makeReq({ method: 'POST', body, ...extra });

beforeEach(resetStripeMock);
afterEach(() => vi.useRealTimers());

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
      expect.objectContaining({
        mode: 'subscription',
        success_url: 'https://viralcarrossel.com.br/?billing=success',
      }),
    );
    const signed = cookieValue(res, checkoutCookieName('cs_test_fake'));
    expect(signed).toMatch(/^v1\.[^.]+\.[^.]+$/);
    expect(signed).not.toContain('cs_test_fake');
  });

  it('e-mail preexistente ativo ou inativo exige login e nunca reutiliza o customer sem prova', async () => {
    stripeMock.customers.list.mockResolvedValue({ data: [{ id: 'cus_9', email: 'user9@teste.exemplo' }] });
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subAtiva('cus_9')] });
    const res = makeRes();
    await checkoutHandler(post({ email: 'user9@teste.exemplo' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.requireLogin).toBe(true);
    expect(cookieValue(res, COOKIE_NAME)).toBeFalsy();
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();

    stripeMock.subscriptions.list.mockResolvedValue({ data: [] });
    const inactive = makeRes();
    await checkoutHandler(post({ email: 'user9@teste.exemplo' }), inactive);
    expect(inactive.body.requireLogin).toBe(true);
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
  });

  it('customer deletado na primeira página não oculta outra conta do mesmo e-mail', async () => {
    stripeMock.customers.list
      .mockResolvedValueOnce({ data: [{ id: 'cus_deleted', deleted: true }], has_more: true })
      .mockResolvedValueOnce({ data: [{ id: 'cus_real', email: 'dona@teste.exemplo' }], has_more: false });
    const res = makeRes();
    await checkoutHandler(post({ email: 'dona@teste.exemplo' }), res);
    expect(res.body.requireLogin).toBe(true);
    expect(stripeMock.customers.list).toHaveBeenNthCalledWith(2, {
      email: 'dona@teste.exemplo', limit: 100, starting_after: 'cus_deleted',
    });
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
  });

  it('prova curta assinada permite renovar apenas o customer autenticado', async () => {
    const proof = makeRes();
    setCheckoutIdentityCookie(proof, {
      email: 'dona@teste.exemplo', customerId: 'cus_vitima', source: 'verified_login',
    });
    const cookie = `${CHECKOUT_IDENTITY_COOKIE}=${encodeURIComponent(cookieValue(proof, CHECKOUT_IDENTITY_COOKIE))}`;
    stripeMock.customers.retrieve.mockResolvedValue({ id: 'cus_vitima', email: 'dona@teste.exemplo' });
    stripeMock.customers.list.mockResolvedValue({ data: [{ id: 'cus_vitima', email: 'dona@teste.exemplo' }] });
    const res = makeRes();
    await checkoutHandler(post({ email: 'dona@teste.exemplo' }, { cookie }), res);
    expect(res.statusCode).toBe(200);
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      customer: 'cus_vitima', expires_at: expect.any(Number),
    }));
    expect(cookieValue(res, CHECKOUT_IDENTITY_COOKIE)).toBe('');

    const forged = makeRes();
    await checkoutHandler(post({ email: 'dona@teste.exemplo' }, { cookie: `${cookie}x` }), forged);
    expect(forged.body.requireLogin).toBe(true);
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
  });

  it('prova de outra conta ou customer com e-mail alterado não reutiliza a conta', async () => {
    const proof = makeRes();
    setCheckoutIdentityCookie(proof, {
      email: 'dona@teste.exemplo', customerId: 'cus_vitima', source: 'verified_login',
    });
    const cookie = `${CHECKOUT_IDENTITY_COOKIE}=${encodeURIComponent(cookieValue(proof, CHECKOUT_IDENTITY_COOKIE))}`;
    stripeMock.customers.list.mockResolvedValue({ data: [{ id: 'cus_outra', email: 'outra@teste.exemplo' }] });
    const mismatch = makeRes();
    await checkoutHandler(post({ email: 'outra@teste.exemplo' }, { cookie }), mismatch);
    expect(mismatch.body.requireLogin).toBe(true);

    stripeMock.customers.retrieve.mockResolvedValue({ id: 'cus_vitima', email: 'mudou@teste.exemplo' });
    const changed = makeRes();
    await checkoutHandler(post({ email: 'dona@teste.exemplo' }, { cookie }), changed);
    expect(changed.statusCode).toBe(403);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('prova temporária expirada volta a exigir login para conta existente', async () => {
    vi.useFakeTimers();
    const proof = makeRes();
    setCheckoutIdentityCookie(proof, {
      email: 'dona@teste.exemplo', customerId: 'cus_vitima', source: 'verified_login',
    });
    const cookie = `${CHECKOUT_IDENTITY_COOKIE}=${encodeURIComponent(cookieValue(proof, CHECKOUT_IDENTITY_COOKIE))}`;
    stripeMock.customers.list.mockResolvedValue({ data: [{ id: 'cus_vitima', email: 'dona@teste.exemplo' }] });
    vi.setSystemTime(Date.now() + 11 * 60_000);
    const res = makeRes();
    await checkoutHandler(post({ email: 'dona@teste.exemplo' }, { cookie }), res);
    expect(res.body.requireLogin).toBe(true);
    expect(stripeMock.customers.retrieve).not.toHaveBeenCalled();
  });

  it('cookie de checkout dura enquanto a sessão Stripe pode ser paga', async () => {
    vi.useFakeTimers();
    const start = Date.now();
    const first = makeRes();
    await checkoutHandler(post({ email: 'novo@teste.exemplo' }), first);
    const cookie = `${checkoutCookieName('cs_test_fake')}=${encodeURIComponent(cookieValue(first, checkoutCookieName('cs_test_fake')))}`;
    const expiresAt = stripeMock.checkout.sessions.create.mock.calls[0][0].expires_at;
    expect(expiresAt).toBeGreaterThan(Math.floor(start / 1000) + 23 * 3600);
    vi.setSystemTime(start + 31 * 60_000);
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({ mode: 'payment' });
    const valid = makeRes();
    await confirmHandler(post({ sessionId: 'cs_test_fake' }, { cookie }), valid);
    expect(valid.statusCode).toBe(400);
    vi.setSystemTime(start + 24 * 3600_000 + 1000);
    const expired = makeRes();
    await confirmHandler(post({ sessionId: 'cs_test_fake' }, { cookie }), expired);
    expect(expired.statusCode).toBe(401);
  });

  it('método errado → 405', async () => {
    const res = makeRes();
    await checkoutHandler(makeReq({ method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
  });
});

describe('POST /api/stripe/confirm (RF-08)', () => {
  const checkoutCookie = (sessionId) => {
    const response = makeRes();
    setCheckoutCookie(response, sessionId);
    return `${checkoutCookieName(sessionId)}=${encodeURIComponent(cookieValue(response, checkoutCookieName(sessionId)))}`;
  };
  const withCheckout = (sessionId, body = { sessionId }) => post(body, { cookie: checkoutCookie(sessionId) });

  it('sem cookie do checkout → 401', async () => {
    const res = makeRes();
    await confirmHandler(post({ sessionId: 'cs_roubada' }), res);
    expect(res.statusCode).toBe(401);
    expect(stripeMock.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });

  it('vc_checkout=cs_ cru ou cookie adulterado não autoriza o pagamento', async () => {
    const raw = makeRes();
    await confirmHandler(post({ sessionId: 'cs_ok' }, { cookie: 'vc_checkout=cs_ok' }), raw);
    expect(raw.statusCode).toBe(401);

    const forged = `${checkoutCookie('cs_ok')}x`;
    const bad = makeRes();
    await confirmHandler(post({ sessionId: 'cs_ok' }, { cookie: forged }), bad);
    expect(bad.statusCode).toBe(401);
    expect(stripeMock.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });

  it('cookie assinado expirado não autoriza a confirmação', async () => {
    vi.useFakeTimers();
    const cookie = checkoutCookie('cs_expired');
    vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000 + 1000);
    const res = makeRes();
    await confirmHandler(post({ sessionId: 'cs_expired' }, { cookie }), res);
    expect(res.statusCode).toBe(401);
    expect(stripeMock.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });

  it('sessionId do body diferente do cookie → 403', async () => {
    const res = makeRes();
    await confirmHandler(withCheckout('cs_ok', { sessionId: 'cs_outra' }), res);
    expect(res.statusCode).toBe(403);
    expect(stripeMock.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });

  it('sessão que não é de assinatura → 400', async () => {
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({ mode: 'payment' });
    const res = makeRes();
    await confirmHandler(withCheckout('cs_x'), res);
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
    await confirmHandler(withCheckout('cs_x'), res);
    expect(res.statusCode).toBe(402);
  });

  it('checkout completo com pagamento pendente não concede acesso', async () => {
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({ mode: 'subscription', payment_status: 'unpaid', status: 'complete' });
    const res = makeRes();
    await confirmHandler(withCheckout('cs_x'), res);
    expect(res.statusCode).toBe(402);
  });

  it('checkout já confirmado → 409', async () => {
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      mode: 'subscription',
      payment_status: 'paid',
      status: 'complete',
      metadata: { vc_confirmed_at: '1' },
      customer: 'cus_7',
      customer_details: { email: 'user7@teste.exemplo' },
      subscription: subAtiva('cus_7'),
    });
    const res = makeRes();
    await confirmHandler(withCheckout('cs_ok'), res);
    expect(res.statusCode).toBe(409);
    expect(cookieValue(res, COOKIE_NAME)).toBeFalsy();
  });

  it('sessão paga → active + cookie do customer certo, uma vez', async () => {
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      mode: 'subscription',
      payment_status: 'paid',
      status: 'complete',
      customer: 'cus_7',
      customer_details: { email: 'user7@teste.exemplo' },
      subscription: subAtiva('cus_7'),
      metadata: { email: 'user7@teste.exemplo' },
    });
    const res = makeRes();
    await confirmHandler(withCheckout('cs_ok'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ active: true, email: 'user7@teste.exemplo' });
    expect(res.body.customerId).toBeUndefined();
    expect(cookieValue(res, COOKIE_NAME)).toBeTruthy();
    expect(stripeMock.checkout.sessions.update).toHaveBeenCalledWith('cs_ok', expect.objectContaining({
      metadata: expect.objectContaining({ vc_confirmed_at: expect.any(String), vc_confirmed_binding: expect.any(String) }),
    }));
    expect(cookieValue(res, checkoutCookieName('cs_ok'))).toBe('');
  });

  it('perda da resposta permite retry só com cookie assinado do mesmo browser', async () => {
    const paidSession = {
      mode: 'subscription', payment_status: 'paid', status: 'complete',
      customer: 'cus_7', customer_details: { email: 'user7@teste.exemplo' },
      subscription: subAtiva('cus_7'), metadata: {},
    };
    stripeMock.checkout.sessions.retrieve.mockImplementation(async () => paidSession);
    stripeMock.checkout.sessions.update.mockImplementation(async (_id, data) => {
      paidSession.metadata = data.metadata;
      return paidSession;
    });
    const cookie = checkoutCookie('cs_retry');
    const request = post({ sessionId: 'cs_retry' }, { cookie });
    const first = makeRes();
    await confirmHandler(request, first);
    expect(first.statusCode).toBe(200);

    // O browser não recebeu a primeira resposta e reenvia o mesmo cookie.
    const retry = makeRes();
    await confirmHandler(request, retry);
    expect(retry.statusCode).toBe(200);
    expect(cookieValue(retry, COOKIE_NAME)).toBeTruthy();
    expect(stripeMock.checkout.sessions.update).toHaveBeenCalledTimes(1);

    const otherBrowser = makeRes();
    await confirmHandler(post({ sessionId: 'cs_retry' }), otherBrowser);
    expect(otherBrowser.statusCode).toBe(401);
  });

  it('falha ao registrar confirmação no Stripe não consome a prova do browser', async () => {
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      mode: 'subscription', payment_status: 'paid', status: 'complete',
      customer: 'cus_7', customer_details: { email: 'user7@teste.exemplo' },
      subscription: subAtiva('cus_7'), metadata: {},
    });
    stripeMock.checkout.sessions.update.mockRejectedValueOnce(new Error('Stripe temporariamente fora'));
    const cookie = checkoutCookie('cs_retry_update');
    const request = post({ sessionId: 'cs_retry_update' }, { cookie });
    const failed = makeRes();
    await confirmHandler(request, failed);
    expect(failed.statusCode).toBe(500);
    expect(cookieValue(failed, COOKIE_NAME)).toBeNull();

    const retry = makeRes();
    await confirmHandler(request, retry);
    expect(retry.statusCode).toBe(200);
    expect(cookieValue(retry, COOKIE_NAME)).toBeTruthy();
  });

  it('dois checkouts em abas distintas conservam cookies independentes', async () => {
    const first = checkoutCookie('cs_first');
    const second = checkoutCookie('cs_second');
    const cookies = `${first}; ${second}`;
    const response = makeRes();
    await confirmHandler(post({ sessionId: 'cs_first' }, { cookie: cookies }), response);
    expect(response.statusCode).toBe(400); // mock sem sessão, mas a ligação passou até Stripe
    expect(stripeMock.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_first', expect.any(Object));

    stripeMock.checkout.sessions.retrieve.mockClear();
    const ambiguous = makeRes();
    await confirmHandler(post({}, { cookie: cookies }), ambiguous);
    expect(ambiguous.statusCode).toBe(409);
    expect(stripeMock.checkout.sessions.retrieve).not.toHaveBeenCalled();
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
