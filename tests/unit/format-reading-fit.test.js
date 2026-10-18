import { describe, expect, it } from 'vitest';
import { fitSlideToFormat } from '../../src/utils/format-reading-fit.js';

const slide = {
  title: 'Colágeno no centro do planejamento facial',
  subtitle: 'BIOESTIMULADOR FACIAL. Estímulo de colágeno, conforme indicação.',
  titleSize: 100,
  subSize: 100,
  layout: 'tl',
  overlays: [{ id: 'cta-1', type: 'cta', x: 22, y: 78, text: 'Agende sua avaliação' }],
  elementOffsets: { subtitle: { x: 0, y: 6 } },
};

describe('ajuste da área de leitura ao mudar a proporção', () => {
  it('encolhe o tipo no quadrado e mantém o botão dentro da margem de baixo', () => {
    const next = fitSlideToFormat(slide, 'carrossel', 'quadrado');
    expect(next.titleSize).toBeLessThan(100);
    expect(next.subSize).toBeLessThan(100);
    expect(next.title).toBe(slide.title);
    const cta = next.overlays[0];
    expect(cta.y).toBeGreaterThan(70);
    expect(cta.y).toBeLessThanOrEqual(88);
    expect(cta.x).toBeGreaterThan(8);
    expect(cta.x).toBeLessThan(92);
  });

  it('no 16:9 coloca o botão abaixo do bloco de texto da coluna', () => {
    const presentation = {
      ...slide,
      canvas: {
        variant: 'classic',
        zones: {
          title: { x: 6, y: 18, w: 46, h: 24 },
          subtitle: { x: 6, y: 44, w: 46, h: 28 },
          photo: { x: 56, y: 0, w: 44, h: 100 },
        },
      },
    };
    const next = fitSlideToFormat(presentation, 'carrossel', 'apresentacao', { composed: true });
    const cta = next.overlays[0];
    expect(cta.y).toBeGreaterThan(44 + 28);
    expect(cta.y).toBeLessThanOrEqual(90);
    expect(cta.x).toBeGreaterThan(6);
    expect(cta.x).toBeLessThan(52);
    expect(next.elementOffsets).toEqual({});
    expect(next.titleSize).toBe(100);
  });

  it('não mexe no card quando a proporção é a mesma', () => {
    expect(fitSlideToFormat(slide, 'carrossel', 'carrossel')).toBe(slide);
  });
});
