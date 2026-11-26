import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { FORMATS } from '../../src/utils/formats.js';
import { applyFreeSocialDesign } from '../../src/utils/social-free-design.js';
import fixture from '../fixtures/apoteose-social-free-8.json';

const safe = { carrossel: [0.085, 0.085], quadrado: [0.09, 0.09], stories: [0.14, 0.18] };
const brandBase = { ...DEFAULT_BRAND, logo: 'data:image/png;base64,LOGO', logoSize: 260, logoPosition: 'tr',
  cultureHeaderLeft: 'APOTEOSE', cultureHeaderCenter: 'SÃO PAULO', cultureHeaderYear: '', showPageBadge: true,
  showHandle: true, handle: '@SAFE_HANDLE', handleAvatar: 'data:image/png;base64,AVATAR',
  footerPillText: 'APOTEOSE', footerPillArrow: false };
function render(formato, { free = true, brand = {}, slide = {} } = {}) {
  const identity = { ...brandBase, ...brand };
  const card = { ...mkSlide(1, identity), title: 'Uma ideia que aproxima pessoas', subtitle: 'Um encontro sem pressa.',
    showHandle: true, socialCompositionVersion: 4,
    canvas: { applied: true, enabled: false, variant: 'classic', source: 'social-preset', zones: {
      title: { x: 8, y: 40, w: 84, h: 20 }, subtitle: { x: 8, y: 65, w: 84, h: 10 }, photo: { x: 96, y: 94, w: 1, h: 1 },
    } }, ...(free ? { socialFreeDesign: { family: 'minimal', ground: 'bg', photo: 'none' } } : {}), ...slide };
  return renderToStaticMarkup(React.createElement(SlideCardInner, { slide: card, fmt: formato, brand: identity,
    num: 1, total: 3, creativePreset: 'livre', forExport: true }));
}
const styleOf = (html, attribute) => {
  const tag = html.match(new RegExp(`<div[^>]*${attribute}[^>]*>`))?.[0];
  expect(tag, attribute).toBeTruthy();
  return tag.match(/style="([^"]+)"/)?.[1] || '';
};
const px = (style, key) => Number(style.match(new RegExp(`(?:^|;)${key}:([\\d.]+)px`))?.[1]);

describe('Livre social: assinatura inteira dentro das zonas seguras', () => {
  it.each(Object.keys(safe))('%s: selo, barra e pilha respeitam a margem inferior', fmt => {
    const limit = FORMATS[fmt].h * safe[fmt][1];
    expect(px(styleOf(render(fmt), 'data-vc-chrome="pill"'), 'bottom')).toBeGreaterThanOrEqual(limit);
    expect(px(styleOf(render(fmt, { brand: { footerPillText: '', footerBarLeft: 'TEMA|MARCA' } }), 'data-vc-chrome="footerBar"'), 'bottom')).toBeGreaterThanOrEqual(limit);
    expect(px(styleOf(render(fmt, { brand: { footerBarLeft: 'TEMA|MARCA' } }), 'data-vc-chrome-stack="footer"'), 'bottom')).toBeGreaterThanOrEqual(limit);
  });

  it.each(Object.keys(safe))('%s: cabeçalho, handle, contador e logo começam abaixo da faixa segura', fmt => {
    const html = render(fmt), limit = FORMATS[fmt].h * safe[fmt][0];
    for (const marker of ['data-vc-chrome="headerBar"', 'data-vc-chrome="pageBadge"', 'data-vc-chrome="handleBadge"', 'data-vc-logo-visible-rect=']) {
      expect(px(styleOf(html, marker), 'top'), marker).toBeGreaterThanOrEqual(limit);
    }
    const logo = styleOf(html, 'data-vc-logo-visible-rect=');
    const header = styleOf(html, 'data-vc-chrome="headerBar"');
    const badge = styleOf(html, 'data-vc-chrome="pageBadge"');
    expect(px(header, 'right')).toBeGreaterThan(px(logo, 'right') + px(logo, 'width'));
    expect(px(badge, 'right')).toBeGreaterThan(px(logo, 'right') + px(logo, 'width'));
  });

  it('o chrome dos estilos existentes mantém as posições anteriores', () => {
    const html = render('quadrado', { free: false });
    expect(px(styleOf(html, 'data-vc-chrome="pill"'), 'bottom')).toBeCloseTo(1080 * 0.058);
    expect(px(styleOf(html, 'data-vc-chrome="headerBar"'), 'top')).toBeCloseTo(1080 * 0.028);
    expect(px(styleOf(html, 'data-vc-logo-visible-rect='), 'top')).toBeCloseTo(1080 * 0.045 + 1080 * 0.05);
  });

  it.each(Object.keys(safe))('%s: o diretor reserva o mesmo chrome sem reduzir texto abaixo do piso', fmt => {
    const source = fixture.response.slides.map((slide, index) => ({ ...structuredClone(slide), id: `chrome-${index}` }));
    const plan = { deckDesign: fixture.response.deckDesign, cards: source.map((slide, index) => ({ index, design: slide.design, scene: slide.scene, eyebrow: slide.eyebrow })) };
    const brand = { ...brandBase, showHandle: false, showPageBadge: false };
    const slides = applyFreeSocialDesign(source, { preset: 'social_free', brand, formato: fmt, plan });
    const f = FORMATS[fmt], logo = { x: 100 - 4.5 - 260 / f.w * 100, y: safe[fmt][0] * 100, w: 260 / f.w * 100, h: 260 / f.h * 100 };
    const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    for (const slide of slides) {
      for (const key of ['title', 'subtitle', 'evidence']) {
        const zone = slide.canvas.zones[key];
        if (zone) expect(overlaps(zone, logo), `${slide.title}: ${key}/logo`).toBe(false);
      }
      const textChrome = slide.socialArt.chrome.filter(item => item.t === 'text')
        .map(item => ({ ...item, h: item.size * 1.3 / f.h * 100 }));
      for (const [index, item] of textChrome.entries()) for (const other of textChrome.slice(index + 1)) {
        expect(overlaps(item, other), `${slide.title}: ${item.text}/${other.text}`).toBe(false);
      }
      expect(slide.subSize * 1080 * 0.028 / 100).toBeGreaterThanOrEqual(28);
      expect(slide.socialArt.density, slide.title).toBe('ok');
      if (slide.socialFreeDesign.photo !== 'none' && !slide.socialArt.textOnPhoto) {
        expect(slide.canvas.zones.photo.h * f.h / 100, slide.title).toBeGreaterThanOrEqual(180 - 0.1);
        if (fmt === 'quadrado') expect(overlaps(slide.canvas.zones.photo, logo), `${slide.title}: photo/logo`).toBe(false);
      }
      const html = render(fmt, { brand, slide });
      const pillBottom = px(styleOf(html, 'data-vc-chrome="pill"'), 'bottom');
      // O selo tem fonte de28px e padding vertical de2,4% da altura.
      const pillTopPct = (f.h - pillBottom - (28.08 * 1.25 + f.h * 0.024)) / f.h * 100;
      expect(slide.canvas.zones.subtitle.y + slide.canvas.zones.subtitle.h).toBeLessThan(pillTopPct);
    }
  });
});
