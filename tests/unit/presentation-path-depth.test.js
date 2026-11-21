import { describe, expect, it } from 'vitest';
import { buildPresentationReviewRules, presentationPathMaterialNotice } from '../../src/utils/presentation.js';

// Reteste 21/11, MF-11: Proposta (A04) saiu sem decisão comercial e Caso (A06)
// virou lista de fatos sem antes e depois.
describe('MF-11 — profundidade de Proposta e Caso', () => {
  it('a revisão da Proposta exige a decisão comercial no fecho', () => {
    const rules = buildPresentationReviewRules('proposta_comercial');
    expect(rules).toMatch(/DECISÃO COMERCIAL/);
    expect(rules).toMatch(/o que o cliente aprova/);
  });
  it('a revisão do Caso exige a comparação quando o material tem ponto de partida', () => {
    const rules = buildPresentationReviewRules('estudo_de_caso');
    expect(rules).toMatch(/ANTES E DEPOIS/);
    expect(rules).toMatch(/não invente/i);
  });
  it('outros caminhos não recebem essas regras', () => {
    expect(buildPresentationReviewRules('aula_workshop')).not.toMatch(/DECISÃO COMERCIAL|ANTES E DEPOIS — /);
  });

  it('avisa quando o material do Caso não traz ponto de partida', () => {
    const semAntes = 'Padaria Fermento Lento no Rio Vermelho. Três pães: camponês R$ 24. Fermentação de 36 horas. 41.200 pães em 2025.';
    expect(presentationPathMaterialNotice('estudo_de_caso', semAntes)).toMatch(/antes/);
    const comAntes = 'Antes de 2023 vendíamos 80 pães por dia; depois do sistema de encomendas passamos a 140.';
    expect(presentationPathMaterialNotice('estudo_de_caso', comAntes)).toBe('');
    expect(presentationPathMaterialNotice('estudo_de_caso', 'As vendas cresceram de 80 para 140 pães por dia.')).toBe('');
    expect(presentationPathMaterialNotice('aula_workshop', semAntes)).toBe('');
  });
});
