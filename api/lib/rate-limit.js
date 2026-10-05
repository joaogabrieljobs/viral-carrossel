/**
 * Rate limit por IP.
 *
 * Preferência: Upstash Redis (atómico entre instâncias serverless) quando
 * UPSTASH_REDIS_REST_* está configurado — auditoria BE-004.
 * Fallback: Map em memória (por cold start), igual ao comportamento histórico.
 */

const buckets = new Map();

function clientIp(req) {
  const xf = req.headers?.['x-forwarded-for'] || req.headers?.['X-Forwarded-For'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || req.headers?.['x-real-ip'] || 'unknown';
}

function hasUpstash() {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') return false;
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
  if (hasUpstash()) {
    try {
      return await consumeUpstash(req, { limit, windowMs, keyPrefix });
    } catch (e) {
      console.warn('[rate-limit] Upstash falhou, memória local:', e?.message || e);
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
}
