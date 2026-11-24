import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as chrome from '../../src/utils/card-chrome.js';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { DEFAULT_CANVAS_ZONES_CLASSIC } from '../../src/utils/canvas-zones.js';
import { wcagContrast } from '../../src/utils/wcag.js';

const BARRA = 'ANALISE';
const CLARO = '#fafafc';
const ESCURO = '#0a0a0a';
const marca = (bg) => ({
  ...DEFAULT_BRAND, bg, titleColor: bg === ESCURO ? '#f5f5f7' : '#1d1d1f', textColor: bg === ESCURO ? '#d0d0d4' : '#515154',
  subtitleVisible: true, showHandle: false, cultureHeaderLeft: BARRA, cultureHeaderYear: '2026', showPageBadge: true,
});
/** Capa sem corpo, sem composição: é o ramo legado. */
const capa = (brand, extra = {}) => ({
  ...mkSlide(1, brand), title: 'Título da capa', subtitle: 'Apoio da capa.', canvas: null, photoRegion: 'full', bodyAfterImage: '', ...extra,
});
const render = (slide, brand, creativePreset) => renderToStaticMarkup(React.createElement(SlideCardInner, {
  slide, brand, fmt: 'carrossel', num: 2, total: 7, forExport: true, creativePreset,
}));
const vezes = (html, trecho) => html.split(trecho).length - 1;

const canais = (cor) => {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(cor);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, '$&$&') : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1);
  }
  const m = /^rgba?\(([^)]+)\)$/.exec(cor);
  const [r, g, b, a = 1] = m[1].split(',').map(Number);
  return [r, g, b, a];
};
/** Cor que o olho vê: a tinta translúcida já misturada com o que está atrás. */
function sobre(cor, fundo) {
  const [r, g, b, a] = canais(cor);
  const [fr, fg, fb] = canais(fundo);
  return `#${[[r, fr], [g, fg], [b, fb]].map(([x, y]) => Math.round(x * a + y * (1 - a)).toString(16).padStart(2, '0')).join('')}`;
}
const estilo = (tag) => Object.fromEntries((tag.match(/style="([^"]*)"/)?.[1] || '').split(';').filter(Boolean).map((par) => {
  const i = par.indexOf(':');
  return [par.slice(0, i), par.slice(i + 1)];
}));
function topo(html) {
  const barra = html.match(/<div data-vc-chrome="headerBar"[^>]*>(.*?)<\/div>/)?.[1] || '';
  return {
    colunas: [...barra.matchAll(/<span[^>]*>/g)].map((m) => estilo(m[0]).color),
    contador: estilo(html.match(/<div data-vc-chrome="pageBadge"[^>]*>/)?.[0] || ''),
  };
}

describe('GA-10: layout Cultura sem composição desenha a barra editorial e o contador uma vez só', () => {
  it.each([
    ['narrativa Tendência e Cultura', {}, 'tendencia_cultura'],
    ['card com layout Cultura próprio', { useCultureLayout: true }, 'livre'],
  ])('%s', (_nome, extra, creativePreset) => {
    const brand = marca(CLARO);
    const html = render(capa(brand, extra), brand, creativePreset);
    expect(vezes(html, BARRA)).toBe(1);
    expect(vezes(html, '>2/7<')).toBe(1);
    expect(vezes(html, 'data-vc-chrome="headerBar"')).toBe(1);
    expect(vezes(html, 'data-vc-chrome="pageBadge"')).toBe(1);
  });

  it('fora do Cultura continua uma barra e um contador', () => {
    const brand = marca(CLARO);
    const html = render(capa(brand), brand, 'livre');
    expect(vezes(html, BARRA)).toBe(1);
    expect(vezes(html, '>2/7<')).toBe(1);
    expect(vezes(html, 'data-vc-chrome="headerBar"')).toBe(1);
  });
});

describe('GA-10: barra e contador do Cultura leem em marca de fundo escuro', () => {
  it('a regra: tinta clara sobre foto e sobre fundo escuro; escura onde ela lê melhor', () => {
    const { cultureHeaderInks } = chrome;
    expect(typeof cultureHeaderInks).toBe('function');
    const escuras = { bar: 'rgba(29,29,31,0.45)', badgeBg: 'rgba(0,0,0,0.07)', badgeFg: '#1d1d1f' };
    const claras = { bar: 'rgba(255,255,255,0.62)', badgeBg: 'rgba(0,0,0,0.32)', badgeFg: '#fff' };
    expect(cultureHeaderInks(true, CLARO)).toEqual(claras);
    expect(cultureHeaderInks(false, CLARO)).toEqual(escuras);
    expect(cultureHeaderInks(false, '#F2EDE4')).toEqual(escuras);
    expect(cultureHeaderInks(false, ESCURO)).toEqual(claras);
    expect(cultureHeaderInks(false, '#121318')).toEqual(claras);
    // Fundo que não dá para medir fica como era.
    expect(cultureHeaderInks(false, undefined)).toEqual(escuras);
    expect(cultureHeaderInks(false, 'linear-gradient(#000,#111)')).toEqual(escuras);
  });

  const ramos = [
    ['sem composição', (brand) => capa(brand), 'tendencia_cultura'],
    ['composição com zonas', (brand) => capa(brand, { canvas: { enabled: false, applied: true, variant: 'classic', zones: { ...DEFAULT_CANVAS_ZONES_CLASSIC } } }), 'tendencia_cultura'],
    ['foto em faixa', (brand) => capa(brand, { photoRegion: 'inset_h_top' }), 'tendencia_cultura'],
  ];

  /** Cores da barra e do contador do Cultura, pelo texto (dois ramos não têm marcador). */
  function tintas(html) {
    const span = html.match(new RegExp(`<span style="([^"]*)">${BARRA}</span>`));
    const cont = html.match(/<div (?:data-vc-chrome="pageBadge" )?style="([^"]*)">2\/7<\/div>/);
    expect(span, 'barra desenhada').toBeTruthy();
    expect(cont, 'contador desenhado').toBeTruthy();
    return { barra: estilo(`style="${span[1]}"`).color, contador: estilo(`style="${cont[1]}"`) };
  }

  it.each(ramos)('%s, fundo #0a0a0a sem foto: os dois passam de 3:1', (_nome, slideDe, creativePreset) => {
    const brand = marca(ESCURO);
    const { barra, contador } = tintas(render(slideDe(brand), brand, creativePreset));
    expect(wcagContrast(sobre(barra, ESCURO), ESCURO), `barra ${barra}`).toBeGreaterThanOrEqual(3);
    const fundoDoContador = sobre(contador.background, ESCURO);
    expect(wcagContrast(sobre(contador.color, fundoDoContador), fundoDoContador), `contador ${contador.color}`).toBeGreaterThanOrEqual(3);
  });

  it.each(ramos)('%s, fundo claro: tintas como estavam', (_nome, slideDe, creativePreset) => {
    const brand = marca(CLARO);
    const { barra, contador } = tintas(render(slideDe(brand), brand, creativePreset));
    expect(barra).toBe('rgba(29,29,31,0.45)');
    expect(contador.background).toBe('rgba(0,0,0,0.07)');
    expect(contador.color).toBe('#1d1d1f');
  });
});
