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
});
