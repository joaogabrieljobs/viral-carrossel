import { describe, expect, it } from 'vitest';
import { isBriefingNote, stripBriefingNotes } from '../../src/utils/factual-grounding.js';

// Auditoria 23/11 (B2): frases reais das apresentações BLK FROGDAY (Proposta,
// Relatório) que comentam o briefing e chegaram ao slide do cliente.
describe('auditoria 23/11 B2: nota sobre o briefing em inglês', () => {
  it.each([
    'No portfolio or case studies were shared, the validation is your own review of the built site.',
    'Conditions after delivery, such as hosting, maintenance, or support, were not specified and remain to be discussed.',
    'Payment terms beyond the $797 price were not detailed.',
    'The offer has clear strengths, but some information is not available in the material provided.',
  ])('reconhece como nota de bastidor: %s', sentence => {
    expect(isBriefingNote(sentence)).toBe(true);
  });

  it.each([
    'Old site or no site, we build the new one first.',
    'Your data is not shared with third parties.',
    'Send your current link or fill the brief at blkfrog.com/brief.',
    'No payment until you see the finished site.',
  ])('fato do cliente continua no slide: %s', sentence => {
    expect(isBriefingNote(sentence)).toBe(false);
  });

  it('remove só a frase da nota e preserva o resto do texto', () => {
    const text = 'The BLK FROGDAY offer is valid through Nov 30, 11:59 PM PT. Conditions after delivery, such as hosting, were not specified.';
    expect(stripBriefingNotes(text)).toBe('The BLK FROGDAY offer is valid through Nov 30, 11:59 PM PT.');
  });
});
