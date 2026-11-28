import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';

// Apoteose 10, slide 8 no Stories (27/11): o subtítulo ficou dentro da área da
// tabela de pares. A tabela (fundo opaco) estava acima do texto: o subtítulo
// sumia, não recebia clique e travava a exportação sem que a pessoa o achasse.
const fx = JSON.parse(readFileSync(new URL('../fixtures/apoteose10-slide8.json', import.meta.url), 'utf8'));
const formatViews = { stories: { brand: {}, slides: { [fx.slide.id]: fx.stories } } };
const slide = slideForFormatDisplay(fx.slide, 'stories', formatViews, 'apresentacao');
const html = renderToStaticMarkup(React.createElement(SlideCardInner, {
  slide, fmt: 'stories', brand: fx.brand, num: 8, total: 10, creativePreset: 'apresentacao',
  forExport: false, movableElements: true, onElementOffsetChange: () => {}, onInlineTextChange: () => {},
}));
const zIndexOf = (attr) => {
  const tag = html.match(new RegExp(`<div[^>]*${attr}[^>]*>`))?.[0] || '';
  return Number(tag.match(/z-index:\s*(\d+)/)?.[1]);
};

describe('texto do card acima do quadro de evidência', () => {
  it('título e subtítulo ficam por cima da tabela quando as áreas se cruzam', () => {
    const evidence = zIndexOf('data-vc-quality-zone="evidence"');
    expect(evidence).toBeGreaterThan(0);
    expect(zIndexOf('data-vc-zone="subtitle"')).toBeGreaterThan(evidence);
    expect(zIndexOf('data-vc-zone="title"')).toBeGreaterThan(evidence);
  });
});
