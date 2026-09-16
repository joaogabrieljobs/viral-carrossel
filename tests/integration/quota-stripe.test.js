// A base Upstash deste projeto foi apagada e o fallback era um Map por instância,
// ou seja quota nenhuma: reiniciava a cada cold start e a plataforma pagava as
// imagens. Sem Redis, o contador passa a viver nos metadados do cliente Stripe.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stripeMock, resetStripeMock } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));

import { stripeQuotaGet, stripeQuotaConsume, stripeQuotaRefund } from '../../api/lib/quota-stripe-store.js';

const CUS = 'cus_quota';
const PERIODO = 1700000000;
const CHAVE = `vc_img_${PERIODO}`;

function clienteCom(metadata) {
  stripeMock.customers.retrieve = vi.fn().mockResolvedValue({ id: CUS, metadata });
  stripeMock.customers.update = vi.fn().mockResolvedValue({ id: CUS });
}

beforeEach(() => {
  resetStripeMock();
  stripeMock.customers.retrieve = vi.fn();
  stripeMock.customers.update = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe('contador de imagens nos metadados do Stripe', () => {
  it('cliente sem contador começa em zero', async () => {
    clienteCom({});
    expect(await stripeQuotaGet({ customerId: CUS, periodStartSec: PERIODO })).toBe(0);
  });

  it('consumir grava o próximo valor na chave do período', async () => {
    clienteCom({ [CHAVE]: '3' });
    const usado = await stripeQuotaConsume({ customerId: CUS, periodStartSec: PERIODO, cap: 50 });
    expect(usado).toBe(4);
    expect(stripeMock.customers.update).toHaveBeenCalledWith(CUS, { metadata: { [CHAVE]: '4' } });
  });

  it('no tecto devolve acima do cap e NÃO grava', async () => {
    clienteCom({ [CHAVE]: '50' });
    const usado = await stripeQuotaConsume({ customerId: CUS, periodStartSec: PERIODO, cap: 50 });
    expect(usado).toBeGreaterThan(50);
    expect(stripeMock.customers.update).not.toHaveBeenCalled();
  });

  it('reembolso desce um e nunca abaixo de zero', async () => {
    clienteCom({ [CHAVE]: '1' });
    expect(await stripeQuotaRefund({ customerId: CUS, periodStartSec: PERIODO })).toBe(0);
    clienteCom({ [CHAVE]: '0' });
    expect(await stripeQuotaRefund({ customerId: CUS, periodStartSec: PERIODO })).toBe(0);
  });

  it('períodos antigos são podados — metadados do Stripe têm 50 chaves', async () => {
    clienteCom({ vc_img_1000: '9', vc_img_2000: '8', vc_img_3000: '7', outra: 'manter' });
    await stripeQuotaConsume({ customerId: CUS, periodStartSec: PERIODO, cap: 50 });
    const patch = stripeMock.customers.update.mock.calls[0][1].metadata;
    expect(patch[CHAVE]).toBe('1');
    // mantém o período mais recente e apaga os restantes (valor '' remove no Stripe)
    expect(patch.vc_img_3000).toBeUndefined();
    expect(patch.vc_img_2000).toBe('');
    expect(patch.vc_img_1000).toBe('');
    expect(patch.outra).toBeUndefined();
  });

  it('cliente apagado no Stripe não é tratado como contador a zero', async () => {
    stripeMock.customers.retrieve = vi.fn().mockResolvedValue({ id: CUS, deleted: true });
    await expect(stripeQuotaGet({ customerId: CUS, periodStartSec: PERIODO })).rejects.toThrow(/inexistente/i);
  });

  it('valor corrompido nos metadados conta como zero, não como NaN', async () => {
    clienteCom({ [CHAVE]: 'abc' });
    expect(await stripeQuotaGet({ customerId: CUS, periodStartSec: PERIODO })).toBe(0);
  });
});

describe('encadeamento do armazenamento de quota', () => {
  it('sem Upstash, consumeImageCredit conta no Stripe e respeita o limite do plano', async () => {
    process.env.VC_QUOTA_ALLOW_STRIPE = '1';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { consumeImageCredit, refundImageCredit, getQuotaUsage } = await import('../../api/lib/image-quota.js');

    let guardado = { [CHAVE]: '49' };
    stripeMock.customers.retrieve = vi.fn().mockImplementation(async () => ({ id: CUS, metadata: guardado }));
    stripeMock.customers.update = vi.fn().mockImplementation(async (_id, { metadata }) => {
      guardado = { ...guardado, ...metadata };
      return { id: CUS };
    });

    const args = { customerId: CUS, periodStartSec: PERIODO, periodEndSec: PERIODO + 2592000, limit: 50 };
    const ultima = await consumeImageCredit(args);
    expect(ultima).toMatchObject({ allowed: true, used: 50, remaining: 0 });
    expect(guardado[CHAVE]).toBe('50');

    const esgotada = await consumeImageCredit(args);
    expect(esgotada).toMatchObject({ allowed: false, reason: 'exhausted' });

    await refundImageCredit({ customerId: CUS, periodStartSec: PERIODO });
    expect(guardado[CHAVE]).toBe('49');
    expect(await getQuotaUsage(args)).toMatchObject({ used: 49, remaining: 1 });

    delete process.env.VC_QUOTA_ALLOW_STRIPE;
  });
});
