import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { applyPresentationVisualPreset, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { TITLE_BOTTOM_RESERVE_EM, titleBottomReservePx, titleHasStackingRisk, titleStackingFromGlyphs } from '../../src/utils/title-stacking.js';
import { VISUAL_PRESETS, SOCIAL_FAMILY_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import { applySocialVisualComposition } from '../../src/utils/social-visual-composition.js';
import { DEFAULT_CANVAS_ZONES_CLASSIC } from '../../src/utils/canvas-zones.js';

/**
 * Medidas reais (em) tiradas no navegador em 24/11 com as faces do app:
 * perna = quanto a tinta desce da linha de base; acento = quanto sobe.
 */
const ARCHIVO = { perna: 0.198, acentoMinuscula: 0.724, acentoMaiuscula: 0.88, fontAscent: 0.878, fontDescent: 0.21 };
const ANTON = { cedilha: 0.308, acentoMaiuscula: 1.101, fontAscent: 1.177, fontDescent: 0.328 };
const PX = 100;
/** Glifo numa linha: `top` da linha e faixa horizontal, em px. */
const g = (ch, linha, x0, largura, { desc = 0, asc = 0 }) => ({ ch, top: linha * 98, x0, x1: x0 + largura, desc, asc });

describe('QA-2411 carrossel 6: perna de uma linha não encosta no acento da linha de baixo', () => {
  it('Suíço (Archivo a 0,98): "ç" em cima de "À" pede entrelinha maior que a do estilo', () => {
    const glyphs = [
      g('ç', 0, 120, 50, { desc: ARCHIVO.perna }),
      g('À', 1, 110, 70, { asc: ARCHIVO.acentoMaiuscula }),
    ];
    const r = titleStackingFromGlyphs({ glyphs, fontPx: PX, leading: 0.98, ...ARCHIVO });
    // 0,198 + 0,88 = 1,078: com 0,98 a cedilha entra 10% do corpo no acento grave.
    expect(r.leading).toBeGreaterThanOrEqual(1.078);
    expect(r.leading).toBeLessThan(1.12);
  });

  it('Tipográfico (Anton em caixa alta a 1,15): "Ç" em cima de "Ã" pede entrelinha maior', () => {
    const glyphs = [
      g('Ç', 0, 300, 55, { desc: ANTON.cedilha }),
      g('Ã', 1, 320, 60, { asc: ANTON.acentoMaiuscula }),
    ];
    const r = titleStackingFromGlyphs({ glyphs, fontPx: PX, leading: 1.15, ...ANTON });
    expect(r.leading).toBeGreaterThanOrEqual(1.409);
    expect(r.leading).toBeLessThan(1.45);
  });

  it('vizinhos na diagonal também contam: a cedilha e o til passam da caixa da letra', () => {
    // "AÇAÍ" em cima de "PÃO": as caixas só se encostam, e a tinta se toca.
    const glyphs = [g('Ç', 0, 345, 55, { desc: ANTON.cedilha }), g('Ã', 1, 295, 50, { asc: ANTON.acentoMaiuscula })];
    expect(titleStackingFromGlyphs({ glyphs, fontPx: PX, leading: 1.15, ...ANTON }).leading).toBeGreaterThanOrEqual(1.409);
  });

  it('perna e acento que não ficam um em cima do outro não mudam a entrelinha', () => {
    const glyphs = [
      g('ç', 0, 120, 50, { desc: ARCHIVO.perna }),
      g('À', 1, 600, 70, { asc: ARCHIVO.acentoMaiuscula }),
    ];
    expect(titleStackingFromGlyphs({ glyphs, fontPx: PX, leading: 0.98, ...ARCHIVO }).leading).toBe(0);
  });

  it('só linhas vizinhas contam, e só perna em cima de acento (não o contrário)', () => {
    const emLinhasDistantes = [g('g', 0, 100, 50, { desc: ARCHIVO.perna }), g('É', 2, 100, 60, { asc: ARCHIVO.acentoMaiuscula })];
    expect(titleStackingFromGlyphs({ glyphs: emLinhasDistantes, fontPx: PX, leading: 0.98, ...ARCHIVO }).leading).toBe(0);
    const acentoEmCima = [g('É', 0, 100, 60, { asc: ARCHIVO.acentoMaiuscula }), g('g', 1, 100, 50, { desc: ARCHIVO.perna })];
    expect(titleStackingFromGlyphs({ glyphs: acentoEmCima, fontPx: PX, leading: 0.98, ...ARCHIVO }).leading).toBe(0);
  });

  it('entrelinha que já basta não muda (estilos de controle ficam como estão)', () => {
    const glyphs = [g('ç', 0, 120, 50, { desc: ARCHIVO.perna }), g('ã', 1, 110, 50, { asc: ARCHIVO.acentoMinuscula })];
    // Grade suíça (Archivo a 1,10) e o próprio Suíço com acento de minúscula (0,198 + 0,724 = 0,922).
    expect(titleStackingFromGlyphs({ glyphs, fontPx: PX, leading: 1.1, ...ARCHIVO }).leading).toBe(0);
    expect(titleStackingFromGlyphs({ glyphs, fontPx: PX, leading: 0.98, ...ARCHIVO }).leading).toBe(0);
    // Abaixo de 0,95 esse mesmo par já encosta.
    expect(titleStackingFromGlyphs({ glyphs, fontPx: PX, leading: 0.85, ...ARCHIVO }).leading).toBeGreaterThanOrEqual(0.922);
  });

  it('vale o pior par quando há vários', () => {
    const glyphs = [
      g('g', 0, 100, 50, { desc: 0.2 }), g('ç', 0, 400, 50, { desc: 0.25 }),
      g('ã', 1, 100, 50, { asc: 0.72 }), g('É', 1, 400, 60, { asc: 0.9 }),
    ];
    const r = titleStackingFromGlyphs({ glyphs, fontPx: PX, leading: 1, fontAscent: 0.9, fontDescent: 0.2 });
    expect(r.leading).toBeGreaterThanOrEqual(1.15);
    expect(r.leading).toBeLessThan(1.2);
  });
});

describe('QA-2411 carrossel 6: o título tem reserva inferior sempre', () => {
  const h1 = (html) => html.match(/<h1[^>]*style="([^"]*)"/)[1];
  const px = (style, prop) => Number(style.match(new RegExp(`(?:^|;)${prop}:([\\d.]+)px`))?.[1] ?? (new RegExp(`(?:^|;)${prop}:0(;|$)`).test(style) ? 0 : NaN));

  it('nunca menos de 0,15 em; a reserva maior do estilo continua valendo', () => {
    expect(titleBottomReservePx(100)).toBe(15);
    expect(titleBottomReservePx(100, 0)).toBe(15);
    expect(titleBottomReservePx(100, 22)).toBe(22);
    expect(titleBottomReservePx(100, 16, 0.31)).toBe(31);
  });

  it('Manchete (Anton a 1,22): o título desenhado tem reserva de 0,15 em, na capa e no miolo', () => {
    const preset = [...VISUAL_PRESETS, ...SOCIAL_FAMILY_PRESETS].find((p) => p.id === 'social_manchete');
    const brand = applyVisualPreset({ name: 'Padaria', handle: '' }, preset.id);
    const cards = [
      { title: 'Ninguém viu o preço da praça', subtitle: 'Um ensaio.', imageQuery: '' },
      { title: 'A fila começa cedo na praça', subtitle: 'O pão chegava pronto à vitrine e ninguém via o trabalho de quem acordava cedo.', imageQuery: '' },
      { title: 'Volte amanhã', subtitle: 'Salve para depois.', imageQuery: '' },
    ].map((c, i) => ({ ...mkSlide(i + 1, brand), ...c }));
    const slides = applySocialVisualComposition(cards, { preset, brand });
    slides.forEach((slide, i) => {
      const style = h1(renderToStaticMarkup(React.createElement(SlideCardInner, { slide, brand, fmt: 'carrossel', num: i + 1, total: 3, forExport: true, creativePreset: 'livre' })));
      expect(style).toContain('line-height:1.22');
      expect(px(style, 'padding-bottom') / px(style, 'font-size')).toBeCloseTo(0.15, 3);
    });
  });

  it('card com zonas de composição fora da biblioteca também tem a reserva', () => {
    const brand = { ...DEFAULT_BRAND, subtitleVisible: true, showHandle: false };
    const slide = { ...mkSlide(1, brand), title: 'Peça já', subtitle: 'Apoio', canvas: { enabled: false, applied: true, variant: 'classic', zones: { ...DEFAULT_CANVAS_ZONES_CLASSIC } } };
    const style = h1(renderToStaticMarkup(React.createElement(SlideCardInner, { slide, brand, fmt: 'carrossel', num: 1, total: 3, forExport: true, creativePreset: 'livre' })));
    expect(px(style, 'padding-bottom') / px(style, 'font-size')).toBeCloseTo(0.15, 3);
  });
});

describe('QA-2411 carrossel 6: reserva inferior quando a última linha tem perna', () => {
  it('Anton a 1,22 sem reserva: a cedilha da última linha passa da caixa e ganha 0,15 em', () => {
    const glyphs = [g('A', 0, 0, 50, {}), g('Ç', 1, 100, 55, { desc: ANTON.cedilha })];
    const r = titleStackingFromGlyphs({ glyphs, fontPx: PX, leading: 1.22, paddingBottomEm: 0, ...ANTON });
    expect(TITLE_BOTTOM_RESERVE_EM).toBe(0.15);
    expect(r.reserve).toBeGreaterThanOrEqual(0.15);
  });

  it('última linha sem perna não ganha reserva (o card não muda)', () => {
    // A perna está na primeira de duas linhas; a segunda não tem glifo medido.
    const glyphs = [g('Ç', 0, 100, 55, { desc: ANTON.cedilha })];
    expect(titleStackingFromGlyphs({ glyphs, fontPx: PX, leading: 1.22, paddingBottomEm: 0, firstLineTop: 0, lineCount: 2, ...ANTON }).reserve).toBe(0);
    // A mesma perna na última linha ganha.
    expect(titleStackingFromGlyphs({ glyphs, fontPx: PX, leading: 1.22, paddingBottomEm: 0, firstLineTop: 0, lineCount: 1, ...ANTON }).reserve).toBeGreaterThanOrEqual(0.15);
  });

  it('reserva que o estilo já dá e basta fica como está', () => {
    const glyphs = [g('g', 0, 100, 50, { desc: ARCHIVO.perna })];
    expect(titleStackingFromGlyphs({ glyphs, fontPx: PX, leading: 0.98, paddingBottomEm: 0.22, ...ARCHIVO }).reserve).toBe(0);
  });
});

describe('QA-2411 carrossel 6: só mede título que pode ter o problema', () => {
  it('pede perna e acento, ou perna sozinha (última linha)', () => {
    expect(titleHasStackingRisk('Opção que já pegou jeito')).toBe(true);
    expect(titleHasStackingRisk('Plano de jogo')).toBe(true);
    expect(titleHasStackingRisk('Uma lista banal')).toBe(false);
    expect(titleHasStackingRisk('')).toBe(false);
  });
});

describe('QA-2411 carrossel 6: o HTML inicial do card não muda (a medida acontece no navegador)', () => {
  it('Suíço: o título nasce com a entrelinha do estilo', () => {
    const preset = 'presentation_swiss_grid';
    const brand = applyPresentationVisualPreset({ ...DEFAULT_BRAND, name: 'Padaria', showHandle: false, logo: null }, preset);
    const b = { ...mkSlide(1, brand), title: 'Opção que já pegou jeito\nÉ fácil, ágil e às vezes ótima', subtitle: 'Apoio', presentationPlan: { visualRole: 'cover' }, presentationVisualRole: 'cover' };
    const slide = { ...b, ...getPresentationCompositionOverrides(preset, { slide: b, stage: { visualRole: 'cover' }, index: 0, count: 6 }) };
    const html = renderToStaticMarkup(React.createElement(SlideCardInner, { slide, brand, fmt: 'apresentacao', num: 1, total: 6, forExport: true, creativePreset: 'apresentacao' }));
    expect(html).toMatch(/<h1[^>]*line-height:0\.98[;"]/);
  });
});
