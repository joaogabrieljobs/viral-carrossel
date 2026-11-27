import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { applyPresentationVisualPreset, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';

// Vídeo do João (27/11, Apoteose 10, capa): arrastar a foto empurrava a moldura
// inteira (translate) e abria faixa vazia na borda. O arrasto deve só
// reenquadrar a imagem dentro da moldura (background-position).
function cover(offset) {
  const composition = getPresentationCompositionOverrides('presentation_executive_minimal', {
    slide: { presentationVisualRole: 'cover' }, stage: { visualRole: 'cover' }, index: 0, count: 10,
  });
  return {
    ...mkSlide(1, DEFAULT_BRAND), ...composition,
    title: 'Apoteose', subtitle: 'O esquenta de Carnaval.',
    bgImage: 'data:image/png;base64,iVBORw0KGgo=', bgX: 50, bgY: 50,
    presentationSuppressPhoto: false, photoRegion: 'full', imagePosition: 'right-evidence', imgMode: 'dalle',
    presentationFreeDesign: { photo: 'full', ground: 'photo', family: 'cinematic', block: 'none', icons: [], emphasis: [] },
    elementOffsets: offset ? { photo: offset } : {},
  };
}
function comFotoCarregada(fn) {
  const real = React.useState;
  let feito = false;
  const spy = vi.spyOn(React, 'useState').mockImplementation((inicial) => {
    if (!feito && inicial === false) { feito = true; return [true, () => {}]; }
    return real(inicial);
  });
  try { return fn(); } finally { spy.mockRestore(); }
}
const render = (slide, extra = {}) => comFotoCarregada(() => renderToStaticMarkup(React.createElement(SlideCardInner, {
  slide, fmt: 'stories', brand: applyPresentationVisualPreset(DEFAULT_BRAND, 'presentation_executive_minimal'),
  num: 1, total: 10, creativePreset: 'apresentacao', forExport: false, imgReadyOverride: true,
  movableElements: true, onElementOffsetChange: () => {}, ...extra,
})));
const photoZone = html => html.match(/<div[^>]*data-vc-photo-zone="1"[^>]*>/)?.[0] || '';

describe('arrasto da foto na apresentação', () => {
  it('foto deslocada não move a moldura; só a posição da imagem muda', () => {
    const still = render(cover(null));
    const moved = render(cover({ x: -30, y: 0 }));
    expect(photoZone(still)).not.toBe('');
    expect(photoZone(moved)).not.toMatch(/translate/);
    expect(photoZone(moved).replace(/ data-vc-selected="true"/, '')).toBe(photoZone(still));
    expect(moved).toMatch(/background-position:80% 50%/);
  });

  it('a foto continua arrastável e selecionável', () => {
    expect(photoZone(render(cover(null)))).toContain('data-vc-movable="photo"');
  });
});
