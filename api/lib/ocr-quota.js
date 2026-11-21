/** Quota diária persistente para páginas lidas pelo OCR da plataforma. */
import { consumePostgresOcrCredit, refundPostgresOcrCredit } from './ocr-quota-postgres.js';

const memory = new Map();
const memoryRefunds = new Map();
export const DEFAULT_OCR_DAILY_LIMIT = 60;
// MOO-29: estornos de falha com custo provável do provedor (timeout) por
// conta e dia. Passando do teto, a chamada conta como uso.
export const DEFAULT_OCR_REFUND_DAILY_LIMIT = 10;
export const DEGRADED_OCR_DAILY_LIMIT = 12;
let upstashUnavailableUntil = 0;

function production() {
  return process.env.VERCEL_ENV === 'production'
    || (!process.env.VERCEL_ENV && process.env.NODE_ENV === 'production');
}

function hasUpstash() {
  if (process.env.UPSTASH_DISABLED === '1') return false;
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') return false;
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim()
    && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

// O dia da cota é o dia em Brasília, não o dia UTC (virava às 21h, MOO-30).
const BRAZIL_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
export function ocrQuotaDay(now = Date.now()) {
  return BRAZIL_DAY.format(new Date(now));
}

function dayKey(customerId, now = Date.now()) {
  return `vc:ocr:${String(customerId || 'unknown')}:${ocrQuotaDay(now)}`;
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

export function ocrRefundDailyLimit() {
  const parsed = Number(process.env.OCR_REFUND_DAILY_LIMIT);
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.min(500, Math.floor(parsed))
    : DEFAULT_OCR_REFUND_DAILY_LIMIT;
}

function configuredLimit() {
  const parsed = Number(process.env.OCR_DAILY_LIMIT);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(500, Math.floor(parsed))
    : DEFAULT_OCR_DAILY_LIMIT;
}

export async function consumeOcrCredit({ customerId, now = Date.now(), operationId } = {}) {
  const limit = configuredLimit();
  if (process.env.OCR_QUOTA_BACKEND === 'postgres') {
    try {
      return await consumePostgresOcrCredit({ customerId, now, limit, operationId });
    } catch (error) {
      // Quota paga não pode virar um contador local por instância se o banco cair.
      console.error('[ocr-quota] Postgres indisponível:', error?.message || error);
      return { allowed: false, reason: 'unavailable', used: null, limit };
    }
  }
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

  // Produção sem contador partilhado não pode contar 12 por instância.
  if (production()) {
    return { allowed: false, reason: 'unavailable', used: null, limit };
  }

  // Fora de produção, um teto local deixa o teste e o dev seguirem.
  const effectiveLimit = production() ? Math.min(limit, DEGRADED_OCR_DAILY_LIMIT) : limit;
  const used = (memory.get(key) || 0) + 1;
  if (used > effectiveLimit) return { allowed: false, reason: 'exhausted', used: effectiveLimit, limit: effectiveLimit, degraded: production() };
  memory.set(key, used);
  return { allowed: true, used, limit: effectiveLimit, degraded: production() };
}

/**
 * Todo estorno entra na contagem diária. `capped: true` (timeout, quando o
 * provedor provavelmente cobrou) só estorna enquanto a conta estiver abaixo
 * do teto; acima dele a chamada fica como uso. Erro explícito do provedor
 * (sem `capped`) continua sempre estornado.
 */
export async function refundOcrCredit({ customerId, now = Date.now(), operationId, capped = false } = {}) {
  const maxRefunds = capped ? ocrRefundDailyLimit() : null;
  if (process.env.OCR_QUOTA_BACKEND === 'postgres') {
    try { return await refundPostgresOcrCredit({ customerId, now, operationId, maxRefunds }); }
    catch (error) {
      console.error('[ocr-quota] falha ao reembolsar no Postgres:', error?.message || error);
      return null;
    }
  }
  const key = dayKey(customerId, now);
  const refundKey = `${key}:refunds`;
  if (hasUpstash() && Date.now() >= upstashUnavailableUntil) {
    try {
      if (maxRefunds != null && (Number(await upstash(['GET', refundKey])) || 0) >= maxRefunds) {
        return Number(await upstash(['GET', key])) || 0;
      }
      const refunds = Number(await upstash(['INCR', refundKey])) || 0;
      if (refunds === 1) await upstash(['EXPIRE', refundKey, 60 * 60 * 48]);
      const next = Number(await upstash(['DECR', key])) || 0;
      if (next < 0) await upstash(['SET', key, '0']);
      return Math.max(0, next);
    } catch (error) {
      console.error('[ocr-quota] falha ao reembolsar', error?.message || error);
      upstashUnavailableUntil = Date.now() + 5 * 60_000;
    }
  }
  const refunds = memoryRefunds.get(refundKey) || 0;
  if (maxRefunds != null && refunds >= maxRefunds) return memory.get(key) || 0;
  memoryRefunds.set(refundKey, refunds + 1);
  const next = Math.max(0, (memory.get(key) || 0) - 1);
  memory.set(key, next);
  return next;
}

export function resetOcrQuotaForTests() {
  memory.clear();
  memoryRefunds.clear();
  upstashUnavailableUntil = 0;
}
