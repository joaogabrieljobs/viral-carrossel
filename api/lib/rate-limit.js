/**
 * Rate limit simples em memória (por instância serverless).
 * Não substitui WAF; reduz abuse óbvio entre cold starts.
 */

const buckets = new Map();

function clientIp(req) {
  const xf = req.headers?.['x-forwarded-for'] || req.headers?.['X-Forwarded-For'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || req.headers?.['x-real-ip'] || 'unknown';
}

/**
 * @param {number} limit  Max pedidos na janela
 * @param {number} windowMs Janela em ms
 * @returns {null | { retryAfterSec: number }} null = ok
 */
export function consumeRateLimit(req, { limit = 30, windowMs = 60_000, keyPrefix = 'api' } = {}) {
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
  // Evita crescimento ilimitado do Map
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now - v.start >= windowMs) buckets.delete(k);
    }
  }
  return null;
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
