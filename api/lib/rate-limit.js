/**
 * Rate limit por IP.
 *
 * Preferência: Upstash Redis (atómico entre instâncias serverless) quando
 * UPSTASH_REDIS_REST_* está configurado — auditoria BE-004.
 * Fallback: Map em memória (por cold start), igual ao comportamento histórico.
 */

const buckets = new Map();
const UPSTASH_RETRY_MS = 30_000;
let upstashUnavailableUntil = 0;

function headerValue(headers, name) {
  const value = headers?.[name] || headers?.[name.toLowerCase()];
  return typeof value === 'string' ? value.trim() : '';
}

function clientIp(req) {
  const headers = req.headers || {};
  const trusted = headerValue(headers, 'x-real-ip') || headerValue(headers, 'x-vercel-forwarded-for');
  if (trusted) return trusted.split(',')[0].trim();
  const xf = headerValue(headers, 'x-forwarded-for');
  if (xf) {
    const parts = xf.split(',').map((part) => part.trim()).filter(Boolean);
    return parts[parts.length - 1] || 'unknown';
  }
  return req.socket?.remoteAddress || 'unknown';
}

function hasUpstash() {
  const testing = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
  if (testing && process.env.RATE_LIMIT_TEST_UPSTASH !== '1') return false;
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim()
    && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

async function upstash(command) {
  const base = process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_500);
  try {
    const res = await fetch(`${base}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Upstash ${res.status}: ${text.slice(0, 120)}`);
    }
    const json = await res.json();
    return json?.result;
  } finally {
    clearTimeout(timer);
  }
}

function consumeMemory(req, { limit, windowMs, keyPrefix }) {
  const ip = clientIp(req);
  const key = `${keyPrefix}:${ip}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= windowMs) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - bucket.start)) / 1000));
    return { retryAfterSec };
  }
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now - v.start >= windowMs) buckets.delete(k);
    }
  }
  return null;
}

async function consumeUpstash(req, { limit, windowMs, keyPrefix }) {
  const ip = clientIp(req);
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  // Janela fixa alinhada ao epoch — partilhada entre lambdas.
  const slot = Math.floor(Date.now() / windowMs);
  const key = `vc:rl:${keyPrefix}:${ip}:${slot}`;
  const count = Number(await upstash(['INCR', key])) || 0;
  if (count === 1) {
    await upstash(['EXPIRE', key, windowSec + 1]);
  }
  if (count > limit) {
    const retryAfterSec = Math.max(1, windowSec - Math.floor((Date.now() % windowMs) / 1000));
    return { retryAfterSec };
  }
  return null;
}

/**
 * @param {number} limit  Max pedidos na janela
 * @param {number} windowMs Janela em ms
 * @returns {Promise<null | { retryAfterSec: number }>} null = ok
 */
export async function consumeRateLimit(req, { limit = 30, windowMs = 60_000, keyPrefix = 'api' } = {}) {
  if (hasUpstash() && Date.now() >= upstashUnavailableUntil) {
    try {
      const result = await consumeUpstash(req, { limit, windowMs, keyPrefix });
      upstashUnavailableUntil = 0;
      return result;
    } catch (e) {
      upstashUnavailableUntil = Date.now() + UPSTASH_RETRY_MS;
      console.warn('[rate-limit] Upstash falhou; usando limite local temporário:', e?.message || e);
    }
  }
  return consumeMemory(req, { limit, windowMs, keyPrefix });
}

export function rateLimitResponse(res, retryAfterSec, nested = false) {
  res.setHeader('Retry-After', String(retryAfterSec));
  const message = 'Demasiados pedidos. Aguarde um momento e tente de novo.';
  return res.status(429).json(
    nested ? { error: { message } } : { error: message },
  );
}

/** Só para testes — limpa buckets em memória. */
export function resetRateLimits() {
  buckets.clear();
  upstashUnavailableUntil = 0;
}
