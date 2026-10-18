import { describe, expect, it } from 'vitest';
import { repairLeakedFormat, surfaceForReadableText } from '../../src/utils/format-views.js';

const doc = {
  fmt: 'carrossel',
  creativePreset: 'livre',
  productKind: 'carrossel',
  brand: {
    bg: '#f4efe8',
    titleColor: '#f7f4ef',
    logoSize: 260,
    name: 'Janine',
  },
  slides: [{
    id: 's1',
    title: 'Colágeno no centro do planejamento facial',
    subtitle: 'BIOESTIMULADOR FACIAL',
    titleSize: 100,
    layout: 'tl',
    bgImage: 'data:image/png,foto',
    overlays: [{ id: 'cta', type: 'cta', x: 22, y: 78, text: 'Agende sua avaliação' }],
  }],
};

describe('o feed recupera o ajuste anterior', () => {
  it('escolhe fundo escuro quando o texto da marca é claro', () => {
    expect(surfaceForReadableText('#f7f7f5', '#f7f4ef')).toBe('#161616');
    expect(surfaceForReadableText('#f7f7f5', '#1a1a1a')).toBe('#f7f7f5');
  });

  it('devolve layout, fundo e tamanho guardados antes da apresentação', () => {
    const damaged = {
      ...doc,
      brand: { ...doc.brand, bg: '#f7f7f5' },
      formatViews: {
        carrossel: {
          brand: { bg: '#f4efe8', logoSize: 260 },
          creativePreset: 'livre',
          productKind: 'carrossel',
          slides: [{
            id: 's1',
            visual: { layout: 'tl', titleSize: 100, align: 'left' },
            overlays: [{ id: 'cta', x: 22, y: 78 }],
          }],
        },
      },
      slides: [{
        ...doc.slides[0],
        layout: 'ml',
        titleSize: 64,
        canvas: { source: 'presentation-preset', variant: 'classic', zones: { title: { x: 6, y: 18, w: 40, h: 20 } } },
        presentationComposition: 'cover',
      }],
    };
    const restored = repairLeakedFormat(damaged);
    expect(restored.brand.bg).toBe('#f4efe8');
    expect(restored.slides[0].layout).toBe('tl');
    expect(restored.slides[0].titleSize).toBe(100);
    expect(restored.slides[0].canvas).toBeUndefined();
    expect(restored.slides[0].title).toBe(doc.slides[0].title);
    expect(restored.slides[0].bgImage).toBe('data:image/png,foto');
    expect(restored.formatViews).toBeUndefined();
  });

  it('tira o fundo da apresentação mesmo sem retrato anterior', () => {
    const damaged = {
      ...doc,
      slides: [{
        ...doc.slides[0],
        canvas: { source: 'presentation-preset', zones: { photo: { x: 50, y: 0, w: 50, h: 100 } } },
        presentationCompositionId: 'executive-cover',
      }],
    };
    const restored = repairLeakedFormat(damaged);
    expect(restored.slides[0].canvas).toBeUndefined();
    expect(restored.slides[0].presentationCompositionId).toBeUndefined();
    expect(restored.slides[0].bgImage).toBe('data:image/png,foto');
  });
});
