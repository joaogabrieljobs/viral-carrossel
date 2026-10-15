import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { consumeRateLimit, resetRateLimits } from '../../api/lib/rate-limit.js';

function req(ip = '1.2.3.4') {
  return { headers: { 'x-forwarded-for': ip } };
}

describe('consumeRateLimit', () => {
  beforeEach(() => resetRateLimits());
  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.RATE_LIMIT_TEST_UPSTASH;
    delete process.env.VERCEL_ENV;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('permite até o limite e depois devolve retryAfter', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect(await consumeRateLimit(req(), { limit: 3, windowMs: 60_000, keyPrefix: 't' })).toBeNull();
    }
    const limited = await consumeRateLimit(req(), { limit: 3, windowMs: 60_000, keyPrefix: 't' });
    expect(limited?.retryAfterSec).toBeGreaterThan(0);
  });

  it('isola prefixos e IPs', async () => {
    expect(await consumeRateLimit(req('10.0.0.1'), { limit: 1, windowMs: 60_000, keyPrefix: 'a' })).toBeNull();
    expect(await consumeRateLimit(req('10.0.0.1'), { limit: 1, windowMs: 60_000, keyPrefix: 'b' })).toBeNull();
    expect(await consumeRateLimit(req('10.0.0.2'), { limit: 1, windowMs: 60_000, keyPrefix: 'a' })).toBeNull();
    expect(await consumeRateLimit(req('10.0.0.1'), { limit: 1, windowMs: 60_000, keyPrefix: 'a' })).toMatchObject({
      retryAfterSec: expect.any(Number),
    });
  });

  it('usa o IP real da plataforma e, sem ele, o último hop de X-Forwarded-For', async () => {
    const opts = { limit: 1, windowMs: 60_000, keyPrefix: 'hop' };
    expect(await consumeRateLimit({
      headers: { 'x-forwarded-for': '1.1.1.1, 8.8.8.8', 'x-real-ip': '9.9.9.9' },
    }, opts)).toBeNull();
    expect(await consumeRateLimit({
      headers: { 'x-forwarded-for': '1.1.1.1, 8.8.8.8' },
    }, opts)).toBeNull();
    expect(await consumeRateLimit({
      headers: { 'x-real-ip': '9.9.9.9' },
    }, opts)).toMatchObject({ retryAfterSec: expect.any(Number) });
    expect(await consumeRateLimit({
      headers: { 'x-forwarded-for': '4.4.4.4, 8.8.8.8' },
    }, opts)).toMatchObject({ retryAfterSec: expect.any(Number) });
  });

  it('em produção, falha do Upstash usa limite local e tenta recuperar após 30 segundos', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T00:00:00Z'));
    process.env.RATE_LIMIT_TEST_UPSTASH = '1';
    process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    process.env.VERCEL_ENV = 'production';
    const fetchMock = vi.fn().mockRejectedValue(new Error('down'));
    vi.stubGlobal('fetch', fetchMock);
    const options = { limit: 2, windowMs: 60_000, keyPrefix: 'prod' };
    expect(await consumeRateLimit(req('7.7.7.7'), options)).toBeNull();
    expect(await consumeRateLimit(req('7.7.7.7'), options)).toBeNull();
    expect(await consumeRateLimit(req('7.7.7.7'), options)).toMatchObject({ retryAfterSec: expect.any(Number) });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_001);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result: 1 }) });
    expect(await consumeRateLimit(req('7.7.7.7'), options)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3); // INCR + EXPIRE após o cooldown
  });
});
