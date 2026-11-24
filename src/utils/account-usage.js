import { FREE_PLAN, getPlan } from '../../shared/plans.js';

const countOrNull = (value) => (
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
);

function knownPlan(tier) {
  // O grátis não é um plano comprável (fica fora de PLAN_TIERS), mas é um plano conhecido.
  if (tier === FREE_PLAN.id) return FREE_PLAN;
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
  // No grátis não há saldo a consultar: zero imagens é um fato, não uma falha de leitura.
  const used = plan?.id === FREE_PLAN.id ? 0
    : imageQuota?.status === 'unavailable' || imageQuota?.available === false ? null : countOrNull(imageQuota?.used);
  const hasUsage = used !== null && limit !== null;
  // The server uses this same calculation. Deriving from confirmed counts also
  // prevents an inconsistent remaining field from overstating the allowance.
  // Isenção sem limite (o servidor manda `unlimited`): o uso é contado, mas não há teto a mostrar.
  const unlimited = imageQuota?.unlimited === true;
  const remaining = hasUsage && !unlimited ? Math.max(0, limit - used) : null;
  const noIncludedImages = limit === 0;
  const exhausted = hasUsage && !unlimited && limit > 0 && remaining === 0;
  const percentage = hasUsage && !unlimited && limit > 0 ? Math.min(100, (used / limit) * 100) : null;
  let periodStart = isoDateOrNull(imageQuota?.periodStart) || isoDateOrNull(currentPeriodStart);
  let periodEnd = isoDateOrNull(imageQuota?.periodEnd) || isoDateOrNull(currentPeriodEnd);
  if (periodStart && periodEnd && periodStart >= periodEnd) {
    periodStart = null;
    periodEnd = null;
  }

  return {
    planName: plan?.name || null,
    isFree: plan?.id === FREE_PLAN.id,
    unlimited,
    limit: unlimited ? null : limit,
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

/** MT-04: assinatura cancelada segue ativa até a data, mas não renova. */
export const SUBSCRIPTION_END_AFTERMATH = 'Depois disso a conta volta ao plano grátis e os projetos ficam só neste aparelho.';

export function subscriptionEnding({ cancelAtPeriodEnd = false, cancelAt = null, currentPeriodEnd = null } = {}) {
  const scheduled = isoDateOrNull(cancelAt);
  if (cancelAtPeriodEnd !== true && !scheduled) return { ending: false, endsAt: null };
  return { ending: true, endsAt: scheduled || isoDateOrNull(currentPeriodEnd) };
}

/** Rótulo curto do saldo de imagens do plano no Perfil (sem chave própria). */
export function planImageStatusLabel(usage) {
  if (usage.noIncludedImages) return 'não inclusas no plano';
  // Isenção sem limite: o uso é contado, mas não há saldo (MOO-34).
  if (usage.unlimited) return 'sem limite no plano';
  if (!usage.hasUsage) return 'consumo indisponível · consulte Uso';
  if (usage.exhausted) return 'limite deste ciclo atingido';
  return `${usage.remaining} disponíveis no plano`;
}
