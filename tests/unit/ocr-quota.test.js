import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  consumeOcrCredit,
  refundOcrCredit,
  resetOcrQuotaForTests,
} from '../../api/lib/ocr-quota.js';

beforeEach(() => {
  process.env.OCR_DAILY_LIMIT = '2';
  resetOcrQuotaForTests();
});

afterEach(() => {
  delete process.env.OCR_DAILY_LIMIT;
  delete process.env.VERCEL_ENV;
});

describe('quota diária do OCR', () => {
  it('limita por cliente e permite reembolso de falha', async () => {
    expect((await consumeOcrCredit({ customerId: 'cus_a' })).allowed).toBe(true);
    expect((await consumeOcrCredit({ customerId: 'cus_a' })).allowed).toBe(true);
    expect((await consumeOcrCredit({ customerId: 'cus_a' })).allowed).toBe(false);
    expect((await consumeOcrCredit({ customerId: 'cus_b' })).allowed).toBe(true);
    await refundOcrCredit({ customerId: 'cus_a' });
    expect((await consumeOcrCredit({ customerId: 'cus_a' })).allowed).toBe(true);
  });

  it('mantém um teto local conservador em produção quando o contador partilhado não existe', async () => {
    process.env.VERCEL_ENV = 'production';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const result = await consumeOcrCredit({ customerId: 'cus_degraded' });
    expect(result).toMatchObject({ allowed: true, degraded: true, limit: 2 });
    await refundOcrCredit({ customerId: 'cus_degraded' });
    expect(await consumeOcrCredit({ customerId: 'cus_degraded' }))
      .toMatchObject({ allowed: true, used: 1, degraded: true });
  });
});
