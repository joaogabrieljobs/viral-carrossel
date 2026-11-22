import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { applyPresentationVisualPreset, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { brandPaletteOverrides, familySpec, groundInks } from '../../src/utils/presentation-families.js';

// Reteste 22/11 (WebExpresso, marca própria): barra acima do título e números
// dos passos saíam azuis e o último slide com fundo azul-marinho; o destaque
// da marca não chegava aos detalhes da família.
const PINK = '#d9a3b6';
const DARK = '#121318';

describe('destaque da marca nos detalhes da apresentação', () => {
  it('marca própria sobrepõe o destaque e o fundo invertido da família', () => {
    const accent = familySpec('executive').palette.accent;
    expect(brandPaletteOverrides('executive', { accent: PINK, bg: DARK, titleColor: '#f5f5f5' })).toEqual({ accent: PINK, inverse: DARK });
    expect(brandPaletteOverrides('executive', { accent, bg: '#ffffff', titleColor: '#111111' })).toEqual({});
    expect(groundInks('executive', 'inverse', { accent: PINK, inverse: DARK }).bg).toBe(DARK);
  });

  it('o slide renderiza barra, números e fundo invertido com as cores da marca', () => {
    const preset = 'presentation_executive_minimal';
    const brand = { ...applyPresentationVisualPreset({ ...DEFAULT_BRAND, showHandle: false, logo: null }, preset), accent: PINK, bg: DARK, titleColor: '#f5f5f5', textColor: '#d8d8d8' };
    const familyAccent = familySpec('executive').palette.accent.toLowerCase();
    const html = [[1, 'content'], [9, 'closing']].map(([index, role]) => {
      const base = { ...mkSlide(index + 1, brand), title: 'Peça seu site', subtitle: 'Três passos.', presentationPlan: { visualRole: role },
        presentationBlocks: [{ type: 'steps', items: [{ title: 'Escolha', body: 'Modelo.' }, { title: 'Pague', body: '3 parcelas.' }] }] };
      const slide = { ...base, ...getPresentationCompositionOverrides(preset, { slide: base, stage: {}, index, count: 10 }), presentationQualityVersion: 1 };
      return renderToStaticMarkup(React.createElement(SlideCardInner, { slide, brand, fmt: 'apresentacao', num: index + 1, total: 10, forExport: true }));
    }).join('\n').toLowerCase();
    expect(html).not.toContain(familyAccent);
    expect(html).not.toContain(familySpec('executive').palette.inverse.toLowerCase());
  });
});
