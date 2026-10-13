import { describe, it, expect } from 'vitest';
import {
  parseImportedText,
  applyImportedTextToSlides,
} from '../../src/utils/import-text.js';

const mkSlide = (n) => ({
  id: `s${n}`,
  num: n,
  title: `Old ${n}`,
  subtitle: 'old sub',
  bodyAfterImage: '',
});

describe('parseImportedText', () => {
  it('separa 1 página por card e campos rotulados', () => {
    const raw = `
=== Card 1 ===
Título: Cap 1
Headline: Gancho forte
Subtítulo: Corpo do primeiro.
CTA:

=== Card 2 ===
Headline: Segundo
Subtítulo: Mais corpo.
CTA: Comenta qual dói mais

LEGENDA:
Legenda final #a #b
`;
    const parsed = parseImportedText(raw);
    expect(parsed.cards).toHaveLength(2);
    expect(parsed.cards[0]).toMatchObject({
      title: 'Gancho forte',
      subtitle: expect.stringContaining('Cap 1'),
    });
    expect(parsed.cards[0].subtitle).toMatch(/Corpo do primeiro/);
    expect(parsed.cards[1].bodyAfterImage).toMatch(/Comenta/);
    expect(parsed.caption).toMatch(/Legenda final/);
  });

  it('aceita form-feed e páginas sem rótulos (1ª linha = título)', () => {
    const raw = `Abertura\nCorpo um\fSegundo card\nCorpo dois`;
    const parsed = parseImportedText(raw);
    expect(parsed.cards.length).toBeGreaterThanOrEqual(2);
    expect(parsed.cards[0].title).toBe('Abertura');
    expect(parsed.cards[0].subtitle).toMatch(/Corpo um/);
  });
});

describe('applyImportedTextToSlides', () => {
  it('cria cards novos quando faltam slides', () => {
    const parsed = parseImportedText(`
---
Título: A
Subtítulo: 1
---
Título: B
Subtítulo: 2
---
Título: C
Subtítulo: 3
`);
    const { slides, created } = applyImportedTextToSlides([mkSlide(1)], parsed, mkSlide);
    expect(slides).toHaveLength(3);
    expect(created).toBe(2);
    expect(slides[2].title).toBe('C');
  });
});
