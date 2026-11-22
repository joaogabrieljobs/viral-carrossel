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

  // Catálogo final 22/11: o texto do aviso pede contexto e uma ação já
  // ocorrida; a detecção (material sem ponto de partida) continua a mesma.
  it('avisa quando o material do Caso não traz ponto de partida', () => {
    const semAntes = 'Padaria Fermento Lento no Rio Vermelho. Três pães: camponês R$ 24. Fermentação de 36 horas. 41.200 pães em 2025.';
    expect(presentationPathMaterialNotice('estudo_de_caso', semAntes)).toMatch(/acrescente o contexto e uma decisão ou ação que já aconteceu/);
    const comAntes = 'Antes de 2023 vendíamos 80 pães por dia; depois do sistema de encomendas passamos a 140.';
    expect(presentationPathMaterialNotice('estudo_de_caso', comAntes)).toBe('');
    expect(presentationPathMaterialNotice('estudo_de_caso', 'As vendas cresceram de 80 para 140 pães por dia.')).toBe('');
    expect(presentationPathMaterialNotice('aula_workshop', semAntes)).toBe('');
  });
});

// Reteste 22/11 (WebExpresso): com briefing de oferta, "Contar uma história"
// (sem história), "Ir a fundo" (raso), "Aula" (não ensina) e "Caso" (sem antes)
// viraram a mesma lista, sem aviso.
describe('aviso de modo sem base no material', () => {
  const oferta = 'WebExpresso faz landing page para pequenos negócios nos Estados Unidos, com foco em San Diego. Preço: US$ 399, ou 3 parcelas de US$ 133. Na Black Friday, a segunda língua é grátis. Hospedagem e domínio ficam no nome do cliente. São 10 vagas, até 30 de novembro. Há modelos prontos para taqueria, barbearia e lavanderia.';
  const padaria = 'Padaria Fermento Lento, fundada em 2019 por Marta Sales no Rio Vermelho. Ela começou vendendo para vizinhos quando ainda trabalhava em outro emprego.';
  it('história sem pessoa ou momento', async () => {
    const { narrativeModeMaterialNotice } = await import('../../src/utils/presentation.js');
    expect(narrativeModeMaterialNotice('storytelling', oferta)).toMatch(/história/);
    expect(narrativeModeMaterialNotice('storytelling', padaria)).toBe('');
  });
  it('ir a fundo com material curto', async () => {
    const { narrativeModeMaterialNotice } = await import('../../src/utils/presentation.js');
    expect(narrativeModeMaterialNotice('deep', oferta)).toMatch(/Que relação o leitor deve entender\?/);
    expect(narrativeModeMaterialNotice('deep', `${oferta} `.repeat(4))).toBe('');
  });
  it('aula sem conceito ou procedimento', async () => {
    const { narrativeModeMaterialNotice } = await import('../../src/utils/presentation.js');
    expect(narrativeModeMaterialNotice('aula_workshop', oferta)).toMatch(/ensinar/);
    expect(narrativeModeMaterialNotice('aula_workshop', 'Como fazer pão: passo 1, misture; passo 2, espere 36 horas. Erro comum: forno frio.')).toBe('');
  });
  it('caso continua usando a regra do ponto de partida; outros modos sem aviso', async () => {
    const { narrativeModeMaterialNotice } = await import('../../src/utils/presentation.js');
    expect(narrativeModeMaterialNotice('estudo_de_caso', oferta)).toMatch(/^Para analisar um caso/);
    expect(narrativeModeMaterialNotice('pain', oferta)).toBe('');
    expect(narrativeModeMaterialNotice('how_to', oferta)).toBe('');
  });
});
