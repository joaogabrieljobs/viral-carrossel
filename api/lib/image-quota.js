/**
 * Quota mensal de imagens SJinn por customerId + período de facturação.
 *
 * Três caminhos, por ordem de preferência:
 *   1. Upstash Redis REST — incremento atómico, é o melhor quando existe.
 *   2. Metadados do cliente Stripe — sem serviço extra, sobrevive a cold starts.
 *      É o que segura a quota desde que a base Upstash deste projeto foi apagada.
 *   3. Map em memória — só testes e dev com BILLING_DISABLED.
 *
 * O caminho 2 existe porque o 3 não é quota nenhuma: reiniciava a cada instância,
 * logo um assinante gerava sem limite e a plataforma pagava (auditoria H5).
 */
import { stripeQuotaGet, stripeQuotaConsume, stripeQuotaRefund } from './quota-stripe-store.js';

const memory = new Map();

/** Tecto por instância no último recurso (sem Upstash e sem Stripe utilizável). */
export const DEGRADED_FALLBACK_CAP = 25;
let _warnedNoUpstash = false;

function hasUpstash() {
  // Unitários usam só memória (Upstash de prod/local pode estar offline e estourar timeout).
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') return false;
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim()
    && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

function quotaKey(customerId, periodStartSec) {
  return `vc:imgquota:${customerId}:${periodStartSec || 'nop'}`;
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
 * memória. `memoryFn` recebe `degraded: true` quando a contagem deixou de ser
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
    }
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
 * @returns {{ used: number, remaining: number, limit: number, allowed: boolean }}
 */
export async function getQuotaUsage({ customerId, periodStartSec, limit }) {
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
export async function consumeImageCredit({ customerId, periodStartSec, periodEndSec, limit }) {
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
export async function refundImageCredit({ customerId, periodStartSec }) {
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

/** Só testes. */
export function resetMemoryQuotas() {
  memory.clear();
}

export function isUpstashConfigured() {
  return hasUpstash();
}
