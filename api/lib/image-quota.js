/**
 * Quota mensal de imagens SJinn por customerId + período Stripe.
 * Produção: Upstash Redis REST (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).
 * Dev/testes: Map em memória (não partilha entre instâncias).
 */

const memory = new Map();

function hasUpstash() {
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
  const res = await fetch(`${base}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upstash ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return json?.result;
}

function ttlSeconds(periodEndSec) {
  if (!periodEndSec) return 60 * 60 * 24 * 40; // ~40 dias
  const sec = Math.max(60, periodEndSec - Math.floor(Date.now() / 1000) + 3600);
  return sec;
}

async function memoryGet(key) {
  return memory.get(key) || 0;
}

async function memoryIncr(key, ttlSec) {
  const next = (memory.get(key) || 0) + 1;
  memory.set(key, next);
  // TTL best-effort: schedule delete
  if (next === 1 && ttlSec > 0) {
    setTimeout(() => {
      if (memory.get(key) === next || memory.has(key)) {
        /* keep until period rolls — key includes periodStart */
      }
    }, Math.min(ttlSec, 2147483647) * 1000);
  }
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
  let used = 0;
  if (hasUpstash()) {
    const raw = await upstash(['GET', key]);
    used = Number(raw) || 0;
  } else {
    used = await memoryGet(key);
  }
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

  let used;
  if (hasUpstash()) {
    used = Number(await upstash(['INCR', key])) || 0;
    if (used === 1) {
      await upstash(['EXPIRE', key, ttl]);
    }
    if (used > cap) {
      await upstash(['DECR', key]);
      return {
        allowed: false,
        used: cap,
        limit: cap,
        remaining: 0,
        reason: 'exhausted',
      };
    }
  } else {
    used = await memoryIncr(key, ttl);
    if (used > cap) {
      await memoryDecr(key);
      return {
        allowed: false,
        used: cap,
        limit: cap,
        remaining: 0,
        reason: 'exhausted',
      };
    }
  }

  return {
    allowed: true,
    used,
    limit: cap,
    remaining: Math.max(0, cap - used),
    reason: null,
  };
}

/** Reembolsa 1 crédito (falha SJinn após consumo). */
export async function refundImageCredit({ customerId, periodStartSec }) {
  const key = quotaKey(customerId, periodStartSec);
  if (hasUpstash()) {
    const n = Number(await upstash(['DECR', key])) || 0;
    if (n < 0) await upstash(['SET', key, '0']);
    return Math.max(0, n);
  }
  return memoryDecr(key);
}

/** Só testes. */
export function resetMemoryQuotas() {
  memory.clear();
}

export function isUpstashConfigured() {
  return hasUpstash();
}
