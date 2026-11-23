import { describe, expect, it } from 'vitest';
import { auditDraftFactuality } from '../../src/utils/factual-grounding.js';

// Auditoria 23/11 (G1, segundo verificador do V4-X1): número até a quantidade
// de cards passa como enumeração. Num deck de 12 cards, escassez inventada
// ("Restam 10 vagas") passava sem aviso; num de 6 era marcada.
const brief = 'Black Frog builds websites. The site is $797. Offer ends Nov 30.';
const deck = (title, n = 12) => ({ slides: Array.from({ length: n }, (_, i) => ({ title: i === 0 ? title : `Card ${i}`, subtitle: '', bodyAfterImage: '' })), caption: '' });
const first = (title, n) => auditDraftFactuality(deck(title, n), { factualSource: brief }).filter(v => v.slideIndex === 0);

describe('auditoria 23/11 G1: escassez não passa como enumeração', () => {
  it.each(['Restam 10 vagas.', 'Only 10 spots left.', 'Já são 11 clientes atendidos.'])('marca "%s" num deck de 12', title => {
    expect(first(title, 12)).toContainEqual(expect.objectContaining({ category: 'dado sem fonte' }));
  });
  it.each(['12 erros comuns no site', 'Step 10 · Publish', 'Os 7 passos'])('enumeração continua liberada: "%s"', title => {
    expect(first(title, 12)).toEqual([]);
  });
});
