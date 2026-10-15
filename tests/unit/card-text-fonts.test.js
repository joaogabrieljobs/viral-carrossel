import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getTextFont, normalizeTextFont, textFontPatch, resolveSlideTextFonts, applyTextFontToAllCards } from '../../src/utils/card-text-fonts.js';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, ensureDocShape, mkSlide } from '../../src/utils/doc-schema.js';
import {
  DEFAULT_CANVAS_ZONES_CLASSIC,
  DEFAULT_CANVAS_ZONES_SANDWICH,
  DEFAULT_CANVAS_ZONES_STAT,
} from '../../src/utils/canvas-layout.js';

const brand = {
  ...DEFAULT_BRAND,
  titleFont: 'BrandTitle, serif', bodyFont: 'BrandBody, sans-serif', subtitleFont: 'BrandSubtitle, sans-serif',
  showHandle: true, handle: '@HANDLE_MARKER', subtitleVisible: true,
  cultureHeaderLeft: 'HEADER_MARKER', cultureHeaderYear: '2026', showPageBadge: true,
  footerBarLeft: 'FOOTER_MARKER|FOOTER_VALUE_MARKER', footerPillText: 'PILL_MARKER',
};
const textFonts = {
  title: 'TitleChoice, serif', subtitle: 'SubtitleChoice, sans-serif', bodyAfterImage: 'BodyChoice, serif',
  eyebrow: 'EyebrowChoice, sans-serif', offer: 'OfferChoice, serif', headerBar: 'HeaderChoice, monospace',
  pageBadge: 'PageChoice, monospace', handleBadge: 'HandleChoice, serif', pill: 'PillChoice, sans-serif',
  footerBar: 'FooterChoice, monospace',
};
function makeSlide(overrides = {}) {
  return {
    ...mkSlide(1, brand), title: 'TITLE_MARKER', subtitle: 'SUBTITLE_MARKER', bodyAfterImage: 'BODY_MARKER',
    eyebrowText: 'EYEBROW_MARKER', afterTitleText: 'OFFER_MARKER', strikethroughText: 'OLD_OFFER_MARKER',
    textFonts, ...overrides,
  };
}
function render(slide, forExport = false, customBrand = brand) {
  return renderToStaticMarkup(React.createElement(SlideCardInner, {
    slide, brand: customBrand, fmt: 'apresentacao', num: 1, total: 2,
    forExport, movableElements: true, onElementOffsetChange: () => {},
  }));
}
// Lê a família efetiva no texto, incluindo a herança em ofertas e destaques.
function fontAtText(html, marker) {
  const textMatch = new RegExp(`>[^<]*${marker}`).exec(html);
  const index = textMatch ? textMatch.index + 1 : -1;
  expect(index, `${marker} precisa aparecer no card`).toBeGreaterThan(-1);
  const stack = [];
  const tags = html.slice(0, index).matchAll(/<(\/?)([\w-]+)([^>]*)>/g);
  for (const [, closing, tag, attrs] of tags) {
    if (closing) {
      const last = stack.map((item) => item.tag).lastIndexOf(tag);
      if (last >= 0) stack.length = last;
    } else if (!['img', 'input', 'br', 'hr', 'meta', 'link'].includes(tag)) {
      const style = attrs.match(/style="([^"]*)"/)?.[1]?.replaceAll('&quot;', '"');
      const family = style?.match(/(?:^|;)font-family:([^;]+)/)?.[1];
      stack.push({ tag, family: family || stack.at(-1)?.family });
      if (attrs.endsWith('/')) stack.pop();
    }
  }
  return stack.at(-1)?.family;
}

