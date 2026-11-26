import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { applyFreeSocialDesign } from '../../src/utils/social-free-design.js';

const ART = 'data:image/png;base64,SOCIAL_ART';
const render = (slide, fmt) => renderToStaticMarkup(React.createElement(SlideCardInner, {
  slide, fmt, brand: { ...DEFAULT_BRAND, logo: null, showHandle: false },
  num: 2, total: 3, creativePreset: 'livre', forExport: true,
}));
describe('Livre social: arte persistida aparece no renderer', () => {
  it.each(['carrossel', 'quadrado', 'stories'])('renderiza a mesma arte e sua proteção no %s', formato => {
    const slides = applyFreeSocialDesign([0, 1, 2].map(index => ({
      ...mkSlide(index + 1, DEFAULT_BRAND), title: `Encontro ${index + 1}`, subtitle: 'Música e arte.',
      socialFreeDesign: { family: 'minimal', ground: 'art', photo: 'none', block: 'none' },
      presentationArtImageId: 'shared-art', presentationArtImage: ART,
    })), { preset: 'social_free', formato });
    const html = render(slides[1], formato);
    expect(html.match(/data-vc-deck-art="1"/g)).toHaveLength(1);
    expect(html.match(/data-vc-deck-art-scrim="1"/g)).toHaveLength(1);
    expect(html).toContain(`background-image:url(${ART})`);
    expect(html).not.toContain('data-vc-presentation="true"');
  });

  it('não mostra arte órfã nos estilos sociais anteriores', () => {
    const html = render({ ...mkSlide(1, DEFAULT_BRAND), title: 'Texto', presentationArtImage: ART }, 'carrossel');
    expect(html).not.toContain('data-vc-deck-art');
  });
});
