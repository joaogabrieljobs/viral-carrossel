import { describe, expect, it } from 'vitest';
import { planPriceSummary } from '../../src/admin/AdminConsole.jsx';

// MOO-38: a Saúde do admin recebe `planPrices` do servidor; a tela precisa
// mostrar as divergências entre o preço exibido e o cobrado no Stripe.
describe('MOO-38 — resumo da conferência de preços', () => {
  it('sem divergência', () => {
    expect(planPriceSummary({ checked: 4, ok: true, divergences: [], unconfigured: [] })).toEqual({ value: '0', hint: '4 planos conferidos' });
  });
  it('lista cada divergência e os planos sem price configurado', () => {
    const out = planPriceSummary({ checked: 3, ok: false, unconfigured: ['max'],
      divergences: [{ tier: 'creator', priceId: 'price_x', issues: ['Valor: tela mostra R$ 97,00, Stripe cobra R$ 87,00.'] }] });
    expect(out.value).toBe('1');
    expect(out.hint).toContain('creator: Valor: tela mostra R$ 97,00, Stripe cobra R$ 87,00.');
    expect(out.hint).toContain('sem price: max');
  });
});
