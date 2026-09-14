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

export function resolveTierFromPriceId(priceId) {
  if (!priceId) return 'creator';
  const map = buildPriceIdToTierMap();
  return map.get(cleanEnv(priceId)) || 'creator';
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
  const startSec = sub?.current_period_start;
  const endSec = sub?.current_period_end;
  return {
    periodStart: startSec ? new Date(startSec * 1000).toISOString() : null,
    periodEnd: endSec ? new Date(endSec * 1000).toISOString() : null,
    periodStartSec: startSec || null,
    periodEndSec: endSec || null,
  };
}

export { PLAN_TIERS, PLAN_ORDER, getPlan, imageQuotaForTier };
