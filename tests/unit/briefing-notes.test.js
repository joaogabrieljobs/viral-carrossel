// MF-12 (reteste 19/11): "Número de WhatsApp e endereço da padaria não foram
// informados." saiu no slide 5 da Proposta, no arquivo do cliente.
import { describe, expect, it } from 'vitest';
import { stripBriefingNotes, buildFactualGroundingPrompt } from '../../src/utils/factual-grounding.js';
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
