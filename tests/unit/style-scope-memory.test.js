import { describe, expect, it } from 'vitest';
import { countSlidesWithOwnVisuals, readStyleScope, writeStyleScope } from '../../src/utils/style-scope-memory.js';

describe('alcance da troca de estilo (auditoria 23/11, FE-02)', () => {
  it('começa em "Todos" e lembra "Este card" só no projeto em que foi escolhido', () => {
    expect(readStyleScope('p-novo')).toBe('all');
    expect(writeStyleScope('p-a', 'card')).toBe('card');
    expect(readStyleScope('p-a')).toBe('card');
    expect(readStyleScope('p-b')).toBe('all');
    expect(writeStyleScope('p-a', 'all')).toBe('all');
    expect(readStyleScope('p-a')).toBe('all');
  });

  it('valor estranho não vira alcance', () => {
    writeStyleScope('p-c', 'qualquer');
    expect(readStyleScope('p-c')).toBe('all');
    expect(readStyleScope(null)).toBe('all');
  });

  it('conta os cards com ajuste visual próprio, fora o card aberto', () => {
    const slides = [
      { id: 'a' },
      { id: 'b', visualPresetId: 'bold_promo_rosa' },
      { id: 'c', elementOffsets: { logo: { x: 4, y: 2 } } },
      { id: 'd', elementOffsets: {} },
      { id: 'e', canvas: { userEdited: true } },
      { id: 'f', customBg: '#112233' },
      null,
    ];
    expect(countSlidesWithOwnVisuals(slides)).toBe(4);
    expect(countSlidesWithOwnVisuals(slides, 1)).toBe(3);
    expect(countSlidesWithOwnVisuals(undefined)).toBe(0);
  });
});
