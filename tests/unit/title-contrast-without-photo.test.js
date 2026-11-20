// MF-15 (reteste 19/11): capa do Estudo de caso no estilo Fotográfico e humano,
// texto primeiro: título rgb(250,247,242) sobre fundo creme. A composição põe
// texto claro esperando foto; sem foto, o título precisa ler no fundo real.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { PRESENTATION_VISUAL_PRESETS, applyPresentationVisualPreset, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { wcagContrast } from '../../src/utils/wcag.js';
import { resolveSlideBrandBg } from '../../src/utils/brand-helpers.js';

const hex = (css) => {
  const m = String(css).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return '#' + m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  return css;
};

function titleColor(html) {
  const tag = html.match(/<h1[^>]*style="([^"]*)"/);
  const color = tag && tag[1].match(/(?:^|;)color:([^;]+)/);
  return color ? hex(color[1].trim()) : null;
}

describe('título legível sem a foto que a composição esperava', () => {
  for (const preset of PRESENTATION_VISUAL_PRESETS) {
    it(preset.id, () => {
      const brand = applyPresentationVisualPreset({ ...DEFAULT_BRAND, showHandle: false, logo: null }, preset.id);
      for (const [index, role] of [[0, 'cover'], [2, 'story'], [2, 'context'], [5, 'closing']]) {
        const base = { ...mkSlide(index + 1, brand), title: 'Estudo de caso: a padaria do bairro', subtitle: 'Fermentação natural de terça a domingo.', imageQuery: 'baker hands', presentationPlan: { visualRole: role } };
        const slide = { ...base, ...getPresentationCompositionOverrides(preset.id, { slide: base, stage: {}, index, count: 6 }), bgImage: null, presentationQualityVersion: 1 };
        const html = renderToStaticMarkup(React.createElement(SlideCardInner, { slide, brand, fmt: 'apresentacao', num: index + 1, total: 6, forExport: true }));
        const ink = titleColor(html);
        const bg = slide.customBg || resolveSlideBrandBg(brand, index, slide) || brand.bg;
        expect(ink, `${role}: sem cor de título`).toBeTruthy();
        expect(wcagContrast(ink, bg), `${role}: ${ink} sobre ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
