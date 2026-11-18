import { describe, it, expect } from 'vitest';
import { normalizeInstagramCaption } from '../../src/utils/editorial-strategy.js';

describe('legenda — rótulo de rascunho entre colchetes', () => {
  it('remove o rótulo sozinho na primeira linha (R2: "[ESTANTE DE TROCA]")', () => {
    const legenda = '[ESTANTE DE TROCA]\nRegras da estante de troca da Casa Pátio\nSalve o post. #trocalivros';
    expect(normalizeInstagramCaption(legenda)).toBe('Regras da estante de troca da Casa Pátio\nSalve o post. #trocalivros');
  });

  it('não mexe em colchetes no meio do texto nem em legenda que é só o rótulo', () => {
    expect(normalizeInstagramCaption('Veja [link na bio] para participar.')).toBe('Veja [link na bio] para participar.');
    expect(normalizeInstagramCaption('Primeira linha\n[nota] segunda linha')).toBe('Primeira linha\n[nota] segunda linha');
    expect(normalizeInstagramCaption('[SÓ ISSO]')).toBe('[SÓ ISSO]');
    expect(normalizeInstagramCaption('[rótulo] texto na mesma linha')).toBe('[rótulo] texto na mesma linha');
  });
});
