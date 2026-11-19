import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  SlideCardInner,
  canvasClassicTextPaddingYPx,
  canvasClassicTitlePaddingXPx,
  presentationAutofitSoftFloor,
  presentationTypographyToken,
  presentationTitleSizePercent,
  strictPresentationAutofit,
} from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';
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

  it('distingue falha de geração do convite comum para inserir foto', () => {
    const html = renderPresentation(false, {
      bgImage: null,
      bgImageFailed: true,
      imageQuery: 'gráfico executivo que falhou',
    });

    expect(html).toContain('Imagem indisponível — toque para substituir');
    expect(html).not.toContain('Toque para inserir foto');
  });

  it('mostra carregamento enquanto a imagem ainda não ficou pronta no renderer', () => {
    const html = renderPresentation(false, {
      bgImage: 'data:image/png;base64,abc',
      bgImageFailed: false,
    });

    expect(html).toContain('Carregando a foto…');
    expect(html).toContain('role="status"');
  });

  it('não inclui estados de interface da imagem na árvore de exportação', () => {
    const html = renderPresentation(true, {
      bgImage: null,
      bgImageFailed: true,
      imageQuery: 'gráfico executivo que falhou',
    });

    expect(html).not.toContain('Imagem indisponível');
    expect(html).not.toContain('Toque para inserir foto');
  });

  it('usa a mesma fonte de leitura no subtítulo e apoio do Editorial, com display próprio', () => {
    const presetId = 'presentation_editorial_magazine';
    const brand = applyPresentationVisualPreset(DEFAULT_BRAND, presetId);
    const composition = getPresentationCompositionOverrides(presetId, {
      slide: { presentationVisualRole: 'content' },
      stage: { visualRole: 'content' },
      index: 1,
      count: 6,
    });
    const slide = {
      ...mkSlide(2, DEFAULT_BRAND),
      ...composition,
      title: 'Leitura editorial',
      subtitle: 'SUBTITLE_FONT_MARKER',
      bodyAfterImage: 'BODY_FONT_MARKER',
    };
    const html = renderToStaticMarkup(React.createElement(SlideCardInner, {
      slide: slideForFormatDisplay(slide, 'apresentacao'),
      fmt: 'apresentacao',
      brand,
      num: 2,
      total: 6,
      creativePreset: 'apresentacao',
      forExport: true,
    }));

    const openingTagFor = (text) => {
      const textIndex = html.indexOf(text);
      expect(textIndex).toBeGreaterThan(-1);
      const tagStart = html.lastIndexOf('<', textIndex);
      const tagEnd = html.indexOf('>', tagStart);
      return html.slice(tagStart, tagEnd + 1);
    };

    expect(brand.subtitleFont).toBe(brand.bodyFont);
    expect(brand.titleFont).not.toBe(brand.bodyFont);
    expect(openingTagFor('SUBTITLE_FONT_MARKER'))
      .toMatch(/font-family:&quot;Source Serif 4&quot;,\s*serif/);
    expect(openingTagFor('SUBTITLE_FONT_MARKER')).toContain('font-weight:400');
    expect(openingTagFor('SUBTITLE_FONT_MARKER')).toContain('text-transform:none');
    expect(openingTagFor('SUBTITLE_FONT_MARKER')).toContain('letter-spacing:0em');
    expect(openingTagFor('SUBTITLE_FONT_MARKER')).toContain('line-height:1.48');
    expect(openingTagFor('BODY_FONT_MARKER'))
      .toMatch(/font-family:&quot;Source Serif 4&quot;,\s*serif/);
    expect(openingTagFor('BODY_FONT_MARKER')).toContain('font-weight:400');
    expect(openingTagFor('BODY_FONT_MARKER')).toContain('line-height:1.48');
    expect(openingTagFor('BODY_FONT_MARKER')).toContain('letter-spacing:0em');
    expect(openingTagFor('BODY_FONT_MARKER')).toMatch(/font-size:25\.9\d*px/);
  });

  it('usa a escala display da composição de capa sem contaminar slides h1', () => {
    const presetId = 'presentation_premium_dark';
    const cover = getPresentationCompositionOverrides(presetId, {
      slide: {}, stage: {}, index: 0, count: 6,
    });
    const content = getPresentationCompositionOverrides(presetId, {
      slide: {}, stage: {}, index: 1, count: 6,
    });

    expect(cover.presentationComposition).toBe('cover');
    expect(content.presentationComposition).toBe('content');
    expect(1920 * 0.084 * presentationTitleSizePercent(cover) / 100).toBeCloseTo(120, 1);
    expect(1920 * 0.084 * presentationTitleSizePercent(content) / 100).toBeCloseTo(80, 1);
    expect(presentationTypographyToken(cover, 'title')).toMatchObject({
      role: 'display',
      fontFamily: '"Bodoni Moda", Didot, serif',
      weight: 400,
      leadingPercent: 104,
    });
  });

  it('aplica o papel body ao campo de apoio quando a composição assim declara', () => {
    const presetId = 'presentation_executive_minimal';
    const brand = applyPresentationVisualPreset(DEFAULT_BRAND, presetId);
    const composition = getPresentationCompositionOverrides(presetId, {
      slide: { presentationVisualRole: 'content' },
      stage: { visualRole: 'content' },
      index: 1,
      count: 6,
    });
    const slide = {
      ...mkSlide(2, DEFAULT_BRAND),
      ...composition,
      title: 'Decisão executiva',
      subtitle: 'BODY_ROLE_MARKER',
    };
    const html = renderToStaticMarkup(React.createElement(SlideCardInner, {
      slide: slideForFormatDisplay(slide, 'apresentacao'),
      fmt: 'apresentacao',
      brand,
      num: 2,
      total: 6,
      creativePreset: 'apresentacao',
      forExport: true,
    }));
    const marker = html.indexOf('BODY_ROLE_MARKER');
    const tagStart = html.lastIndexOf('<', marker);
    const tagEnd = html.indexOf('>', tagStart);
    const tag = html.slice(tagStart, tagEnd + 1);

    expect(composition.presentationTypographyByComposition.content.subtitle.role).toBe('body');
    expect(tag).toContain('font-weight:400');
    expect(tag).toContain('text-transform:none');
    expect(tag).toMatch(/letter-spacing:-0\.00[34]/);
    expect(tag).toMatch(/font-size:31\.0\d*px/);
  });

  it('não cria painel de foto vazio no Luxo sem imagem e mantém o título sem glass', () => {
    const presetId = 'presentation_premium_dark';
    const brand = applyPresentationVisualPreset(DEFAULT_BRAND, presetId);
    const composition = getPresentationCompositionOverrides(presetId, {
      slide: { presentationVisualRole: 'content' },
      stage: { visualRole: 'content' },
      index: 1,
      count: 6,
    });
    const slide = {
      ...mkSlide(2, DEFAULT_BRAND),
      ...composition,
      title: 'PREMIUM_TITLE_MARKER',
      subtitle: 'Painel de apoio',
      bodyAfterImage: 'Corpo premium',
    };
    const html = renderToStaticMarkup(React.createElement(SlideCardInner, {
      slide: slideForFormatDisplay(slide, 'apresentacao'),
      fmt: 'apresentacao',
      brand,
      num: 2,
      total: 6,
      creativePreset: 'apresentacao',
      forExport: true,
    }));
    const titleIndex = html.indexOf('PREMIUM_TITLE_MARKER');
    const titleTagStart = html.lastIndexOf('<', titleIndex);
    const titleTagEnd = html.indexOf('>', titleTagStart);
    const titleTag = html.slice(titleTagStart, titleTagEnd + 1);

    expect(html).not.toContain('data-vc-presentation-glass="evidence"');
    expect(html).toContain('data-vc-presentation-art="luxury"');
    expect(html).not.toContain('data-vc-photo-zone');
    expect(titleTag).not.toContain('backdrop-filter');
    expect(titleTag).not.toContain('background:rgba(255,255,255,0.05)');
  });

  it('usa o piso editorial de autofit sem remover o fallback absoluto', () => {
    expect(presentationAutofitSoftFloor({ presentationAutofit: { minScale: 0.85 } }, 0.45))
      .toBe(0.85);
    expect(presentationAutofitSoftFloor({ presentationAutofit: { enabled: false, minScale: 0.85 } }, 0.45))
      .toBe(0.45);
    expect(presentationAutofitSoftFloor({ presentationAutofit: { minScale: 'inválido' } }, 0.45))
      .toBe(0.45);
  });

  it('ativa piso rígido somente para uma composição oficial do PDS', () => {
    const official = getPresentationCompositionOverrides('presentation_premium_dark', {
      slide: {}, stage: {}, index: 1, count: 6,
    });
    expect(strictPresentationAutofit(official)).toBe(true);
    expect(strictPresentationAutofit({
      ...official,
      presentationPatternId: null,
    })).toBe(false);
    expect(strictPresentationAutofit({
      presentationAutofit: { enabled: true, minScale: 0.85 },
      presentationPatternId: 'pds.premium-dark',
      presentationCompositionId: 'presentation_premium_dark:content',
      canvas: { source: 'manual' },
    })).toBe(false);
  });

  it('não reaplica o inset do editor dentro das caixas já medidas pelo PDS', () => {
    const official = getPresentationCompositionOverrides('presentation_premium_dark', {
      slide: {}, stage: { visualRole: 'demo' }, index: 4, count: 6,
    });
    const frame = { w: 1920, h: 1080 };
    expect(canvasClassicTitlePaddingXPx(frame, official)).toBeCloseTo(11.52, 2);
    expect(canvasClassicTextPaddingYPx(frame, official)).toBeCloseTo(6.48, 2);
    expect(canvasClassicTitlePaddingXPx(frame, {
      ...official,
      textInset: 20,
      canvas: { ...official.canvas, source: 'manual' },
    })).toBeGreaterThan(90);
  });
});
