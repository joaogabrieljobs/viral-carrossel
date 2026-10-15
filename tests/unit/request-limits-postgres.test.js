import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({ unsafe: vi.fn(), begin: vi.fn() }));
vi.mock('../../api/lib/postgres-connection.js', () => ({
  getPostgresConnection: () => database,
}));

import { consumeRateLimit, resetRateLimits } from '../../api/lib/rate-limit.js';
import { consumeOcrCredit, refundOcrCredit, resetOcrQuotaForTests } from '../../api/lib/ocr-quota.js';

beforeEach(() => {
  database.unsafe.mockReset();
  database.begin.mockReset();
  vi.spyOn(Math, 'random').mockReturnValue(0.5); // sem limpeza oportunista
  resetRateLimits();
  resetOcrQuotaForTests();
});

afterEach(() => {
  delete process.env.RATE_LIMIT_BACKEND;
  delete process.env.OCR_QUOTA_BACKEND;
  delete process.env.OCR_DAILY_LIMIT;
  delete process.env.UPSTASH_DISABLED;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.RATE_LIMIT_TEST_UPSTASH;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('rate limit partilhado no Postgres', () => {
  it('conta atomicamente por IP, rota e janela, sem guardar o IP em texto', async () => {
    process.env.RATE_LIMIT_BACKEND = 'postgres';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T12:00:00.000Z'));
    database.unsafe
      .mockResolvedValueOnce([{ hits: 1 }])
      .mockResolvedValueOnce([{ hits: 2 }])
      .mockResolvedValueOnce([{ hits: 3 }]);
    const request = { headers: { 'x-real-ip': '203.0.113.4' } };
    const options = { limit: 2, windowMs: 60_000, keyPrefix: 'login' };

    expect(await consumeRateLimit(request, options)).toBeNull();
    expect(await consumeRateLimit(request, options)).toBeNull();
    expect(await consumeRateLimit(request, options)).toMatchObject({ retryAfterSec: 60 });
    expect(database.unsafe).toHaveBeenCalledTimes(3);
    const [sql, params] = database.unsafe.mock.calls[0];
    expect(sql).toContain('ON CONFLICT (bucket_hash, window_slot) DO UPDATE');
    expect(sql).toContain('RETURNING hits');
    expect(params[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(params)).not.toContain('203.0.113.4');
    expect(params[1]).toBe(Math.floor(Date.now() / 60_000));
    expect(database.unsafe.mock.calls[1][1][0]).toBe(params[0]);
  });

  it('se o banco cai, mantém um limite local temporário sem consultar o Upstash morto', async () => {
    process.env.RATE_LIMIT_BACKEND = 'postgres';
    process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    database.unsafe.mockRejectedValueOnce(new Error('offline'));
    const request = { headers: { 'x-real-ip': '203.0.113.5' } };
    const options = { limit: 1, windowMs: 60_000, keyPrefix: 'login' };
    expect(await consumeRateLimit(request, options)).toBeNull();
    expect(await consumeRateLimit(request, options)).toMatchObject({ retryAfterSec: expect.any(Number) });
    expect(database.unsafe).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('ignora credenciais Upstash antigas quando a fonte está desativada', async () => {
    process.env.UPSTASH_DISABLED = '1';
    process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    process.env.RATE_LIMIT_TEST_UPSTASH = '1';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const request = { headers: { 'x-real-ip': '203.0.113.6' } };
    const options = { limit: 1, windowMs: 60_000, keyPrefix: 'login' };
    expect(await consumeRateLimit(request, options)).toBeNull();
    expect(await consumeRateLimit(request, options)).toMatchObject({ retryAfterSec: expect.any(Number) });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('quota diária de OCR no Postgres', () => {
  function fakeQuotaStore() {
    const days = new Map();
    const operations = new Map();
    const query = vi.fn(async (sql, params) => {
      const key = `${params[0]}:${params[1]}`;
      const operationKey = `${key}:${params[2]}`;
      if (sql.includes('INSERT INTO moont.ocr_daily_quotas')) {
        if (!days.has(key)) days.set(key, 0);
        return [];
      }
      if (sql.includes('SELECT used FROM moont.ocr_daily_quotas')) {
        return days.has(key) ? [{ used: days.get(key) }] : [];
      }
      if (sql.includes('SELECT status FROM moont.ocr_daily_operations')) {
        return operations.has(operationKey) ? [{ status: operations.get(operationKey) }] : [];
      }
      if (sql.includes('SET used = used + 1')) {
        days.set(key, days.get(key) + 1);
        return [{ used: days.get(key) }];
      }
      if (sql.includes('INSERT INTO moont.ocr_daily_operations')) {
        operations.set(operationKey, 'reserved');
        return [];
      }
      if (sql.includes("SET status = 'refunded'")) {
        if (operations.get(operationKey) !== 'reserved') return [];
        operations.set(operationKey, 'refunded');
        return [{ operation_id: params[2] }];
      }
      if (sql.includes('SET used = GREATEST(0, used - 1)')) {
        days.set(key, Math.max(0, days.get(key) - 1));
        return [{ used: days.get(key) }];
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    database.begin.mockImplementation(async (work) => work({ unsafe: query }));
    return { days, operations, query };
  }

  it('reserva e reembolsa uma única vez no mesmo dia UTC', async () => {
    process.env.OCR_QUOTA_BACKEND = 'postgres';
    process.env.OCR_DAILY_LIMIT = '2';
    const store = fakeQuotaStore();
    const now = Date.parse('2026-10-15T23:59:00.000Z');
    const input = { customerId: 'cus_test', now, operationId: 'ocr-1' };
    expect(await consumeOcrCredit(input)).toMatchObject({ allowed: true, used: 1, limit: 2 });
    expect(await consumeOcrCredit(input)).toMatchObject({ allowed: true, used: 1, limit: 2 });
    expect(await refundOcrCredit(input)).toBe(0);
    expect(await refundOcrCredit(input)).toBe(0);
    expect(await consumeOcrCredit(input)).toMatchObject({ allowed: false, reason: 'refunded' });
    expect(store.days.get('cus_test:2026-10-15')).toBe(0);
    expect(store.query.mock.calls.some(([sql]) => sql.includes('FOR UPDATE'))).toBe(true);
    expect(store.query.mock.calls.some(([sql, params]) =>
      sql.includes('ocr_daily_operations') && params?.[1] === '2026-10-15')).toBe(true);
  });

  it('bloqueia a terceira reserva diária e mantém contas separadas', async () => {
    process.env.OCR_QUOTA_BACKEND = 'postgres';
    process.env.OCR_DAILY_LIMIT = '2';
    const store = fakeQuotaStore();
    const now = Date.parse('2026-10-15T23:59:00.000Z');
    for (const operationId of ['a', 'b']) {
      expect(await consumeOcrCredit({ customerId: 'cus_test', now, operationId }))
        .toMatchObject({ allowed: true });
    }
    expect(await consumeOcrCredit({ customerId: 'cus_test', now, operationId: 'c' }))
      .toMatchObject({ allowed: false, reason: 'exhausted', used: 2 });
    expect(await consumeOcrCredit({ customerId: 'cus_other', now, operationId: 'd' }))
      .toMatchObject({ allowed: true, used: 1 });
    expect(store.days.get('cus_test:2026-10-15')).toBe(2);
    expect(store.days.get('cus_other:2026-10-15')).toBe(1);
  });

  it('falha fechado quando o banco não está disponível', async () => {
    process.env.OCR_QUOTA_BACKEND = 'postgres';
    process.env.OCR_DAILY_LIMIT = '2';
    process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    database.begin.mockRejectedValueOnce(new Error('offline'));
    expect(await consumeOcrCredit({ customerId: 'cus_test', operationId: 'ocr-1' })).toMatchObject({
      allowed: false, reason: 'unavailable', used: null, limit: 2,
    });
    expect(database.begin).toHaveBeenCalledTimes(1);
  });
});
