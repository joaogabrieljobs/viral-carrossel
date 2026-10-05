// A base Upstash deste projeto foi apagada e o fallback era um Map por instância,
// ou seja quota nenhuma: reiniciava a cada cold start e a plataforma pagava as
// imagens. Sem Redis, o contador passa a viver nos metadados do cliente Stripe.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stripeMock, resetStripeMock } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));

import { stripeQuotaGet, stripeQuotaConsume, stripeQuotaRefund, _LOCK_KEY } from '../../api/lib/quota-stripe-store.js';

const CUS = 'cus_quota';
const PERIODO = 1700000000;
const CHAVE = `vc_img_${PERIODO}`;

/** Mock stateful: retrieve reflecte o último update (necessário pro lock). */
function clienteStateful(inicial = {}) {
  let guardado = { ...inicial };
  stripeMock.customers.retrieve = vi.fn().mockImplementation(async () => ({
    id: CUS,
    metadata: { ...guardado },
  }));
  stripeMock.customers.update = vi.fn().mockImplementation(async (_id, { metadata }) => {
    guardado = { ...guardado, ...metadata };
    for (const [k, v] of Object.entries(metadata)) {
      if (v === '') delete guardado[k];
    }
    return { id: CUS };
  });
  return () => guardado;
}

beforeEach(() => {
  resetStripeMock();
  stripeMock.customers.retrieve = vi.fn();
  stripeMock.customers.update = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe('contador de imagens nos metadados do Stripe', () => {
  it('cliente sem contador começa em zero', async () => {
    clienteStateful({});
    expect(await stripeQuotaGet({ customerId: CUS, periodStartSec: PERIODO })).toBe(0);
  });

  it('consumir grava o próximo valor na chave do período', async () => {
    const snap = clienteStateful({ [CHAVE]: '3' });
    const usado = await stripeQuotaConsume({ customerId: CUS, periodStartSec: PERIODO, cap: 50 });
    expect(usado).toBe(4);
    expect(snap()[CHAVE]).toBe('4');
    expect(snap()[_LOCK_KEY]).toBeUndefined();
  });

  it('no tecto devolve acima do cap e NÃO grava o contador', async () => {
    const snap = clienteStateful({ [CHAVE]: '50' });
    const usado = await stripeQuotaConsume({ customerId: CUS, periodStartSec: PERIODO, cap: 50 });
    expect(usado).toBeGreaterThan(50);
    expect(snap()[CHAVE]).toBe('50');
  });

  it('reembolso desce um e nunca abaixo de zero', async () => {
    clienteStateful({ [CHAVE]: '1' });
    expect(await stripeQuotaRefund({ customerId: CUS, periodStartSec: PERIODO })).toBe(0);
    clienteStateful({ [CHAVE]: '0' });
    expect(await stripeQuotaRefund({ customerId: CUS, periodStartSec: PERIODO })).toBe(0);
  });

  it('períodos antigos são podados — metadados do Stripe têm 50 chaves', async () => {
    const snap = clienteStateful({
      vc_img_1000: '9',
      vc_img_2000: '8',
      vc_img_3000: '7',
      outra: 'manter',
    });
    await stripeQuotaConsume({ customerId: CUS, periodStartSec: PERIODO, cap: 50 });
    const meta = snap();
    expect(meta[CHAVE]).toBe('1');
    expect(meta.vc_img_3000).toBe('7');
    expect(meta.vc_img_2000).toBeUndefined();
    expect(meta.vc_img_1000).toBeUndefined();
    expect(meta.outra).toBe('manter');
  });

  it('cliente apagado no Stripe não é tratado como contador a zero', async () => {
    stripeMock.customers.retrieve = vi.fn().mockResolvedValue({ id: CUS, deleted: true });
    await expect(stripeQuotaGet({ customerId: CUS, periodStartSec: PERIODO })).rejects.toThrow(/inexistente/i);
  });

  it('valor corrompido nos metadados conta como zero, não como NaN', async () => {
    clienteStateful({ [CHAVE]: 'abc' });
    expect(await stripeQuotaGet({ customerId: CUS, periodStartSec: PERIODO })).toBe(0);
  });

  it('dois consumes paralelos não perdem incremento (lock)', async () => {
    const snap = clienteStateful({ [CHAVE]: '10' });
    const [a, b] = await Promise.all([
      stripeQuotaConsume({ customerId: CUS, periodStartSec: PERIODO, cap: 50 }),
      stripeQuotaConsume({ customerId: CUS, periodStartSec: PERIODO, cap: 50 }),
    ]);
    expect(new Set([a, b])).toEqual(new Set([11, 12]));
    expect(Number(snap()[CHAVE])).toBe(12);
  });
});

describe('encadeamento do armazenamento de quota', () => {
  it('sem Upstash, consumeImageCredit conta no Stripe e respeita o limite do plano', async () => {
    process.env.VC_QUOTA_ALLOW_STRIPE = '1';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { consumeImageCredit, refundImageCredit, getQuotaUsage } = await import('../../api/lib/image-quota.js');

    const snap = clienteStateful({ [CHAVE]: '49' });

    const args = { customerId: CUS, periodStartSec: PERIODO, periodEndSec: PERIODO + 2592000, limit: 50 };
    const ultima = await consumeImageCredit(args);
    expect(ultima).toMatchObject({ allowed: true, used: 50, remaining: 0 });
    expect(snap()[CHAVE]).toBe('50');

    const esgotada = await consumeImageCredit(args);
    expect(esgotada).toMatchObject({ allowed: false, reason: 'exhausted' });

    await refundImageCredit({ customerId: CUS, periodStartSec: PERIODO });
    expect(snap()[CHAVE]).toBe('49');
    expect(await getQuotaUsage(args)).toMatchObject({ used: 49, remaining: 1 });

    delete process.env.VC_QUOTA_ALLOW_STRIPE;
  });

  it('em produção, Stripe a falhar não degrada para memória (BE-005)', async () => {
    process.env.VC_QUOTA_ALLOW_STRIPE = '1';
    process.env.VERCEL_ENV = 'production';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { consumeImageCredit } = await import('../../api/lib/image-quota.js');

    stripeMock.customers.retrieve = vi.fn().mockRejectedValue(new Error('stripe down'));

    await expect(consumeImageCredit({
      customerId: CUS,
      periodStartSec: PERIODO,
      periodEndSec: PERIODO + 1000,
      limit: 50,
    })).rejects.toThrow(/quota_store_unavailable/);

    delete process.env.VC_QUOTA_ALLOW_STRIPE;
    delete process.env.VERCEL_ENV;
  });
});
