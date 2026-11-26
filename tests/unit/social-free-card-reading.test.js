import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import * as cardRenderer from '../../src/components/card/SlideCardInner.jsx';
import { nextOverflowScale } from '../../src/components/card/render-primitives.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { wcagContrast } from '../../src/utils/wcag.js';

const render = (fmt, free = true, photo = false) => {
  const brand = { ...DEFAULT_BRAND, bg: '#FFFFFF', accent: '#999999', titleColor: '#111111', subtitleColor: '#767676', textColor: '#767676',
    showHandle: true, handle: '@APOTEOSE_HANDLE', handleAvatar: 'data:image/png;base64,AVATAR',
    cultureHeaderLeft: 'EDITORIAL_MARKER', cultureHeaderYear: 'ANO_MARKER', showPageBadge: true,
    footerBarLeft: 'TOPIC_MARKER|APOTEOSE_MARKER', footerPillText: 'PILL_MARKER', footerPillScale: 50 };
  const slide = { ...mkSlide(2, brand), title: 'Um encontro que fica', subtitle: 'Música e arte.', bodyAfterImage: 'BODY_MARKER **BOLD_MARKER**',
    titleColor: '#111111', subtitleColor: '#767676', textColor: '#767676', bodyAfterSize: 180,
    showHandle: true, ...(photo ? { bgImage: 'data:image/png;base64,PHOTO', imageQuery: 'Photo', overlay: 80 } : {}),
    canvas: { applied: true, enabled: false, source: 'social-preset', variant: 'classic', zones: {
      title: { x: 10, y: 20, w: 80, h: 18 }, subtitle: { x: 10, y: 40, w: 80, h: 28 },
      photo: photo ? { x: 0, y: 0, w: 100, h: 100 } : { x: 0, y: 0, w: 0, h: 0 },
    } },
    ...(free ? { socialFreeDesign: { family: 'minimal', ground: photo ? 'photo' : 'bg', photo: photo ? 'full' : 'none' }, socialCompositionVersion: 4 } : {}),
  };
  return renderToStaticMarkup(React.createElement(SlideCardInner, { slide, fmt, brand, num: 2, total: 3, creativePreset: 'livre', forExport: true }));
};
const openingTag = (html, text) => {
  const position = html.indexOf(text);
  expect(position).toBeGreaterThan(-1);
  return html.slice(html.lastIndexOf('<', position), html.indexOf('>', html.lastIndexOf('<', position)) + 1);
};

describe('Livre social: leitura do apoio e da assinatura da marca', () => {
  it.each(['carrossel', 'quadrado', 'stories'])('não reduz por transparência o contraste calculado do apoio no %s', fmt => {
    expect(openingTag(render(fmt), 'BODY_MARKER')).toContain('opacity:1');
  });

  it.each(['carrossel', 'quadrado', 'stories'])('aplica piso de28px ao cabeçalho, rodapé, handle e selo no %s', fmt => {
    const html = render(fmt);
    for (const marker of ['EDITORIAL_MARKER', 'ANO_MARKER', 'TOPIC_MARKER', 'APOTEOSE_MARKER', 'APOTEOSE_HANDLE', 'PILL_MARKER']) {
      const tag = openingTag(html, marker);
      const size = Number(tag.match(/font-size:([\d.]+)px/)?.[1]);
      expect(size, marker).toBeGreaterThanOrEqual(28);
    }
  });

  it('usa superfície sólida atrás do cabeçalho e rodapé que caem sobre foto', () => {
    const html = render('carrossel', true, true);
    expect(html.match(/data-vc-chrome="headerBar"[^>]+/)?.[0]).toContain('background:#FFFFFF');
    expect(html.match(/data-vc-chrome="footerBar"[^>]+/)?.[0]).toContain('background:#FFFFFF');
    expect(openingTag(html, 'TOPIC_MARKER')).not.toContain('rgba(255,255,255,0.55)');
  });

  it('o destaque dentro do apoio também tem contraste de texto 4,5:1', () => {
    const tag = openingTag(render('carrossel'), 'BOLD_MARKER');
    const color = tag.match(/(?:^|[;" ])color:([^;"]+)/)?.[1];
    expect(color).toBeTruthy();
    expect(wcagContrast(color, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });

  it('o ajuste automático para no piso de28px mesmo quando a caixa continua pequena', () => {
    expect(typeof cardRenderer.socialReadingScaleFloor).toBe('function');
    const slide = { socialFreeDesign: { photo: 'none' } };
    for (const sizes of [[72], [36, 28.05], [32, 30]]) {
      const minScale = cardRenderer.socialReadingScaleFloor(slide, { w: 1080 }, sizes, 0.62);
      let scale = 1;
      for (let i = 0; i < 8; i++) scale = nextOverflowScale({ currentScale: scale,
        clientHeight: 120, contentHeight: 4000, minScale, hardMinScale: 0.45, strictMinScale: true });
      expect(Math.min(...sizes) * scale).toBeGreaterThanOrEqual(28 - 0.001);
    }
  });

  it('liga esse piso rígido nas duas zonas do card gerado', () => {
    expect(render('carrossel')).not.toContain('data-vc-overflow-flag="lowest-floor"');
    expect(render('carrossel', false).match(/data-vc-overflow-flag="lowest-floor"/g)).toHaveLength(2);
  });

  it('mantém opacidade e tamanho anteriores fora do Livre', () => {
    const html = render('carrossel', false);
    expect(openingTag(html, 'BODY_MARKER')).toContain('opacity:0.82');
    expect(openingTag(html, 'EDITORIAL_MARKER')).toContain('font-size:21.6px');
  });
});
