// MF-12 (reteste 19/11): "Número de WhatsApp e endereço da padaria não foram
// informados." saiu no slide 5 da Proposta, no arquivo do cliente.
import { describe, expect, it } from 'vitest';
import { stripBriefingNotes, buildFactualGroundingPrompt, isBriefingNote } from '../../src/utils/factual-grounding.js';
import { stripLeadingSlideCardLabel } from '../../src/utils/generation-prompts.js';

const PROIBIDO = /não foram informad|não informad|briefing|não foi informad/i;

describe('nota interna da IA não chega ao slide', () => {
  const casos = [
    'Peça pelo WhatsApp. Número de WhatsApp e endereço da padaria não foram informados.',
    'Encomendas até sexta.\nEndereço não informado no briefing.',
    'O briefing não traz telefone. Retire na loja.',
    'Telefone: [inserir número]. Terça a domingo, 7h às 13h.',
    'Horário de sábado a confirmar.',
  ];
  for (const texto of casos) {
    it(JSON.stringify(texto), () => {
      const limpo = stripLeadingSlideCardLabel(texto);
      expect(limpo).not.toMatch(PROIBIDO);
      expect(limpo).not.toMatch(/a confirmar|\[inserir/i);
    });
  }

  it('preserva o texto do cliente', () => {
    expect(stripBriefingNotes('Rua das Flores, 10. Terça a domingo, 7h às 13h.')).toBe('Rua das Flores, 10. Terça a domingo, 7h às 13h.');
    expect(stripBriefingNotes('Mas não foi o fim da história.')).toBe('Mas não foi o fim da história.');
    expect(stripLeadingSlideCardLabel('Peça pelo WhatsApp. Número não foi informado.')).toBe('Peça pelo WhatsApp.');
  });

  it('o prompt proíbe comentar dado ausente no texto', () => {
    expect(buildFactualGroundingPrompt({ factualSource: 'Padaria Fermento Lento' })).toMatch(/não escreva isso no card nem no slide/);
  });
});

describe('travessão no texto gerado', () => {
  it('vira vírgula e não sobra traço solto', () => {
    expect(stripLeadingSlideCardLabel('A padaria — aberta em 2019 — fica no Rio Vermelho.')).toBe('A padaria, aberta em 2019, fica no Rio Vermelho.');
    expect(stripLeadingSlideCardLabel('Pão de verdade — feito devagar.')).toBe('Pão de verdade, feito devagar.');
    expect(stripLeadingSlideCardLabel('Seis pessoas na equipe —')).toBe('Seis pessoas na equipe');
  });
  it('mantém faixa de horário e marcador de lista com meia-risca', () => {
    expect(stripLeadingSlideCardLabel('Aberta das 7h–13h')).toBe('Aberta das 7h–13h');
    expect(stripLeadingSlideCardLabel('– Francês\n– Integral')).toBe('– Francês\n– Integral');
  });
});

// Reteste 21/11 (A02 Pitch, A04 Proposta): a nota de bastidor voltou com
// outra redação e saiu no slide do cliente.
describe('MF-12 (reteste 21/11) — nota sobre dado ausente em outras redações', () => {
  it.each([
    'Não há dados de concorrentes ou comparações de mercado documentados.',
    'Canais de divulgação, estratégias de aquisição e hipóteses de expansão não foram documentados.',
    'Não há dados de crescimento, margem ou comparação com períodos anteriores.',
    'Faltam combater número de contato, endereço de retirada e forma de pagamento.',
    'Faltam definir o endereço e a forma de pagamento.',
    'Não há informações sobre prazo de entrega.',
  ])('reconhece "%s" como nota', (frase) => {
    expect(isBriefingNote(frase)).toBe(true);
  });

  it.each([
    'Não há entrega fora do bairro.',
    'Não há atalho para esse processo.',
    'Faltam dois dias para a encomenda.',
    'Retirada na padaria; não há entrega fora do bairro.',
    'O volume de 41.200 pães vendidos em 2025 indica uma operação ativa no Rio Vermelho.',
  ])('mantém o fato "%s"', (frase) => {
    expect(isBriefingNote(frase)).toBe(false);
  });

  it('tira só a nota e preserva o fato no mesmo parágrafo', () => {
    expect(stripBriefingNotes('O volume de 41.200 pães vendidos em 2025 indica uma operação ativa no Rio Vermelho. Não há dados de crescimento, margem ou comparação com períodos anteriores.'))
      .toBe('O volume de 41.200 pães vendidos em 2025 indica uma operação ativa no Rio Vermelho.');
  });
});

describe('MF-12 (reteste 21/11) — o prompt não pede lacuna no slide', () => {
  it('a regra de fatos proíbe escrever no slide que um dado não existe', async () => {
    const { NO_GAP_NOTE_RULE } = await import('../../src/utils/factual-grounding.js');
    expect(buildFactualGroundingPrompt({ factualSource: 'Padaria.' })).toContain(NO_GAP_NOTE_RULE);
    expect(NO_GAP_NOTE_RULE).toMatch(/não há dados/);
  });

  // Catálogo final 22/11: a estratégia de apresentação deixou de repetir a
  // regra do carrossel. Lista de dados ausentes continua fora do slide, mas a
  // condição ou pendência que muda a leitura acompanha a afirmação afetada.
  it('a estratégia de apresentação não expõe lista de dados ausentes e preserva a ressalva essencial', async () => {
    const { NO_GAP_NOTE_RULE } = await import('../../src/utils/factual-grounding.js');
    const { presentationStrategyForRoute } = await import('../../src/utils/presentation-content.js');
    const { getPresentationPath } = await import('../../src/utils/presentation.js');
    const strategy = presentationStrategyForRoute(getPresentationPath('pitch'));
    expect(strategy).toContain('Não exponha notas de produção nem uma lista de dados ausentes.');
    expect(strategy).toContain('omita apenas lacunas irrelevantes. Uma ressalva essencial não é comentário sobre o briefing.');
    expect(strategy).not.toContain(NO_GAP_NOTE_RULE);
  });
});
