/**
 * Planos Moont — fonte de verdade para tier, preço e quota de imagem SJinn.
 * Usado no servidor (api/) e no client (src/). Manter em sync com
 * docs/product/PRD-planos-imagem-sjinn.md
 */

export const PLAN_TIERS = {
  essential: {
    id: 'essential',
    name: 'Plano Essencial',
    priceBRL: 19.9,
    priceLabel: 'R$ 19,90',
    imageQuota: 0,
    envPriceKey: 'STRIPE_PRICE_ID_ESSENTIAL',
    blurb: 'Studio completo · texto incluso · imagens só por upload',
  },
  creator: {
    id: 'creator',
    name: 'Plano Criador',
    priceBRL: 97,
    priceLabel: 'R$ 97',
    imageQuota: 50,
    envPriceKey: 'STRIPE_PRICE_ID_CREATOR',
    blurb: '50 imagens GPT Image 2 inclusas por mês',
  },
  pro: {
    id: 'pro',
    name: 'Plano Pro',
    priceBRL: 197,
    priceLabel: 'R$ 197',
    imageQuota: 150,
    envPriceKey: 'STRIPE_PRICE_ID_PRO',
    blurb: '150 imagens por mês · volume para quem publica toda semana',
  },
  max: {
    id: 'max',
    name: 'Plano Max',
    priceBRL: 297,
    priceLabel: 'R$ 297',
    imageQuota: 300,
    envPriceKey: 'STRIPE_PRICE_ID_MAX',
    blurb: '300 imagens por mês · uso intenso',
  },
};

export const PLAN_ORDER = ['essential', 'creator', 'pro', 'max'];

/**
 * Plano grátis: conta sem assinatura. Fica FORA de PLAN_ORDER de propósito —
 * PLAN_ORDER valida o plano no checkout e nas concessões manuais, e "free"
 * ali viraria um plano comprável sem preço. Sem IA, sem imagem gerada,
 * projetos só no aparelho. Spec: docs/product/plano-gratis.md
 */
export const FREE_PROJECT_LIMIT = 3;
export const FREE_PLAN = Object.freeze({
  id: 'free',
  name: 'Plano Grátis',
  priceBRL: 0,
  priceLabel: 'R$ 0',
  imageQuota: 0,
  projectLimit: FREE_PROJECT_LIMIT,
  blurb: 'Crie à mão · sem IA · até 3 projetos neste aparelho',
});

export function getPlan(tier) {
  return PLAN_TIERS[tier] || null;
}

export function imageQuotaForTier(tier) {
  return getPlan(tier)?.imageQuota ?? 0;
}
