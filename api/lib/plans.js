import { PLAN_TIERS, PLAN_ORDER, getPlan, imageQuotaForTier } from '../../shared/plans.js';

function cleanEnv(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, '');
}

/** Mapa priceId Stripe → tier (env). Legado STRIPE_PRICE_ID = creator. */
export function buildPriceIdToTierMap() {
  const map = new Map();
  for (const tier of PLAN_ORDER) {
    const plan = PLAN_TIERS[tier];
    const id = cleanEnv(process.env[plan.envPriceKey]);
    if (id) map.set(id, tier);
  }
  const legacy = cleanEnv(process.env.STRIPE_PRICE_ID);
  if (legacy && !map.has(legacy)) {
    map.set(legacy, 'creator');
  }
  // Alias: STRIPE_PRICE_ID_CREATOR pode estar vazio e só existir o legado
  const creatorEnv = cleanEnv(process.env.STRIPE_PRICE_ID_CREATOR);
  if (!creatorEnv && legacy) {
    map.set(legacy, 'creator');
  }
  return map;
}

/** Price sem mapeamento cai no tier SEM imagens — antes caía em `creator` (50 imagens) (auditoria A5).
 *  `STRIPE_PRICE_ID` legado continua a mapear para creator via buildPriceIdToTierMap. */
export function resolveTierFromPriceId(priceId) {
  if (!priceId) return 'essential';
  const map = buildPriceIdToTierMap();
  return map.get(cleanEnv(priceId)) || 'essential';
}

export function resolveTierFromSubscription(sub) {
  if (!sub) return 'creator';
  const item = sub.items?.data?.[0];
  const priceId = typeof item?.price === 'string' ? item.price : item?.price?.id;
  const fromMeta = sub.metadata?.tier || item?.price?.metadata?.tier;
  if (fromMeta && PLAN_TIERS[fromMeta]) return fromMeta;
  return resolveTierFromPriceId(priceId);
}

export function getStripePriceIdForTier(tier) {
  const plan = getPlan(tier) || getPlan('creator');
  const specific = cleanEnv(process.env[plan.envPriceKey]);
  if (specific) return specific;
  if (plan.id === 'creator') {
    const legacy = cleanEnv(process.env.STRIPE_PRICE_ID);
    if (legacy) return legacy;
  }
  return null;
}

export function periodBoundsFromSubscription(sub) {
  // Stripe Basil+ moveu o período para o item. É o mesmo item usado para
  // resolver o plano; não misturar datas de produtos com ciclos diferentes.
  const item = sub?.items?.data?.[0];
  const validPeriod = (source) => {
    const start = Number(source?.current_period_start);
    const end = Number(source?.current_period_end);
    return Number.isSafeInteger(start) && start > 0
      && Number.isSafeInteger(end) && end > start
      && end <= 8_640_000_000_000
      ? { start, end } : null;
  };
  const period = validPeriod(item) || validPeriod(sub);
  const startSec = period?.start ?? null;
  const endSec = period?.end ?? null;
  return {
    periodStart: startSec ? new Date(startSec * 1000).toISOString() : null,
    periodEnd: endSec ? new Date(endSec * 1000).toISOString() : null,
    periodStartSec: startSec || null,
    periodEndSec: endSec || null,
  };
}

export { PLAN_TIERS, PLAN_ORDER, getPlan, imageQuotaForTier };