describe('fontes individuais do card', () => {
  it('aplicar em todos altera só títulos, inclusive onde havia fonte antiga, e preserva os demais textos', () => {
    const first = { id: 'a', textFonts: { title: 'Antiga', subtitle: 'Sub A' } };
    const second = { id: 'b', textFonts: { title: 'Outra', subtitle: 'Sub B' } };
    const updated = applyTextFontToAllCards([first, second], 'a', 'title', '"Spectral", serif');
    expect(updated.map(slide => slide.textFonts)).toEqual([
      { title: '"Spectral", serif', subtitle: 'Sub A' },
      { title: '"Spectral", serif', subtitle: 'Sub B' },
    ]);
    expect(first.textFonts.title).toBe('Antiga');
    expect(second.textFonts.title).toBe('Outra');
    expect(applyTextFontToAllCards(updated, 'a', 'title', '')[1].textFonts).toEqual({ subtitle: 'Sub B' });
  });

  it('aplicar em todos encontra a área extra correspondente sem criar textos em cards vazios', () => {
    const slides = [
      { id: 'a', overlays: [
        { id: 'a1', type: 'text', fontFamily: 'Antes' },
        { id: 'ac', type: 'cta', fontFamily: 'Chamada' },
        { id: 'a2', type: 'text', fontFamily: 'Escolhida' },
      ] },
      { id: 'b', overlays: [
        { id: 'b1', type: 'text', fontFamily: 'Primeira' },
        { id: 'bc', type: 'cta', fontFamily: 'Outra chamada' },
        { id: 'b2', type: 'text', fontFamily: 'Segunda' },
      ] },
      { id: 'c', overlays: [] },
    ];
    const updated = applyTextFontToAllCards(slides, 'a', 'ov_a2', '"Outfit", sans-serif');
    expect(updated[1].overlays.map(overlay => overlay.fontFamily)).toEqual([
      'Primeira', 'Outra chamada', '"Outfit", sans-serif',
    ]);
    expect(updated[2]).toBe(slides[2]);
    expect(updated[0].overlays[0].fontFamily).toBe('Antes');
    expect(slides[1].overlays[2].fontFamily).toBe('Segunda');
  });
  it('usa reserva ao remover arquivo importado sem perder a escolha nem mascarar falha de arquivo existente', () => {
    const family = 'VCBrandTitle-marca, Georgia, serif';
    const slide = { textFonts: { title: family }, overlays: [{ type: 'text', fontFamily: family }] };
    const removed = resolveSlideTextFonts(slide, { id: 'marca' });
    expect(removed.textFonts.title).toBe('Georgia, serif');
    expect(removed.overlays[0].fontFamily).toBe('Georgia, serif');
    expect(slide.textFonts.title).toBe(family);
    expect(resolveSlideTextFonts(slide, { id: 'marca', customTitleFont: { dataUrl: 'data:font/woff2;base64,invalid', format: 'woff2' } })).toBe(slide);
  });
  it('muda só o slot escolhido sem alterar o slide, a marca ou outra escolha', () => {
    const slide = makeSlide({ textFonts: { title: 'Georgia, serif', subtitle: 'Arial, sans-serif' } });
    const patch = textFontPatch(slide, 'subtitle', '  "Playfair Display", serif  ');
    expect(patch.textFonts).toEqual({ title: 'Georgia, serif', subtitle: '"Playfair Display", serif' });
    expect(slide.textFonts.subtitle).toBe('Arial, sans-serif');
    expect(brand.subtitleFont).toBe('BrandSubtitle, sans-serif');
    expect(getTextFont({ ...slide, ...patch }, 'title', brand.titleFont)).toBe('Georgia, serif');
  });

  it('voltar ao estilo remove só o override e recupera o fallback recebido', () => {
    const slide = makeSlide();
    const next = { ...slide, ...textFontPatch(slide, 'subtitle', '') };
    expect(next.textFonts).not.toHaveProperty('subtitle');
    expect(next.textFonts.title).toBe(textFonts.title);
    expect(getTextFont(next, 'subtitle', brand.subtitleFont)).toBe(brand.subtitleFont);
  });

  it('aceita fontes importadas e rejeita valores inválidos ou declarações CSS', () => {
    expect(normalizeTextFont('VCBrandTitle-marca, "Inter", sans-serif')).toBe('VCBrandTitle-marca, "Inter", sans-serif');
    for (const value of [null, 4, {}, ['Arial'], 'x'.repeat(301), 'Arial; color:red', 'Arial\nserif']) {
      expect(normalizeTextFont(value)).toBe('');
      expect(getTextFont({ textFonts: { title: value } }, 'title', 'Fallback')).toBe('Fallback');
    }
    expect(textFontPatch({}, '__proto__', 'Arial')).toEqual({ textFonts: {} });
  });

  it('preserva escolhas por card ao serializar e reabrir documentos antigos e novos', () => {
    const saved = JSON.parse(JSON.stringify({ brand, slides: [makeSlide(), mkSlide(2, brand)] }));
    const restored = ensureDocShape(saved);
    expect(restored.slides[0].textFonts).toEqual(textFonts);
    expect(restored.slides[1].textFonts).toBeUndefined();
    expect(fontAtText(render(restored.slides[0]), 'TITLE_MARKER')).toBe(textFonts.title);
    expect(fontAtText(render(makeSlide({ textFonts: undefined })), 'TITLE_MARKER')).toBe(brand.titleFont);
  });
});

const layouts = [
  ['clássico fluido', {}],
  ['foto em faixa', { photoRegion: 'inset_h_top' }],
  ['canvas clássico', { canvas: { applied: true, variant: 'classic', zones: DEFAULT_CANVAS_ZONES_CLASSIC } }],
  ['Cultura fluido', { useCultureLayout: true }],
  ['Cultura canvas sem foto', { useCultureLayout: true, canvas: { applied: true, variant: 'stat', zones: DEFAULT_CANVAS_ZONES_STAT } }],
  ['Cultura canvas com foto', { useCultureLayout: true, bgImageId: 'foto-pendente', canvas: { applied: true, variant: 'sandwich', zones: DEFAULT_CANVAS_ZONES_SANDWICH } }],
];

