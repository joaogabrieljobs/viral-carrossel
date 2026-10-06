import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import {
  applyPresentationVisualPreset,
  getPresentationCompositionOverrides,
} from '../../src/styles/presentation-presets.jsx';

function presentationSlide(overrides = {}) {
  const composition = getPresentationCompositionOverrides('presentation_data', {
    slide: { presentationVisualRole: 'data' },
    stage: { visualRole: 'data' },
    index: 3,
    count: 8,
  });
  return {
    ...mkSlide(4, DEFAULT_BRAND),
    ...composition,
    title: 'Receita recorrente cresceu 38%',
    subtitle: 'A expansão veio da base ativa, com melhora de retenção.',
    bodyAfterImage: 'Fonte: relatório anual 2026 · R$ milhões · valores não auditados',
    imageQuery: 'gráfico executivo de receita recorrente',
    ...overrides,
  };
}

function renderPresentation(forExport, overrides = {}) {
  return renderToStaticMarkup(React.createElement(SlideCardInner, {
    slide: presentationSlide(overrides),
    fmt: 'apresentacao',
    brand: applyPresentationVisualPreset(DEFAULT_BRAND, 'presentation_data'),
    num: 4,
    total: 8,
    creativePreset: 'apresentacao',
    forExport,
  }));
}

describe('texto complementar em cards de apresentação', () => {
  it.each([
    ['preview', false],
    ['exportação', true],
  ])('renderiza fonte, unidade, período e ressalva na %s', (_label, forExport) => {
    const html = renderPresentation(forExport);
    expect(html).toContain('Fonte: relatório anual 2026');
    expect(html).toContain('R$ milhões');
    expect(html).toContain('valores não auditados');
  });

  it.each([
    ['full bleed', { canvas: null, presentationCompositionId: null, presentationPresetId: null, photoRegion: 'full' }],
    ['foto em faixa', { canvas: null, presentationCompositionId: null, presentationPresetId: null, photoRegion: 'inset_h_top' }],
  ])('mantém o texto complementar no layout %s', (_label, overrides) => {
    const html = renderPresentation(true, overrides);
    expect(html).toContain('Fonte: relatório anual 2026');
    expect(html).toContain('valores não auditados');
  });
});
