import { describe, it, expect } from 'vitest';
import {
  parseImportedText,
  applyImportedTextToSlides,
  scrubLabelLeak,
  IMPORT_TEXT_VISUAL,
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
    expect(parsed.cards[0].title).not.toMatch(/Headline/i);
    expect(parsed.cards[0].subtitle).toMatch(/Corpo do primeiro/);
    expect(parsed.cards[1].bodyAfterImage).toMatch(/Comenta/);
    expect(parsed.caption).toMatch(/Legenda final/);
    expect(parsed.cards.every((c) => !/legenda/i.test(`${c.title} ${c.subtitle} ${c.bodyAfterImage}`))).toBe(true);
  });

  it('interpreta rótulos inline sem dois-pontos e não põe legenda no card', () => {
    const raw = `Headline Seus traços orientam o planejamento.
ÁCIDO HIALURÔNICO FACIAL Subtítulo Planejamento de volume e contorno. CTA Agende uma consulta para conhecer as possibilidades. Legenda O ácido hialurônico pode ser utilizado no preenchimento facial.`;
    const parsed = parseImportedText(raw);
    expect(parsed.cards.length).toBe(1);
    expect(parsed.cards[0].title).toBe('Seus traços orientam o planejamento.');
    expect(parsed.cards[0].subtitle).toMatch(/Planejamento de volume/);
    expect(parsed.cards[0].subtitle).not.toMatch(/Subtítulo|CTA|Legenda/i);
    expect(parsed.cards[0].bodyAfterImage).toMatch(/Agende uma consulta/);
    expect(parsed.cards[0].bodyAfterImage).not.toMatch(/Legenda/i);
    expect(parsed.caption).toMatch(/ácido hialurônico/i);
    expect(`${parsed.cards[0].title} ${parsed.cards[0].subtitle} ${parsed.cards[0].bodyAfterImage}`).not.toMatch(/Legenda/i);
  });

  it('aceita form-feed e páginas sem rótulos (1ª linha = título)', () => {
    const raw = `Abertura\nCorpo um\fSegundo card\nCorpo dois`;
    const parsed = parseImportedText(raw);
    expect(parsed.cards.length).toBeGreaterThanOrEqual(2);
    expect(parsed.cards[0].title).toBe('Abertura');
    expect(parsed.cards[0].subtitle).toMatch(/Corpo um/);
  });
});

describe('scrubLabelLeak', () => {
  it('remove prefixo Headline / Subtítulo', () => {
    expect(scrubLabelLeak('Headline Seus traços')).toBe('Seus traços');
    expect(scrubLabelLeak('Subtítulo: Planejamento')).toBe('Planejamento');
  });
});

describe('applyImportedTextToSlides', () => {
  it('cria cards novos e aplica padrão visual', () => {
    const parsed = parseImportedText(`
---
Headline: A
Subtítulo: 1
---
Headline: B
Subtítulo: 2
---
Headline: C
Subtítulo: 3
CTA: Vá
`);
    const { slides, created } = applyImportedTextToSlides([mkSlide(1)], parsed, mkSlide);
    expect(slides).toHaveLength(3);
    expect(created).toBe(2);
    expect(slides[2].title).toBe('C');
    expect(slides[0].photoRegion).toBe(IMPORT_TEXT_VISUAL.photoRegion);
    expect(slides[0].textShadow).toBe(true);
    expect(slides[2].bodyAfterImage).toMatch(/Vá/);
    expect(slides[2].showSwipeCue).toBe(false);
  });
});