describe.each([['preview', false], ['exportação', true]])('fontes na %s', (_mode, forExport) => {
  it.each(layouts)('respeita título, subtítulo e corpo independentes em %s', (_label, overrides) => {
    const html = render(makeSlide(overrides), forExport);
    expect(fontAtText(html, 'TITLE_MARKER')).toBe(textFonts.title);
    expect(fontAtText(html, 'SUBTITLE_MARKER')).toBe(textFonts.subtitle);
    expect(fontAtText(html, 'BODY_MARKER')).toBe(textFonts.bodyAfterImage);
    // A faixa clássica só desenha cabeçalho/contador quando usa o estilo Cultura.
    if (overrides.photoRegion !== 'inset_h_top') {
      expect(fontAtText(html, 'HEADER_MARKER')).toBe(textFonts.headerBar);
      expect(fontAtText(html, '1/2')).toBe(textFonts.pageBadge);
    }
    expect(fontAtText(html, 'FOOTER_MARKER')).toBe(textFonts.footerBar);
    expect(fontAtText(html, 'PILL_MARKER')).toBe(textFonts.pill);
    // A variante Cultura canvas não desenha badge de perfil (comportamento legado).
    if (html.includes('@HANDLE_MARKER')) expect(fontAtText(html, '@HANDLE_MARKER')).toBe(textFonts.handleBadge);
  });

  it('aplica cabeçalho, contador e assinatura na foto em faixa com estilo Cultura', () => {
    const html = render(makeSlide({ photoRegion: 'inset_h_top', bodyAfterImage: '', useCultureLayout: true }), forExport);
    expect(fontAtText(html, 'TITLE_MARKER')).toBe(textFonts.title);
    expect(fontAtText(html, 'SUBTITLE_MARKER')).toBe(textFonts.subtitle);
    expect(fontAtText(html, 'HEADER_MARKER')).toBe(textFonts.headerBar);
    expect(fontAtText(html, '1/2')).toBe(textFonts.pageBadge);
    expect(fontAtText(html, '@HANDLE_MARKER')).toBe(textFonts.handleBadge);
  });

  it('mantém fontes próprias para sobrancelha, oferta, texto livre e CTA', () => {
    const html = render(makeSlide({ overlays: [
      { id: 'free', type: 'text', text: 'FREE_MARKER', fontFamily: 'FreeChoice, serif' },
      { id: 'cta', type: 'cta', text: 'CTA_MARKER', fontFamily: 'CTAChoice, sans-serif' },
    ] }), forExport);
    expect(fontAtText(html, 'EYEBROW_MARKER')).toBe(textFonts.eyebrow);
    expect(fontAtText(html, 'OFFER_MARKER')).toBe(textFonts.offer);
    expect(fontAtText(html, 'OLD_OFFER_MARKER')).toBe(textFonts.offer);
    expect(fontAtText(html, 'FREE_MARKER')).toBe('FreeChoice, serif');
    expect(fontAtText(html, 'CTA_MARKER')).toBe('CTAChoice, sans-serif');
  });

  it('a fonte individual tem prioridade sobre o token da apresentação; remover restaura o token', () => {
    const slide = makeSlide({
      canvas: { applied: true, variant: 'classic', zones: DEFAULT_CANVAS_ZONES_CLASSIC },
      presentationComposition: 'cover',
      presentationTypographyByComposition: { cover: {
        title: { fontFamily: 'PresentationTitle, serif' },
        subtitle: { fontFamily: 'PresentationSubtitle, sans-serif' },
      } },
    });
    const html = render(slide, forExport);
    expect(fontAtText(html, 'TITLE_MARKER')).toBe(textFonts.title);
    expect(fontAtText(html, 'SUBTITLE_MARKER')).toBe(textFonts.subtitle);
    const inherited = render({ ...slide, textFonts: {} }, forExport);
    expect(fontAtText(inherited, 'TITLE_MARKER')).toBe('PresentationTitle, serif');
    expect(fontAtText(inherited, 'SUBTITLE_MARKER')).toBe('PresentationSubtitle, sans-serif');
  });

  it('alterar apenas o título não muda oferta, subtítulo, assinatura ou overlays sem escolha própria', () => {
    const html = render(makeSlide({
      textFonts: { title: 'NewTitle, serif' },
      overlays: [{ id: 'inherited', type: 'text', text: 'FREE_MARKER' }],
    }), forExport);
    expect(fontAtText(html, 'TITLE_MARKER')).toBe('NewTitle, serif');
    expect(fontAtText(html, 'SUBTITLE_MARKER')).toBe(brand.subtitleFont);
    expect(fontAtText(html, 'OFFER_MARKER')).toBe(brand.titleFont);
    expect(fontAtText(html, 'FREE_MARKER')).toBe(brand.bodyFont);
    expect(fontAtText(html, 'PILL_MARKER')).toBe(brand.bodyFont);
  });
});
