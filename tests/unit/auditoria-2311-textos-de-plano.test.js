import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLAN_REQUIRED_MESSAGES } from '../../src/utils/free-plan.js';
import { PLAN_TIERS } from '../../shared/plans.js';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

// Auditoria 23/11: três textos de plano afirmavam o que o produto não cumpre.
describe('textos de plano dizem só o que o plano entrega', () => {
  // MT-05: a conta paga tem teto de projetos no servidor (250).
  it('MT-05 — o convite para assinar não promete projetos "sem limite"', () => {
    expect(PLAN_REQUIRED_MESSAGES.projects).not.toMatch(/sem limite/i);
    expect(PLAN_REQUIRED_MESSAGES.projects).toMatch(/guard[aá]-los na conta/);
  });

  // MT-07: no Essencial as imagens não estão inclusas; o preço vem de shared/plans.js.
  it('MT-07 — Configurar IA não afirma imagens inclusas para todo plano nem repete o preço à mão', () => {
    const modal = source('src/components/KeysModal.jsx');
    expect(modal).not.toMatch(/Texto e imagens inclusos no plano/);
    expect(modal).toMatch(/Imagens inclusas a partir do Plano Criador/);
    expect(modal).not.toContain(PLAN_TIERS.essential.priceLabel);
    expect(modal).toContain('PLAN_TIERS.essential.priceLabel');
  });

  // MT-12: não há dado de vendas por trás do selo.
  it('MT-12 — a landing não afirma "Mais escolhido"', () => {
    expect(source('src/components/OnboardingLandingProduct.jsx')).not.toContain('Mais escolhido');
  });
});
