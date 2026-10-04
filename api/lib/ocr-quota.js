/** Quota diária persistente para páginas lidas pelo OCR da plataforma. */
const memory = new Map();
export const DEFAULT_OCR_DAILY_LIMIT = 60;
export const DEGRADED_OCR_DAILY_LIMIT = 12;
let upstashUnavailableUntil = 0;

function production() {
  return process.env.VERCEL_ENV === 'production'
    || (!process.env.VERCEL_ENV && process.env.NODE_ENV === 'production');
}

function hasUpstash() {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') return false;
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim()
    && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

function dayKey(customerId, now = Date.now()) {
  return `vc:ocr:${String(customerId || 'unknown')}:${new Date(now).toISOString().slice(0, 10)}`;
}

async function upstash(command) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1_000);
  try {
    const response = await fetch(process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, ''), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Upstash HTTP ${response.status}`);
    return (await response.json())?.result;
  } finally {
    clearTimeout(timer);
  }
}

function configuredLimit() {
  const parsed = Number(process.env.OCR_DAILY_LIMIT);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(500, Math.floor(parsed))
    : DEFAULT_OCR_DAILY_LIMIT;
}

export async function consumeOcrCredit({ customerId, now = Date.now() } = {}) {
  const limit = configuredLimit();
  const key = dayKey(customerId, now);
  if (hasUpstash() && Date.now() >= upstashUnavailableUntil) {
    try {
      const used = Number(await upstash(['INCR', key])) || 0;
      if (used === 1) await upstash(['EXPIRE', key, 60 * 60 * 48]);
      if (used > limit) {
        await upstash(['DECR', key]);
        return { allowed: false, reason: 'exhausted', used: limit, limit };
      }
      return { allowed: true, used, limit };
    } catch (error) {
      console.error('[ocr-quota] armazenamento indisponível', error?.message || error);
      upstashUnavailableUntil = Date.now() + 5 * 60_000;
    }
  }

  // Último recurso: permite a função continuar com um teto conservador por
  // instância. O rate limit do endpoint continua ativo e reduz abuso óbvio.
  const effectiveLimit = production() ? Math.min(limit, DEGRADED_OCR_DAILY_LIMIT) : limit;
  const used = (memory.get(key) || 0) + 1;
  if (used > effectiveLimit) return { allowed: false, reason: 'exhausted', used: effectiveLimit, limit: effectiveLimit, degraded: production() };
  memory.set(key, used);
  return { allowed: true, used, limit: effectiveLimit, degraded: production() };
}

export async function refundOcrCredit({ customerId, now = Date.now() } = {}) {
  const key = dayKey(customerId, now);
  if (hasUpstash() && Date.now() >= upstashUnavailableUntil) {
    try {
      const next = Number(await upstash(['DECR', key])) || 0;
      if (next < 0) await upstash(['SET', key, '0']);
      return Math.max(0, next);
    } catch (error) {
      console.error('[ocr-quota] falha ao reembolsar', error?.message || error);
      upstashUnavailableUntil = Date.now() + 5 * 60_000;
    }
  }
  const next = Math.max(0, (memory.get(key) || 0) - 1);
  memory.set(key, next);
  return next;
}

export function resetOcrQuotaForTests() {
  memory.clear();
  upstashUnavailableUntil = 0;
}
