import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as primitives from '../../src/components/card/render-primitives.jsx';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { overflowExportMessage, presentationOverflowAtFloor } from '../../src/hooks/useExport.js';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { VISUAL_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import { applySocialVisualComposition } from '../../src/utils/social-visual-composition.js';

const { nextOverflowScale, overflowFlagAfterMeasure, OVERFLOW_ABSOLUTE_MIN_SCALE } = primitives;

afterEach(() => vi.unstubAllGlobals());

/** Repete as medições do OverflowScaler numa zona onde o texto nunca cabe. */
function zonaQueNuncaCabe({ minScale, hardMinScale, strictMinScale = false, flagAtLowestFloor }) {
  const passos = [];
  let scale = 1;
  for (let i = 0; i < 8; i += 1) {
    const target = nextOverflowScale({
      currentScale: scale, clientHeight: 120, contentHeight: 4000, minScale, hardMinScale, strictMinScale,
    });
    passos.push({
      scale,
      marcado: overflowFlagAfterMeasure({ effectiveScale: scale, target, minScale, hardMinScale, strictMinScale, flagAtLowestFloor }),
    });
    if (target >= scale - 0.003) break;
    scale = target;
  }
  return passos;
}

describe('GA-02: card composto do carrossel avisa quando o texto não cabe nem no menor tamanho', () => {
  it.each([
    ['título', { minScale: 0.45, hardMinScale: 0.45 }],
    ['apoio', { minScale: 0.62, hardMinScale: 0.62 }],
  ])('%s: chega ao menor tamanho, continua cortado e a zona fica marcada', (_nome, pisos) => {
    const passos = zonaQueNuncaCabe({ ...pisos, flagAtLowestFloor: true });
    const ultimo = passos.at(-1);
    expect(ultimo.scale).toBe(OVERFLOW_ABSOLUTE_MIN_SCALE);
    expect(ultimo.marcado).toBe(true);
    // Enquanto ainda há tamanho menor para tentar, não marca (não barra à toa).
    expect(passos.slice(0, -1).every((passo) => passo.marcado === false)).toBe(true);
  });

  it('sem pedir a marcação (decks antigos), nada muda', () => {
    const passos = zonaQueNuncaCabe({ minScale: 0.45, hardMinScale: 0.32 });
    expect(passos.every((passo) => passo.marcado === false)).toBe(true);
  });

  it('deck com piso rígido continua marcando no próprio piso', () => {
    const passos = zonaQueNuncaCabe({ minScale: 0.8, hardMinScale: 0.45, strictMinScale: true });
    expect(passos.at(-1)).toEqual({ scale: 0.8, marcado: true });
  });

  it('o carrossel gerado pede a marcação nas duas zonas; o deck não', () => {
    const preset = VISUAL_PRESETS.find((p) => p.id === 'sports_editorial');
    const brand = applyVisualPreset({ name: 'Padaria', handle: '' }, preset.id);
    const [slide] = applySocialVisualComposition(
      [{ ...mkSlide(1, brand), id: 'c1', title: 'Título', subtitle: 'Apoio do card.', imageQuery: '' }],
      { preset, brand },
    );
    const carrossel = renderToStaticMarkup(React.createElement(SlideCardInner, { slide, brand, fmt: 'carrossel', num: 1, total: 1, forExport: true }));
    expect(carrossel.match(/data-vc-overflow-flag="lowest-floor"/g)).toHaveLength(2);
    const deck = renderToStaticMarkup(React.createElement(SlideCardInner, { slide, brand, fmt: 'apresentacao', num: 1, total: 1, forExport: true }));
    expect(deck).not.toContain('data-vc-overflow-flag');
  });
});

describe('GA-02: zonas de texto sem ajuste automático também são medidas', () => {
  const brand = { ...DEFAULT_BRAND, subtitleVisible: true, showHandle: false };
  const base = () => ({ ...mkSlide(1, brand), title: 'Título do card', subtitle: 'Apoio do card.', canvas: null, useCultureLayout: false });
  const render = (slide) => renderToStaticMarkup(React.createElement(SlideCardInner, { slide, brand, fmt: 'carrossel', num: 1, total: 1, forExport: true }));

  it('foto em faixa: cada coluna de texto é uma zona medida', () => {
    expect(render({ ...base(), photoRegion: 'inset_h_top' }).match(/data-vc-fit-zone="column"/g)).toHaveLength(1);
    expect(render({ ...base(), photoRegion: 'inset_h_bottom' }).match(/data-vc-fit-zone="column"/g)).toHaveLength(1);
    expect(render({ ...base(), photoRegion: 'inset_h_middle' }).match(/data-vc-fit-zone="column"/g)).toHaveLength(2);
  });

  it('fundo inteiro: a moldura do texto é uma zona medida', () => {
    expect(render({ ...base(), photoRegion: 'full' }).match(/data-vc-fit-zone="frame"/g)).toHaveLength(1);
  });

  it('texto que cabe não marca nada no HTML (nenhum card que hoje cabe muda)', () => {
    for (const photoRegion of ['full', 'inset_h_top']) expect(render({ ...base(), photoRegion })).not.toContain('data-vc-overflow-at-floor="true"');
  });

  it('só é corte quando o bloco passa da borda que recorta', () => {
    const { blockOutsideFrame } = primitives;
    const moldura = { frameWidth: 1080, frameHeight: 1350 };
    // Dentro do card, mesmo encostado na margem: não é corte.
    expect(blockOutsideFrame({ ...moldura, left: 60, top: 20, width: 900, height: 1300 })).toBe(false);
    // Layout "meio" com bloco mais alto que o card: sobra por cima e por baixo.
    expect(blockOutsideFrame({ ...moldura, left: 60, top: -150, width: 900, height: 1650 })).toBe(true);
    // Layout inferior: o excesso sai só pelo topo.
    expect(blockOutsideFrame({ ...moldura, left: 60, top: -40, width: 900, height: 1300 })).toBe(true);
    expect(blockOutsideFrame({ ...moldura, left: 60, top: 200, width: 1100, height: 400 })).toBe(true);
    // Sobra de entrelinha e arredondamento (até 12 px) não contam; mais que isso, sim.
    expect(blockOutsideFrame({ ...moldura, left: 0, top: -6, width: 1080, height: 1362 })).toBe(false);
    expect(blockOutsideFrame({ ...moldura, left: 60, top: -13, width: 900, height: 600 })).toBe(true);
    // Coluna baixa: a folga acompanha o lado (2%).
    expect(blockOutsideFrame({ frameWidth: 1080, frameHeight: 300, left: 60, top: -5, width: 900, height: 300 })).toBe(false);
    expect(blockOutsideFrame({ frameWidth: 1080, frameHeight: 300, left: 60, top: -8, width: 900, height: 300 })).toBe(true);
    expect(blockOutsideFrame({ frameWidth: 0, frameHeight: 0, left: 0, top: -50, width: 10, height: 10 })).toBe(false);
  });

  const caixa = (left, top, width, height) => ({ getBoundingClientRect: () => ({ left, top, width, height }) });

  it('medição no DOM: texto dentro do recuo da coluna não é corte; fora da borda é', () => {
    const coluna = (filhos) => ({ offsetHeight: 572, children: filhos, ...caixa(100, 800, 1080, 572) });
    // Título 566 px numa coluna de 572 px com recuo: passa do recuo, não da borda.
    expect(primitives.measureZoneTextCut(coluna([caixa(186, 803, 907, 566)]))).toBe(false);
    // Título 703 px centrado: sobra 65 px por cima e por baixo.
    expect(primitives.measureZoneTextCut(coluna([caixa(186, 735, 907, 703)]))).toBe(true);
    expect(primitives.measureZoneTextCut(coluna([]))).toBe(false);
  });

  it('medição no DOM: na pré-visualização reduzida a conta é a mesma do arquivo', () => {
    // Mesma coluna a 1/3 do tamanho: retângulos em px de ecrã, altura de layout 572.
    const coluna = (filho) => ({ offsetHeight: 572, children: [filho], ...caixa(30, 200, 360, 572 / 3) });
    expect(primitives.measureZoneTextCut(coluna(caixa(59, 201, 302, 566 / 3)))).toBe(false);
    expect(primitives.measureZoneTextCut(coluna(caixa(59, 178, 302, 703 / 3)))).toBe(true);
  });

  it('medição no DOM: zona escondida ou sem tamanho não marca', () => {
    expect(primitives.measureZoneTextCut({ offsetHeight: 0, children: [caixa(0, 0, 10, 10)], ...caixa(0, 0, 0, 0) })).toBe(false);
  });
});

describe('GA-02: a trava de exportação enxerga o carrossel e diz o card', () => {
  it('a mesma marca usada nas apresentações é lida em qualquer raiz', () => {
    const cortado = { id: 'zona' };
    const root = { querySelectorAll: (selector) => (selector === '[data-vc-overflow-at-floor="true"]' ? [cortado] : []) };
    expect(presentationOverflowAtFloor([root])).toEqual([cortado]);
  });

  it('carrossel: fala em card e dá a saída', () => {
    const um = overflowExportMessage([3], { itemLabel: 'card' });
    expect(um).toMatch(/^Card 3: o texto não cabe/);
    expect(um).toMatch(/Abra o card e encurte o texto ou diminua o tamanho da letra/);
    expect(um).not.toMatch(/slide/i);
    const varios = overflowExportMessage([2, 5, 6], { itemLabel: 'card' });
    expect(varios).toMatch(/^Cards 2, 5 e 6: /);
    expect(varios).toMatch(/Abra cada card/);
    expect(overflowExportMessage([], { itemLabel: 'card' })).toMatch(/^Um card: /);
  });

  it('apresentação: a mensagem de antes não muda', () => {
    expect(overflowExportMessage([4])).toBe('Slide 4: o texto passa da área segura e seria cortado no arquivo. Abra o slide e reduza o texto na aba Texto, ou aumente a caixa arrastando a borda.');
    expect(overflowExportMessage([1, 2], { itemLabel: 'slide' })).toMatch(/^Slides 1 e 2: .*Abra cada slide/);
  });
});
