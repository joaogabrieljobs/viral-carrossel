import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { buildFreeArtDirectionBlock, snapPlanColorsToReference } from '../../src/utils/presentation-plan.js';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/apoteose-teste7.json', import.meta.url), 'utf8'));

describe('Teste 7: peso da referência chega ao roteiro usado pela geração', () => {
  it('pede até sete pares de personalidade no modo livre', () => {
    expect(buildFreeArtDirectionBlock()).toMatch(/uma linha por par, até 7/);
  });

  it('troca a base neutra pela cor escura saturada de 23,1% no deck e na direção visual', () => {
    const plan = snapPlanColorsToReference(fixture.presentationPlan, { referenceColors: fixture.styleKit.referencePalette.colors });
    expect(plan.deckDesign.palette.bg).toBe('#2B2158');
    expect(plan.visualDirection.palette.find(c => c.role === 'base').hex).toBe('#2B2158');
  });

  it('a base escolhida explicitamente no kit continua tendo prioridade', () => {
    const plan = snapPlanColorsToReference(fixture.presentationPlan, { referenceColors: fixture.styleKit.referencePalette.colors, kitColors: ['#0E0E0F'] });
    expect(plan.deckDesign.palette.bg).toBe('#0E0E0F');
  });
});
