import { getPlan } from '../../shared/plans.js';

const countOrNull = (value) => (
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
);

function knownPlan(tier) {
  const plan = typeof tier === 'string' ? getPlan(tier) : null;
  return plan?.id === tier ? plan : null;
}

function isoDateOrNull(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/** A known plan limit is not evidence of known consumption. */
export function normalizeAccountUsage({
  imageQuota = null,
  planTier = null,
  currentPeriodStart = null,
  currentPeriodEnd = null,
} = {}) {
  const plan = knownPlan(imageQuota?.tier) || knownPlan(planTier);
  const limit = countOrNull(imageQuota?.limit) ?? countOrNull(plan?.imageQuota);
  const used = imageQuota?.status === 'unavailable' || imageQuota?.available === false ? null : countOrNull(imageQuota?.used);
  const hasUsage = used !== null && limit !== null;
  // The server uses this same calculation. Deriving from confirmed counts also
  // prevents an inconsistent remaining field from overstating the allowance.
  const remaining = hasUsage ? Math.max(0, limit - used) : null;
  const noIncludedImages = limit === 0;
  const exhausted = hasUsage && limit > 0 && remaining === 0;
  const percentage = hasUsage && limit > 0 ? Math.min(100, (used / limit) * 100) : null;
  let periodStart = isoDateOrNull(imageQuota?.periodStart) || isoDateOrNull(currentPeriodStart);
  let periodEnd = isoDateOrNull(imageQuota?.periodEnd) || isoDateOrNull(currentPeriodEnd);
  if (periodStart && periodEnd && periodStart >= periodEnd) {
    periodStart = null;
    periodEnd = null;
  }

  return {
    planName: plan?.name || null,
    limit,
    used,
    remaining,
    hasUsage,
    noIncludedImages,
    exhausted,
    percentage,
    periodStart,
    periodEnd,
  };
}
