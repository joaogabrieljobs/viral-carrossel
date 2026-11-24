// Auditoria 23/11 — MT-08: o resumo "Antes de gerar" anunciava consumo de
// créditos do plano quando a geração usa a chave própria de imagem.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as flow from '../../src/utils/create-project-flow.js';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('MT-08 — consumo de imagens no resumo da criação', () => {
  it('com chave própria, o resumo não fala em crédito nem em saldo do plano', () => {
    const label = flow.creationImageConsumptionLabel({
      wantImages: true, hasImageAI: true, count: 8, useOwnImageKey: true, imageQuota: { limit: 0, remaining: 0 },
    });
    expect(label).not.toMatch(/crédito/i);
    expect(label).not.toContain('saldo atual');
    expect(label).toBe('imagens pela sua chave, sem usar o saldo do plano');
  });

  it('sem chave própria, o resumo continua com créditos e saldo', () => {
    expect(flow.creationImageConsumptionLabel({ wantImages: true, hasImageAI: true, count: 8, imageQuota: { remaining: 50 } }))
      .toBe('até 8 créditos de imagem · saldo atual: 50');
    expect(flow.creationImageConsumptionLabel({ wantImages: true, hasImageAI: true, count: 1, imageQuota: { unlimited: true, remaining: 999 } }))
      .toBe('até 1 crédito de imagem · conta sem limite');
    expect(flow.creationImageConsumptionLabel({ wantImages: false, hasImageAI: true, count: 8, useOwnImageKey: true }))
      .toBe('nenhum crédito de imagem');
  });

  it('o fluxo de criação recebe a escolha de chave própria do editor', () => {
    const component = source('src/components/CreateProjectFlow.jsx');
    expect(component).toContain('creationImageConsumptionLabel({');
    expect(component).toMatch(/useOwnImageKey\s*=\s*false/);
    const monolith = source('ViralCarrossel.jsx');
    const call = monolith.slice(monolith.indexOf('<CreateProjectFlow'));
    expect(call.slice(0, call.indexOf('/>'))).toContain('useOwnImageKey={useOwnImageKey}');
  });
});
