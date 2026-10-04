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
});
