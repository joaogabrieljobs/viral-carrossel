// AUTH-02 (auditoria 23/11): trocar de plano no meio do checkout deixava a
// sessão de pagamento do plano anterior aberta no Stripe. Pagar as duas criava
// duas assinaturas no mesmo cliente. Stripe sempre mockado.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stripeMock, resetStripeMock } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));

import { makeReq, makeRes, cookieValue } from '../helpers/http.js';
import {
  CHECKOUT_IDENTITY_COOKIE, checkoutCookieName, setCheckoutIdentityCookie,
} from '../../api/lib/access.js';
import { getPlan } from '../../shared/plans.js';
import checkoutHandler from '../../api/stripe/checkout.js';

const EMAIL = 'dona@teste.exemplo';
const CUSTOMER = 'cus_troca_plano';
const PRO_PRICE_KEY = getPlan('pro').envPriceKey;
let previousProPrice;

const post = (body, cookie) => makeReq({ method: 'POST', body, cookie });

function provaDeLogin() {
  const proof = makeRes();
  setCheckoutIdentityCookie(proof, { email: EMAIL, customerId: CUSTOMER, source: 'verified_login' });
  return `${CHECKOUT_IDENTITY_COOKIE}=${encodeURIComponent(cookieValue(proof, CHECKOUT_IDENTITY_COOKIE))}`;
}

const sessaoAberta = (id, tier, extra = {}) => ({
  id,
  status: 'open',
  mode: 'subscription',
  url: `https://checkout.stripe.com/c/pay/${id}`,
  metadata: { product: 'viral-carrossel', email: EMAIL, tier },
  ...extra,
});

beforeEach(() => {
  resetStripeMock();
  previousProPrice = process.env[PRO_PRICE_KEY];
  process.env[PRO_PRICE_KEY] = 'price_pro_teste';
  stripeMock.customers.retrieve.mockResolvedValue({ id: CUSTOMER, email: EMAIL, metadata: {} });
  stripeMock.checkout.sessions.create.mockResolvedValue({
    id: 'cs_pro', url: 'https://checkout.stripe.com/c/pay/cs_pro',
  });
});

afterEach(() => {
  if (previousProPrice === undefined) delete process.env[PRO_PRICE_KEY];
  else process.env[PRO_PRICE_KEY] = previousProPrice;
});

describe('AUTH-02: checkout de outro plano fecha a sessão de pagamento anterior', () => {
  it('Criador aberto, depois Pro: a sessão do Criador é expirada antes de criar a do Pro', async () => {
    stripeMock.checkout.sessions.list.mockResolvedValue({ data: [sessaoAberta('cs_criador', 'creator')] });
    const res = makeRes();
    await checkoutHandler(post({ email: EMAIL, tier: 'pro' }, provaDeLogin()), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ sessionId: 'cs_pro', tier: 'pro' });
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
    expect(stripeMock.checkout.sessions.list).toHaveBeenCalledWith(expect.objectContaining({ customer: CUSTOMER, status: 'open' }));
    expect(stripeMock.checkout.sessions.expire).toHaveBeenCalledTimes(1);
    expect(stripeMock.checkout.sessions.expire).toHaveBeenCalledWith('cs_criador');
    expect(stripeMock.checkout.sessions.expire.mock.invocationCallOrder[0])
      .toBeLessThan(stripeMock.checkout.sessions.create.mock.invocationCallOrder[0]);
    // O cookie da compra fechada sai junto: não sobra "mais de um checkout neste browser".
    expect(cookieValue(res, checkoutCookieName('cs_criador'))).toBe('');
    expect(cookieValue(res, checkoutCookieName('cs_pro'))).toBeTruthy();
  });

  it('mesmo plano: reaproveita a sessão aberta e não expira nada', async () => {
    stripeMock.checkout.sessions.list.mockResolvedValue({ data: [sessaoAberta('cs_criador', 'creator')] });
    const res = makeRes();
    await checkoutHandler(post({ email: EMAIL, tier: 'creator' }, provaDeLogin()), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.sessionId).toBe('cs_criador');
    expect(stripeMock.checkout.sessions.expire).not.toHaveBeenCalled();
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('sessão de outro produto ou que não é assinatura fica intocada', async () => {
    stripeMock.checkout.sessions.list.mockResolvedValue({ data: [
      sessaoAberta('cs_outro_produto', 'creator', { metadata: { product: 'outro', tier: 'creator' } }),
      sessaoAberta('cs_avulso', 'creator', { mode: 'payment' }),
    ] });
    const res = makeRes();
    await checkoutHandler(post({ email: EMAIL, tier: 'pro' }, provaDeLogin()), res);

    expect(res.statusCode).toBe(200);
    expect(stripeMock.checkout.sessions.expire).not.toHaveBeenCalled();
  });

  it('voltar ao primeiro plano na mesma janela não repete a chave da sessão já fechada', async () => {
    // O Stripe devolve a resposta guardada quando a chave de idempotência se
    // repete: a mesma chave traria de volta a sessão do Criador já expirada.
    stripeMock.checkout.sessions.create.mockResolvedValue({
      id: 'cs_criador_1', url: 'https://checkout.stripe.com/c/pay/cs_criador_1',
    });
    const first = makeRes();
    await checkoutHandler(post({ email: EMAIL, tier: 'creator' }, provaDeLogin()), first);
    expect(first.statusCode).toBe(200);

    stripeMock.checkout.sessions.list.mockResolvedValue({ data: [sessaoAberta('cs_pro', 'pro')] });
    stripeMock.checkout.sessions.create.mockResolvedValue({
      id: 'cs_criador_2', url: 'https://checkout.stripe.com/c/pay/cs_criador_2',
    });
    const back = makeRes();
    await checkoutHandler(post({ email: EMAIL, tier: 'creator' }, provaDeLogin()), back);
    expect(back.statusCode).toBe(200);
    expect(stripeMock.checkout.sessions.expire).toHaveBeenCalledWith('cs_pro');

    const keys = stripeMock.checkout.sessions.create.mock.calls.map(([, options]) => options.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('sessão que outra requisição já expirou não impede o novo checkout', async () => {
    stripeMock.checkout.sessions.list.mockResolvedValue({ data: [sessaoAberta('cs_criador', 'creator')] });
    stripeMock.checkout.sessions.expire.mockRejectedValue(new Error('Only open sessions can be expired'));
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({ id: 'cs_criador', status: 'expired' });
    const res = makeRes();
    await checkoutHandler(post({ email: EMAIL, tier: 'pro' }, provaDeLogin()), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.sessionId).toBe('cs_pro');
  });

  it('sessão anterior que acabou de ser paga: não abre outro pagamento', async () => {
    stripeMock.checkout.sessions.list.mockResolvedValue({ data: [sessaoAberta('cs_criador', 'creator')] });
    stripeMock.checkout.sessions.expire.mockRejectedValue(new Error('Only open sessions can be expired'));
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({ id: 'cs_criador', status: 'complete' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = makeRes();
    await checkoutHandler(post({ email: EMAIL, tier: 'pro' }, provaDeLogin()), res);
    errorSpy.mockRestore();

    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    expect(res.body.url).toBeUndefined();
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
