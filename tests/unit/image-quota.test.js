import { describe, it, expect, beforeEach } from 'vitest';
import {
  consumeImageCredit,
  getQuotaUsage,
  refundImageCredit,
  resetMemoryQuotas,
} from '../../api/lib/image-quota.js';
import {
  resolveTierFromPriceId,
  imageQuotaForTier,
  getPlan,
} from '../../api/lib/plans.js';
import { PLAN_TIERS, PLAN_ORDER } from '../../shared/plans.js';

describe('shared plans', () => {
  it('tem 4 tiers com quotas LOCKED do PRD', () => {
    expect(PLAN_ORDER).toEqual(['essential', 'creator', 'pro', 'max']);
    expect(PLAN_TIERS.essential.imageQuota).toBe(0);
    expect(PLAN_TIERS.creator.imageQuota).toBe(50);
    expect(PLAN_TIERS.pro.imageQuota).toBe(150);
    expect(PLAN_TIERS.max.imageQuota).toBe(300);
  });
});

describe('plans resolve', () => {
  it('price desconhecido cai em creator (legado R$97)', () => {
    expect(resolveTierFromPriceId('price_unknown')).toBe('creator');
    expect(imageQuotaForTier('creator')).toBe(50);
    expect(getPlan('essential').priceBRL).toBe(19.9);
  });
});

describe('image-quota memory', () => {
  beforeEach(() => {
    resetMemoryQuotas();
  });

  it('bloqueia quando limit=0', async () => {
    const r = await consumeImageCredit({
      customerId: 'cus_a',
      periodStartSec: 1000,
      periodEndSec: 2000,
      limit: 0,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('no_quota');
  });

  it('consome até o limite e depois bloqueia', async () => {
    const args = {
      customerId: 'cus_b',
      periodStartSec: 1000,
      periodEndSec: 2000,
      limit: 2,
    };
    const a = await consumeImageCredit(args);
    const b = await consumeImageCredit(args);
    const c = await consumeImageCredit(args);
    expect(a.allowed).toBe(true);
    expect(a.used).toBe(1);
    expect(b.allowed).toBe(true);
    expect(b.used).toBe(2);
    expect(c.allowed).toBe(false);
    expect(c.reason).toBe('exhausted');
    const usage = await getQuotaUsage(args);
    expect(usage.used).toBe(2);
    expect(usage.remaining).toBe(0);
  });

  it('refund devolve crédito após falha', async () => {
    const args = {
      customerId: 'cus_c',
      periodStartSec: 1000,
      periodEndSec: 2000,
      limit: 1,
    };
    await consumeImageCredit(args);
    await refundImageCredit({ customerId: 'cus_c', periodStartSec: 1000 });
    const again = await consumeImageCredit(args);
    expect(again.allowed).toBe(true);
    expect(again.used).toBe(1);
  });
});
