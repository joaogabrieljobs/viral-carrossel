// Apoteose 8 no Livre social, composto como na geração, com a marca das
// capturas de 27/11/2026: logo de 116 px no canto, cabeçalho de duas colunas
// e selo. Medidas em % do formato, como as zonas que o renderer usa.
import fixture from '../fixtures/apoteose-social-free-8.json';
import { DEFAULT_BRAND } from '../../src/utils/doc-schema.js';
import { FORMATS } from '../../src/utils/formats.js';
import { applyFreeSocialDesign } from '../../src/utils/social-free-design.js';
import { socialFreeChromeGeometry } from '../../src/utils/card-chrome.js';
import { resolvePresetChrome } from '../../src/utils/preset-tokens.js';

export { fixture };
export const FORMATOS = ['carrossel', 'quadrado', 'stories'];
export const apoteoseBrand = { ...DEFAULT_BRAND, logo: 'data:image/png;base64,TE9HTw==', logoSize: 116, logoPosition: 'tr', logoOpacity: 100,
  showHandle: false, showPageBadge: false, footerPillText: 'APOTEOSE', footerPillArrow: false,
  cultureHeaderLeft: 'APOTEOSE', cultureHeaderCenter: 'SÃO PAULO', cultureHeaderYear: '' };
const PHOTO = 'data:image/webp;base64,UklGRg==';

export const pct = (px, formato) => px / FORMATS[formato].h * 100;
export const overlapsY = (a0, a1, b0, b1) => Math.min(a1, b1) > Math.max(a0, b0) + 0.01;
export const overlaps = (a, b) => Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) + 0.01 && overlapsY(a.y, a.y + a.h, b.y, b.y + b.h);

export function apoteoseLivre(formato) {
  const source = fixture.response.slides.map((slide, index) => ({ ...structuredClone(slide), id: `apoteose-${index}`,
    ...(fixture.expected.photoCards.includes(index + 1) ? { bgImage: PHOTO, bgImageId: `foto-${index}` } : {}) }));
  const deckDesign = structuredClone(fixture.response.deckDesign);
  const plan = { deckDesign, cards: source.map((slide, index) => ({ index, design: slide.design, scene: slide.scene, eyebrow: slide.eyebrow })) };
  return applyFreeSocialDesign(source, { preset: 'social_free', formato, plan, deckDesign, brand: { ...apoteoseBrand } });
}

/** Faixa do cabeçalho exatamente onde o SlideCardInner a desenha no Livre. */
export function headerRect(slide, formato) {
  const f = FORMATS[formato];
  const g = socialFreeChromeGeometry(resolvePresetChrome(apoteoseBrand), f, formato, slide);
  return { x: g.headerLeftPx / f.w * 100, y: pct(g.headerTopPx, formato),
    w: (f.w - g.headerLeftPx - g.headerRightPx) / f.w * 100, h: pct(g.headerHeightPx, formato) };
}

/** Tudo que é texto no card: zonas, chapéu e texto da família, cabeçalho e selo. */
export function textRects(slide, formato) {
  const z = slide.canvas.zones;
  const g = socialFreeChromeGeometry(resolvePresetChrome(apoteoseBrand), FORMATS[formato], formato, slide);
  const rects = [z.title, z.evidence, String(slide.subtitle || slide.bodyAfterImage || '').trim() ? z.subtitle : null].filter(Boolean);
  for (const d of slide.socialArt.chrome.filter(item => item.t === 'text')) rects.push({ x: d.x, y: d.y, w: d.w || 30, h: pct(d.size * 1.3, formato) });
  rects.push(headerRect(slide, formato));
  rects.push({ x: 30, y: 100 - pct(g.pillBottomPx + g.pillHeight, formato), w: 40, h: pct(g.pillHeight, formato) });
  return rects;
}
