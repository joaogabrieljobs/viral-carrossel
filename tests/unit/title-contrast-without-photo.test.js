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
import { groundInks } from '../../src/utils/presentation-families.js';

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
        const bg = slide.presentationChrome?.ground && slide.presentationChrome.ground !== 'bg'
          ? groundInks(slide.presentationChrome.family, slide.presentationChrome.ground).bg
          : slide.customBg || resolveSlideBrandBg(brand, index, slide) || brand.bg;
        expect(ink, `${role}: sem cor de título`).toBeTruthy();
        expect(wcagContrast(ink, bg), `${role}: ${ink} sobre ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

// MF-08 (reteste 19/11): no fechamento do Executivo (fundo marinho pintado pela
// família), o apoio e o texto final saíam no cinza da marca, quase invisíveis.
function colorBefore(html, needle) {
  const i = html.indexOf(needle);
  const colors = html.slice(Math.max(0, i - 900), i).match(/(?:^|[;"])color:([^;"]+)/g) || [];
  return colors.length ? hex(colors.at(-1).replace(/^[;"]?color:/, '').trim()) : null;
}

describe('todo texto legível no fundo real da página (com fundo da família)', () => {
  for (const preset of PRESENTATION_VISUAL_PRESETS) {
    it(preset.id, () => {
      const brand = applyPresentationVisualPreset({ ...DEFAULT_BRAND, showHandle: false, logo: null }, preset.id);
      for (const [index, role] of [[0, 'cover'], [2, 'context'], [3, 'divider'], [9, 'closing']]) {
        const base = { ...mkSlide(index + 1, brand), title: 'Encomende seu pão pelo WhatsApp', subtitle: 'Escolha entre camponês, integral ou brioche.', bodyAfterImage: 'Retirada na padaria de terça a domingo.', presentationPlan: { visualRole: role } };
        const slide = { ...base, ...getPresentationCompositionOverrides(preset.id, { slide: base, stage: {}, index, count: 10 }), presentationQualityVersion: 1 };
        const html = renderToStaticMarkup(React.createElement(SlideCardInner, { slide, brand, fmt: 'apresentacao', num: index + 1, total: 10, forExport: true }));
        const ground = slide.presentationChrome?.ground && slide.presentationChrome.ground !== 'bg'
          ? groundInks(slide.presentationChrome.family, slide.presentationChrome.ground).bg
          : slide.customBg || resolveSlideBrandBg(brand, index, slide) || brand.bg;
        for (const needle of ['Encomende seu pão', 'Escolha entre camponês', 'Retirada na padaria']) {
          if (!html.includes(needle)) continue;
          const ink = colorBefore(html, needle);
          expect(ink, `${role} · ${needle}: sem cor`).toBeTruthy();
          expect(wcagContrast(ink, ground), `${role} · ${needle}: ${ink} sobre ${ground}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }
});


// Reteste 21/11 (A01, slide 10): o destaque azul "1 dia de antecedência" ficava
// a ~3,2:1 sobre o marinho do fechamento. Destaque no apoio é texto de corpo.
describe('destaque dentro do apoio legível no fundo da família (>= 4,5)', () => {
  for (const preset of PRESENTATION_VISUAL_PRESETS) {
    it(preset.id, () => {
      const brand = applyPresentationVisualPreset({ ...DEFAULT_BRAND, showHandle: false, logo: null }, preset.id);
      for (const [index, role] of [[3, 'divider'], [9, 'closing']]) {
        const base = { ...mkSlide(index + 1, brand), title: 'Encomende seu pão', subtitle: 'Peça com **1 dia de antecedência** pelo WhatsApp.', presentationPlan: { visualRole: role } };
        const slide = { ...base, ...getPresentationCompositionOverrides(preset.id, { slide: base, stage: {}, index, count: 10 }), presentationQualityVersion: 1 };
        if (!(slide.presentationChrome?.ground && slide.presentationChrome.ground !== 'bg')) continue;
        const html = renderToStaticMarkup(React.createElement(SlideCardInner, { slide, brand, fmt: 'apresentacao', num: index + 1, total: 10, forExport: true }));
        if (!html.includes('1 dia de antecedência')) continue;
        const ground = groundInks(slide.presentationChrome.family, slide.presentationChrome.ground).bg;
        const ink = colorBefore(html, '1 dia de antecedência');
        expect(wcagContrast(ink, ground), `${role}: ${ink} sobre ${ground}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
