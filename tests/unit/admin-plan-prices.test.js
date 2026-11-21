import { describe, expect, it, vi } from 'vitest';
import { checkPlanPrices } from '../../api/admin.js';

// MOO-38: o preço mostrado na tela (shared/plans.js) não tinha amarração com o
// price do Stripe configurado por env. A visão Saúde passa a comparar os dois.
// O Stripe é sempre um falso injetado; nenhum teste chama o Stripe real.
const ids = { essential: 'price_ess', creator: 'price_cri', pro: 'price_pro', max: null };
const certo = {
  price_ess: { id: 'price_ess', active: true, unit_amount: 1990, currency: 'brl', recurring: { interval: 'month', interval_count: 1 } },
  price_cri: { id: 'price_cri', active: true, unit_amount: 9700, currency: 'brl', recurring: { interval: 'month', interval_count: 1 } },
  price_pro: { id: 'price_pro', active: true, unit_amount: 19700, currency: 'brl', recurring: { interval: 'month', interval_count: 1 } },
};

function stripeCom(prices) {
  return { prices: { retrieve: vi.fn(async (id) => {
    if (!prices[id]) throw Object.assign(new Error('No such price'), { statusCode: 404 });
    return prices[id];
  }) } };
}

describe('conferência dos preços dos planos com o Stripe', () => {
  it('sem divergência quando valor, moeda e intervalo batem; tier sem price fica listado', async () => {
    const stripe = stripeCom(certo);
    const result = await checkPlanPrices({ stripe, priceIdForTier: (tier) => ids[tier] });
    expect(result).toEqual({ checked: 3, ok: true, divergences: [], unconfigured: ['max'] });
    expect(stripe.prices.retrieve).toHaveBeenCalledTimes(3);
  });

  it('aponta valor, moeda, intervalo, preço inativo e price inexistente', async () => {
    const stripe = stripeCom({
      price_ess: { ...certo.price_ess, unit_amount: 2990 },
      price_cri: { ...certo.price_cri, currency: 'usd', recurring: { interval: 'year', interval_count: 1 } },
      price_pro: { ...certo.price_pro, active: false },
    });
    const result = await checkPlanPrices({
      stripe, priceIdForTier: (tier) => ({ ...ids, max: 'price_sumiu' })[tier],
    });
    expect(result.ok).toBe(false);
    expect(result.checked).toBe(4);
    const porTier = Object.fromEntries(result.divergences.map((d) => [d.tier, d]));
    expect(porTier.essential).toMatchObject({ priceId: 'price_ess', screen: 'R$ 19,90' });
    expect(porTier.essential.issues).toEqual([expect.stringMatching(/valor.*19,90.*29,90/i)]);
    expect(porTier.creator.issues).toEqual([
      expect.stringMatching(/moeda.*usd/i), expect.stringMatching(/intervalo.*year/i),
    ]);
    expect(porTier.pro.issues).toEqual([expect.stringMatching(/inativo/i)]);
    expect(porTier.max.issues).toEqual([expect.stringMatching(/não foi possível ler/i)]);
  });
});
