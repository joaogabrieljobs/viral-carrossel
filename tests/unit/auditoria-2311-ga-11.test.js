import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { inferCanvasDefaults } from '../../src/utils/canvas-zones.js';

const APOIO = 'Apoio do card sem tamanho gravado.';
const brand = { ...DEFAULT_BRAND, subtitleVisible: true, showHandle: false };

/** Card vindo de fora (backup editado, versão muito antiga): sem o campo subSize. */
function semSubSize(extra = {}) {
  const slide = { ...mkSlide(1, brand), title: 'Título', subtitle: APOIO, canvas: null, useCultureLayout: false, photoRegion: 'full', ...extra };
  delete slide.subSize;
  return slide;
}

/** Layout de texto + foto + texto com as molduras já aplicadas (ramo das zonas). */
function sanduicheComZonas() {
  const slide = semSubSize({ useCultureLayout: true, bodyAfterImage: 'Texto depois da foto.', bgImage: 'data:image/png;base64,AAAA' });
  const { variant, zones } = inferCanvasDefaults(slide, 'livre');
  expect(variant).toBe('sandwich');
  return { ...slide, canvas: { enabled: false, applied: true, variant, zones } };
}

const render = (slide, creativePreset = 'livre') => renderToStaticMarkup(React.createElement(SlideCardInner, {
  slide, brand, fmt: 'carrossel', num: 2, total: 5, forExport: true, creativePreset,
}));

/** Corpo (px) do elemento que carrega o texto do apoio. */
function corpoDoApoio(html) {
  const fim = html.indexOf(APOIO);
  expect(fim, 'o apoio foi desenhado').toBeGreaterThan(-1);
  // O corpo fica no próprio elemento ou no span de linha logo acima dele.
  const antes = html.slice(0, fim);
  const m = [...antes.matchAll(/font-size:([0-9.a-zA-Z]+)px/g)].at(-1);
  return m ? Number(m[1]) : null;
}

describe('GA-11: card sem subSize desenha o apoio no tamanho padrão', () => {
  const casos = [
    ['fundo inteiro', semSubSize(), 'livre'],
    ['fundo inteiro com texto Cultura', semSubSize({ useCultureLayout: true }), 'livre'],
    ['foto em faixa', semSubSize({ photoRegion: 'inset_h_top' }), 'livre'],
    ['foto em faixa com texto Cultura', semSubSize({ photoRegion: 'inset_h_top', useCultureLayout: true }), 'livre'],
    ['texto + foto + texto com zonas aplicadas', sanduicheComZonas(), 'livre'],
  ];

  it.each(casos)('%s: nenhum NaN e corpo igual ao do card com subSize 100', (_nome, slide, preset) => {
    const html = render(slide, preset);
    expect(html).not.toContain('NaN');
    const corpo = corpoDoApoio(html);
    expect(Number.isFinite(corpo)).toBe(true);
    expect(corpo).toBe(corpoDoApoio(render({ ...slide, subSize: 100 }, preset)));
  });

  it('subSize gravado continua valendo', () => {
    const normal = corpoDoApoio(render({ ...semSubSize(), subSize: 100 }));
    const maior = corpoDoApoio(render({ ...semSubSize(), subSize: 150 }));
    expect(maior).toBeCloseTo(normal * 1.5, 3);
  });
});
