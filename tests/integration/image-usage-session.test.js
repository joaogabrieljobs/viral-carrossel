import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStripeMock, stripeMock } from '../helpers/stripe-mock.js';
vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));
vi.mock('../../api/lib/image-quota.js', () => ({ getQuotaUsage: vi.fn() }));
import { getQuotaUsage } from '../../api/lib/image-quota.js';
import { createAccessToken, COOKIE_NAME } from '../../api/lib/access.js';
import sessionHandler from '../../api/auth/session.js';
import { makeReq, makeRes } from '../helpers/http.js';

const start = 1791846000;
const end = 1794524400;
const subscription = (tier = 'creator') => ({
  id: 'sub_usage', status: 'active', metadata: { tier },
  items: { data: [{ current_period_start: start, current_period_end: end }] },
});

async function session(sub = subscription()) {
  stripeMock.subscriptions.list.mockResolvedValue({ data: [sub] });
  const cookie = `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId: 'cus_usage', email: 'usage@teste.exemplo' }))}`;
  const res = makeRes();
  await sessionHandler(makeReq({ cookie }), res);
  return res;
}

beforeEach(() => {
  resetStripeMock();
  getQuotaUsage.mockReset().mockResolvedValue({ used: 12, limit: 50, remaining: 38, allowed: true });
});

describe('saldo de imagens na sessão', () => {
  it('expõe uso e renovação do mesmo ciclo atual informado pelo Stripe', async () => {
    const res = await session();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ active: true,
      currentPeriodStart: new Date(start * 1000).toISOString(),
      currentPeriodEnd: new Date(end * 1000).toISOString(),
      imageQuota: { used: 12, limit: 50, remaining: 38, allowed: true, status: 'available', available: true, tier: 'creator' },
    });
    expect(getQuotaUsage).toHaveBeenCalledWith({ customerId: 'cus_usage', periodStartSec: start, limit: 50 });
  });

  it('falha do contador mantém assinatura ativa e informa saldo desconhecido', async () => {
    getQuotaUsage.mockRejectedValue(new Error('counter unavailable'));
    const res = await session();
    expect(res.body).toMatchObject({ active: true, tier: 'creator', imageQuota: {
      used: null, remaining: null, limit: 50, allowed: false,
      available: false, status: 'unavailable', code: 'quota_store_unavailable',
    } });
  });

  it('não consulta a chave nop nem anuncia saldo cheio sem período válido', async () => {
    const res = await session({ ...subscription(), items: { data: [{}] } });
    expect(res.body.imageQuota).toMatchObject({ status: 'unavailable', used: null, remaining: null, code: 'quota_period_unavailable' });
    expect(getQuotaUsage).not.toHaveBeenCalled();
  });

  it('saldo esgotado é um valor confirmado, diferente de consulta indisponível', async () => {
    getQuotaUsage.mockResolvedValue({ used: 50, limit: 50, remaining: 0, allowed: false });
    const res = await session();
    expect(res.body.imageQuota).toMatchObject({ available: true, status: 'available', used: 50, remaining: 0, allowed: false });
  });

  it('plano sem geração informa zero confirmado sem depender do contador', async () => {
    const res = await session({ ...subscription('essential'), items: { data: [{}] } });
    expect(res.body.imageQuota).toMatchObject({ available: true, used: 0, limit: 0, remaining: 0, allowed: false });
    expect(getQuotaUsage).not.toHaveBeenCalled();
  });
});
