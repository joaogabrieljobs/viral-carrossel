/**
 * Quota mensal de imagens SJinn por customerId + período de facturação.
 *
 * Três caminhos, por ordem de preferência:
 *   1. Upstash Redis REST — incremento atómico, é o melhor quando existe.
 *   2. Metadados do cliente Stripe — sem serviço extra, sobrevive a cold starts.
 *      É o que segura a quota desde que a base Upstash deste projeto foi apagada.
 *   3. Map em memória — só testes e dev (nunca em produção Vercel — BE-005).
 *
 * O caminho 2 existe porque o 3 não é quota nenhuma: reiniciava a cada instância,
 * logo um assinante gerava sem limite e a plataforma pagava (auditoria H5).
 */
import { stripeQuotaGet, stripeQuotaConsume, stripeQuotaRefund } from './quota-stripe-store.js';
import { isUpstashDisabled } from './upstash-config.js';

const memory = new Map();

/** Tecto por instância no último recurso (não-prod / testes). Em prod falha fechado. */
export const DEGRADED_FALLBACK_CAP = 25;
let _warnedNoUpstash = false;

function hasUpstash() {
  // Unitários usam só memória (Upstash de prod/local pode estar offline e estourar timeout).
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') return false;
  if (isUpstashDisabled()) return false;
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim()
    && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

function isProductionQuotaStrict() {
  return process.env.VERCEL_ENV === 'production';
}

function quotaKey(customerId, periodStartSec) {
  return `vc:imgquota:${customerId}:${periodStartSec || 'nop'}`;
}

function usesPostgresQuota() {
  return process.env.IMAGE_QUOTA_BACKEND === 'postgres';
}

async function upstash(command) {
  const base = process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
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
      throw new Error(`Upstash ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    if (json?.error) throw new Error('Upstash devolveu erro ao consultar o contador.');
    return json?.result;
  } finally {
    clearTimeout(timer);
  }
}

/** Só há Stripe utilizável com um customerId real (dev com BILLING_DISABLED não tem). */
function podeUsarStripe(customerId) {
  // Nos testes o Stripe está mockado; o caminho só é exercitado quando o próprio
  // teste o pede (VC_QUOTA_ALLOW_STRIPE), para os outros ficarem determinísticos.
  const emTeste = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
  if (emTeste && process.env.VC_QUOTA_ALLOW_STRIPE !== '1') return false;
  const id = String(customerId || '');
  return id.startsWith('cus_') && !!String(process.env.STRIPE_SECRET_KEY || '').trim();
}

/**
 * Executa no primeiro armazenamento disponível: Upstash, senão Stripe, senão
 * memória. Em produção, se Stripe falhar (sem Upstash), falha fechado — não
 * concede 25 créditos por instância (auditoria BE-005).
 * `memoryFn` recebe `degraded: true` quando a contagem deixou de ser
 * partilhada entre instâncias — é o sinal para aplicar o tecto de último recurso.
 */
async function withQuotaStore(upstashFn, memoryFn, stripeFn, customerId) {
  if (hasUpstash()) {
    try {
      return await upstashFn();
    } catch (e) {
      console.warn('[image-quota] Upstash falhou:', e?.message || e);
    }
  } else if (!_warnedNoUpstash && process.env.VERCEL_ENV === 'production') {
    _warnedNoUpstash = true;
    console.warn('[image-quota] sem Upstash — a contagem vai pelos metadados do cliente Stripe.');
  }
  if (stripeFn && podeUsarStripe(customerId)) {
    try {
      return await stripeFn();
    } catch (e) {
      console.error('[image-quota] contador no Stripe falhou:', e?.message || e);
      if (isProductionQuotaStrict()) {
        const err = new Error('quota_store_unavailable');
        err.code = 'quota_store_unavailable';
        throw err;
      }
    }
  }
  if (isProductionQuotaStrict()) {
    // Sem contador persistente, nem uma configuração incompleta pode conceder
    // créditos por instância ou apresentar saldo fictício em produção.
    const err = new Error('quota_store_unavailable');
    err.code = 'quota_store_unavailable';
    throw err;
  }
  return memoryFn({ degraded: true });
}

function ttlSeconds(periodEndSec) {
  if (!periodEndSec) return 60 * 60 * 24 * 40; // ~40 dias
  const sec = Math.max(60, periodEndSec - Math.floor(Date.now() / 1000) + 3600);
  return sec;
}

async function memoryGet(key) {
  return memory.get(key) || 0;
}

async function memoryIncr(key) {
  // Sem TTL: a chave inclui periodStart, roda sozinha a cada período; a instância é efémera.
  const next = (memory.get(key) || 0) + 1;
  memory.set(key, next);
  return next;
}

async function memoryDecr(key) {
  const cur = memory.get(key) || 0;
  const next = Math.max(0, cur - 1);
  memory.set(key, next);
  return next;
}

/**
 * Leitura de migração: toma o maior contador persistente entre Upstash e Stripe.
 * Se qualquer fonte configurada não responder, não presume que o saldo é zero.
 * Não passa pelo router Postgres para evitar recursão durante a importação.
 */
export async function getLegacyQuotaUsage({ customerId, periodStartSec }) {
  const key = quotaKey(customerId, periodStartSec);
  const counts = [];
  try {
    if (hasUpstash()) {
      const value = await upstash(['GET', key]);
      if (value == null) counts.push(0);
      else if (/^\d+$/.test(String(value))) counts.push(Number(value));
      else throw new Error('Contador Upstash inválido.');
    }
    if (podeUsarStripe(customerId)) counts.push(await stripeQuotaGet({ customerId, periodStartSec }));
    if (counts.length === 0) {
      if (isProductionQuotaStrict()) throw new Error('Nenhum contador persistente disponível.');
      counts.push(await memoryGet(key));
    }
    const used = Math.max(...counts);
    if (!Number.isSafeInteger(used) || used < 0) throw new Error('Contador legado inválido.');
    return { used };
  } catch (error) {
    console.error('[image-quota] migração do contador falhou:', error?.message || error);
    throw Object.assign(new Error('quota_store_unavailable'), { code: 'quota_store_unavailable' });
  }
}

/**
 * @returns {{ used: number, remaining: number, limit: number, allowed: boolean }}
 */
export async function getQuotaUsage({ customerId, periodStartSec, periodEndSec, limit }) {
  if (usesPostgresQuota()) {
    const { getQuotaUsagePostgres } = await import('./image-quota-postgres.js');
    return getQuotaUsagePostgres({ customerId, periodStartSec, periodEndSec, limit });
  }
  const key = quotaKey(customerId, periodStartSec);
  const used = Number(await withQuotaStore(
    async () => upstash(['GET', key]),
    async () => memoryGet(key),
    async () => stripeQuotaGet({ customerId, periodStartSec }),
    customerId,
  )) || 0;
  const cap = Math.max(0, Number(limit) || 0);
  return {
    used,
    limit: cap,
    remaining: Math.max(0, cap - used),
    allowed: cap > 0 && used < cap,
  };
}

/**
 * Consome 1 crédito. Se ultrapassar o limite, reverte e devolve allowed:false.
 */
export async function consumeImageCredit({ customerId, periodStartSec, periodEndSec, limit, operationId }) {
  if (usesPostgresQuota()) {
    const { consumeImageCreditPostgres } = await import('./image-quota-postgres.js');
    return consumeImageCreditPostgres({ customerId, periodStartSec, periodEndSec, limit, operationId });
  }
  const cap = Math.max(0, Number(limit) || 0);
  if (cap <= 0) {
    return { allowed: false, used: 0, limit: 0, remaining: 0, reason: 'no_quota' };
  }
  const key = quotaKey(customerId, periodStartSec);
  const ttl = ttlSeconds(periodEndSec);

  let degraded = false;
  const used = Number(await withQuotaStore(
    async () => {
      const next = Number(await upstash(['INCR', key])) || 0;
      if (next === 1) await upstash(['EXPIRE', key, ttl]);
      if (next > cap) {
        await upstash(['DECR', key]);
        return next; // caller vê > cap
      }
      return next;
    },
    async ({ degraded: isDegraded } = {}) => {
      degraded = !!isDegraded;
      const effectiveCap = isDegraded ? Math.min(cap, DEGRADED_FALLBACK_CAP) : cap;
      const next = await memoryIncr(key);
      if (next > effectiveCap) {
        await memoryDecr(key);
        return cap + 1;
      }
      return next;
    },
    async () => stripeQuotaConsume({ customerId, periodStartSec, cap }),
    customerId,
  )) || 0;

  if (used > cap) {
    return {
      allowed: false,
      used: cap,
      limit: cap,
      remaining: 0,
      reason: 'exhausted',
    };
  }

  return {
    allowed: true,
    used,
    limit: cap,
    remaining: Math.max(0, cap - used),
    reason: null,
    degraded,
  };
}

/** Reembolsa 1 crédito (falha SJinn após consumo). */
export async function refundImageCredit({ customerId, periodStartSec, operationId }) {
  if (usesPostgresQuota()) {
    const { refundImageCreditPostgres } = await import('./image-quota-postgres.js');
    return refundImageCreditPostgres({ customerId, periodStartSec, operationId });
  }
  const key = quotaKey(customerId, periodStartSec);
  return withQuotaStore(
    async () => {
      const n = Number(await upstash(['DECR', key])) || 0;
      if (n < 0) await upstash(['SET', key, '0']);
      return Math.max(0, n);
    },
    async () => memoryDecr(key),
    async () => stripeQuotaRefund({ customerId, periodStartSec }),
    customerId,
  );
}

/** Regista o sucesso; o backend legado já considera a reserva consumida. */
export async function settleImageCredit({ customerId, periodStartSec, operationId }) {
  if (!usesPostgresQuota()) return { status: 'consumed' };
  const { settleImageCreditPostgres } = await import('./image-quota-postgres.js');
  return settleImageCreditPostgres({ customerId, periodStartSec, operationId });
}

/** Só testes. */
export function resetMemoryQuotas() {
  memory.clear();
}

export function isUpstashConfigured() {
  return hasUpstash();
}
