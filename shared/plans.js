/**
 * Planos Viral. — fonte de verdade para tier, preço e quota de imagem SJinn.
 * Usado no servidor (api/) e no client (src/). Manter em sync com
 * docs/product/PRD-planos-imagem-sjinn.md
 */

export const PLAN_TIERS = {
  essential: {
    id: 'essential',
    name: 'Essencial',
    priceBRL: 19.9,
    priceLabel: 'R$ 19,90',
    imageQuota: 0,
    envPriceKey: 'STRIPE_PRICE_ID_ESSENTIAL',
    blurb: 'Studio completo · texto com sua chave · imagens só por upload',
  },
  creator: {
    id: 'creator',
    name: 'Criador',
    priceBRL: 97,
    priceLabel: 'R$ 97',
    imageQuota: 50,
    envPriceKey: 'STRIPE_PRICE_ID_CREATOR',
    blurb: '50 imagens GPT Image 2 inclusas por mês',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceBRL: 197,
    priceLabel: 'R$ 197',
    imageQuota: 150,
    envPriceKey: 'STRIPE_PRICE_ID_PRO',
    blurb: '150 imagens por mês · volume para quem publica toda semana',
  },
  max: {
    id: 'max',
    name: 'Max',
    priceBRL: 297,
    priceLabel: 'R$ 297',
    imageQuota: 300,
    envPriceKey: 'STRIPE_PRICE_ID_MAX',
    blurb: '300 imagens por mês · uso intenso',
  },
};

export const PLAN_ORDER = ['essential', 'creator', 'pro', 'max'];

export function getPlan(tier) {
  return PLAN_TIERS[tier] || null;
}

export function imageQuotaForTier(tier) {
  return getPlan(tier)?.imageQuota ?? 0;
}
