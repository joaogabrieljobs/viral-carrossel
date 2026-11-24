import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as chrome from '../../src/utils/card-chrome.js';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { wcagContrast } from '../../src/utils/wcag.js';

const PAPEL = '#F2EDE4';
const FOTO = 'data:image/png;base64,AAAA';
const BRANCO_SOBRE_FOTO = 'rgba(255,255,255,0.85)';
const brand = {
  ...DEFAULT_BRAND, bg: PAPEL, titleColor: '#1b1916', textColor: '#3a3632', subtitleVisible: true, showHandle: false,
  cultureHeaderLeft: 'ANALISE', cultureHeaderYear: '2026', showPageBadge: true,
};
const TEXTO = { title: { x: 6, y: 62, w: 88, h: 14 }, subtitle: { x: 6, y: 77, w: 88, h: 20 } };
const comZona = (photo, extra = {}) => ({
  ...mkSlide(1, brand), title: 'Título do card', subtitle: 'Apoio do card.', useCultureLayout: false, photoRegion: 'full', bgImage: FOTO,
  canvas: { enabled: false, applied: true, variant: 'classic', zones: { ...TEXTO, photo } },
  ...extra,
});

const render = (slide) => renderToStaticMarkup(React.createElement(SlideCardInner, {
  slide, brand, fmt: 'carrossel', num: 2, total: 7, forExport: true, creativePreset: 'livre',
}));
const estilo = (tag) => Object.fromEntries((tag.match(/style="([^"]*)"/)?.[1] || '').split(';').filter(Boolean).map((par) => {
  const i = par.indexOf(':');
  return [par.slice(0, i), par.slice(i + 1)];
}));
/** Cor das três colunas da barra editorial e cores do contador. */
function topo(html) {
  const barra = html.match(/<div data-vc-chrome="headerBar"[^>]*>(.*?)<\/div>/)?.[1] || '';
  const colunas = [...barra.matchAll(/<span[^>]*>/g)].map((m) => estilo(m[0]).color);
  const contador = estilo(html.match(/<div data-vc-chrome="pageBadge"[^>]*>/)?.[0] || '');
  return { colunas, contador };
}

describe('GA-08: barra editorial e contador usam a tinta do card quando a foto não está atrás deles', () => {
  it('a regra olha onde a foto está e se ela carregou', () => {
    const { photoBehindHeaderChrome } = chrome;
    expect(typeof photoBehindHeaderChrome).toBe('function');
    const semZonas = { bgImage: FOTO, canvas: null };
    expect(photoBehindHeaderChrome(semZonas)).toBe(true);
    expect(photoBehindHeaderChrome({ ...semZonas, bgImage: '' })).toBe(false);
    expect(photoBehindHeaderChrome(semZonas, { imgErr: true })).toBe(false);
    // Foto no topo, de lado a lado: a barra está sobre ela.
    expect(photoBehindHeaderChrome(comZona({ x: 0, y: 0, w: 100, h: 58 }))).toBe(true);
    expect(photoBehindHeaderChrome(comZona({ x: 0, y: 0, w: 100, h: 100 }))).toBe(true);
    // Moldura (começa a 8,5%), faixa no meio, coluna lateral: a barra está no papel.
    expect(photoBehindHeaderChrome(comZona({ x: 8.5, y: 8.5, w: 83, h: 50 }))).toBe(false);
    expect(photoBehindHeaderChrome(comZona({ x: 0, y: 50, w: 100, h: 40 }))).toBe(false);
    expect(photoBehindHeaderChrome(comZona({ x: 0, y: 0, w: 46, h: 100 }))).toBe(false);
    expect(photoBehindHeaderChrome(comZona({ x: 58, y: 0, w: 42, h: 100 }))).toBe(false);
    // Zonas só sugeridas (composição não aplicada) não mudam o card: foto de fundo inteiro.
    expect(photoBehindHeaderChrome({ ...comZona({ x: 0, y: 50, w: 100, h: 40 }), canvas: { enabled: false, applied: false, zones: { photo: { x: 0, y: 50, w: 100, h: 40 } } } })).toBe(true);
  });

  it.each([
    ['foto na metade de baixo', { x: 0, y: 50, w: 100, h: 40 }],
    ['foto em moldura', { x: 8.5, y: 8.5, w: 83, h: 50 }],
    ['foto em coluna lateral', { x: 0, y: 0, w: 46, h: 100 }],
  ])('%s: barra e contador saem na tinta do card, legíveis no papel', (_nome, photo) => {
    const { colunas, contador } = topo(render(comZona(photo)));
    expect(colunas).toHaveLength(3);
    for (const cor of colunas) {
      expect(cor).not.toBe(BRANCO_SOBRE_FOTO);
      expect(wcagContrast(cor, PAPEL), `barra ${cor} sobre ${PAPEL}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contador.background).toBe('rgba(0,0,0,0.12)');
    expect(wcagContrast(contador.color, PAPEL)).toBeGreaterThanOrEqual(4.5);
    // Mesma tinta do card sem foto.
    const semFoto = topo(render(comZona(photo, { bgImage: '' })));
    expect(colunas).toEqual(semFoto.colunas);
    expect(contador.color).toBe(semFoto.contador.color);
  });

  it('foto atrás do topo: continua branco translúcido', () => {
    for (const slide of [comZona({ x: 0, y: 0, w: 100, h: 58 }), comZona({ x: 0, y: 0, w: 100, h: 100 }), { ...comZona({ x: 0, y: 0, w: 100, h: 100 }), canvas: null }]) {
      const { colunas, contador } = topo(render(slide));
      expect(colunas).toEqual([BRANCO_SOBRE_FOTO, BRANCO_SOBRE_FOTO, BRANCO_SOBRE_FOTO]);
      expect(contador.background).toBe('rgba(0,0,0,0.45)');
      expect(contador.color).toBe('#fff');
    }
  });
});
