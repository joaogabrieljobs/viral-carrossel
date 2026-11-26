/** Diretor do Livre social. As medidas são sempre as do formato de 1080. */
import {
  SOCIAL_FAMILY_KEYS, SOCIAL_ARCHETYPES, SOCIAL_COMPOSERS, socialCardLayout, socialDevices,
  formatFrame, toTitleSize, toSubSize, toBodySize,
} from './social-families.js';
import { FAMILY_KEYS, PAGE_KINDS, familyLayout } from './presentation-families.js';
import {
  normalizeFreeFamily, normalizeProposedDesign, normalizeSlideDesign, normalizeDeckDesign, deckDesignFromBrand,
  snapDeckDesignToPalette, freeFontSpec, freeTextLines, freeTextWidth, freePaletteOverrides, freeDeckViolations,
  directFreeSlideDesign, freeNeutralChrome, artScrim, FREE_ART_MAX_SLIDES,
} from './free-design.js';
import { assignSocialFunctions } from './social-sequence.js';
import { normalizePresentationBlocks } from './presentation-quality.js';
import { readableInk, minScrimAlpha, scrimSurface } from './social-chrome.js';
import { socialFreeChromeGeometry } from './card-chrome.js';
import { resolvePresetChrome } from './preset-tokens.js';
import { titleTrackingBase } from './title-tracking.js';
import { wcagContrast } from './wcag.js';

export const SOCIAL_FREE_PRESET_ID = 'social_free';
export const SOCIAL_FREE_FAMILY_KEYS = Object.freeze([...SOCIAL_FAMILY_KEYS, ...FAMILY_KEYS]);
export const SOCIAL_FREE_LAYOUT_KEYS = Object.freeze([...SOCIAL_ARCHETYPES, ...PAGE_KINDS]);

export function isFreeSocialPreset(value) {
  return (typeof value === 'string' ? value : value?.id) === SOCIAL_FREE_PRESET_ID;
}

export function isFreeSocialSlide(slide) {
  return !!slide?.socialFreeDesign && typeof slide.socialFreeDesign === 'object';
}

/** Somente enums; conteúdo e adequação à zona são validados na composição. */
export function normalizeSocialFreeDesign(raw, fallback = {}) {
  const source = { ...fallback, ...(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) };
  const key = String(source.family || '').trim().toLowerCase().replace(/^social_/, '');
  const fallbackFamily = SOCIAL_FREE_FAMILY_KEYS.includes(fallback.family) ? fallback.family : 'minimal';
  const family = SOCIAL_FREE_FAMILY_KEYS.includes(key) ? key : normalizeFreeFamily(key, fallbackFamily);
  const shared = normalizeProposedDesign({ ...source, block: source.block === 'list' ? 'steps' : source.block });
  const layout = SOCIAL_FREE_LAYOUT_KEYS.includes(source.layout) ? source.layout : undefined;
  return { ...shared, family, ...(layout ? { layout } : {}) };
}

const FORMATS = Object.freeze({ carrossel: '4:5', quadrado: '1:1', stories: '9:16' });
const BODY_MIN = 28;
const ART_TEXT_END = 72;
const round = n => Math.round(n * 100) / 100;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const box = (x, y, w, h) => ({ x: round(x), y: round(y), w: round(w), h: round(h) });
const copy = s => [s?.subtitle, s?.bodyAfterImage].filter(Boolean).join('\n');
const hasMedia = s => !!(s?.bgImage || s?.bgImageId || s?.bgImageAssetId || s?.videoId);
const hasRequest = s => !!String(s?.imageQuery || '').trim() || !!s?.socialPlan?.scene?.subject;
const overlaps = (a, b) => !!a && !!b && Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) + 0.1
  && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y) + 0.1;

/** Escolhas manuais são protegidas antes de qualquer reset de estilo. */
export function socialFreeSlideLocked(slide) {
  return !!slide?.visualPresetId && slide.visualPresetId !== SOCIAL_FREE_PRESET_ID
    || !!slide?.canvas?.userEdited || slide?.canvas?.enabled === true
    || Object.values(slide?.elementOffsets || {}).some(offset => offset && Object.values(offset).some(n => Number(n) !== 0));
}

function nativeBlocks(slide) {
  return normalizePresentationBlocks(slide.presentationBlocks || slide.socialBlocks);
}

function effectiveDeck(slides, { deckDesign, plan, brand }) {
  const proposed = deckDesign || plan?.deckDesign || slides.find(s => s.socialDeckDesign)?.socialDeckDesign;
  const deck = proposed ? normalizeDeckDesign(proposed) : deckDesignFromBrand(brand || {});
  // O plano costuma chegar ajustado pelo kit. A opção permite consumidores
  // puros passarem as mesmas amostras com peso, sem outra extração/chamada.
  return plan?.referenceColors?.length ? snapDeckDesignToPalette(deck, plan.referenceColors, { explicitBase: plan.explicitBase }) : deck;
}

function cardPlan(plan, slide, index) {
  const cards = Array.isArray(plan?.cards) ? plan.cards : [];
  const card = cards.find(c => c.index === index) || cards[index] || slide.socialPlan || {};
  return { ...slide.socialPlan, ...card, index, kind: 'social_free', socialPresetId: SOCIAL_FREE_PRESET_ID,
    ...(plan?.visualDirection ? { visualDirection: plan.visualDirection } : {}) };
}

function chromeContext(slide, brand = {}) {
  brand = brand || {};
  const chrome = resolvePresetChrome(brand);
  const frames = Object.fromEntries(Object.keys(FORMATS).map(fmt => {
    const F = formatFrame(fmt);
    return [fmt, { ...socialFreeChromeGeometry(chrome, F, fmt, slide), height: F.h }];
  }));
  const footer = Object.fromEntries(Object.entries(frames).map(([fmt, geometry]) => [fmt, geometry.bottomReservePx / geometry.height * 100]));
  const topReserve = Object.fromEntries(Object.entries(frames).map(([fmt, geometry]) => [fmt, geometry.topReservePx / geometry.height * 100]));
  const brandLead = Object.fromEntries(Object.entries(frames).map(([fmt, geometry]) => [fmt, geometry.lead
    ? box(geometry.lead.x / 1080 * 100, geometry.lead.y / geometry.height * 100,
      geometry.lead.w / 1080 * 100, geometry.lead.h / geometry.height * 100) : null]));
  const logo = !slide.logoHidden && (slide.logoImage || slide.logoImageId || brand.logo || brand.logoImageId)
    ? { pos: slide.logoPosition || brand.logoPosition || 'tr', size: Number(slide.logoSize ?? brand.logoSize) || 150, drop: !!brand.showHandle } : null;
  return { footer, logo, topReserve, brandLead };
}

function usefulFrame(formato, context, slide) {
  const F = formatFrame(FORMATS[formato] ? formato : 'carrossel');
  let top = Math.max(F.t, context.topReserve?.[F.key] || 0);
  let bottom = Math.min(100 - F.b, 100 - (context.footer?.[F.key] || 0));
  const logo = context.logo;
  if (!context.topReserve && logo && /^[tb][lr]$/.test(logo.pos)) {
    const margin = F.w * 0.045;
    const gap = 24 / F.h * 100;
    if (logo.pos.startsWith('t')) top = Math.max(top, (margin + logo.size) / F.h * 100 + gap
      + (logo.drop && logo.pos.endsWith('r') ? 5 : 0));
    else bottom = Math.min(bottom, 100 - (margin + logo.size) / F.h * 100 - gap);
  }
  const eyebrow = String(slide.eyebrowText || slide.eyebrow || slide.socialPlan?.eyebrow || '').trim();
  const eyebrowSpace = eyebrow ? (28 * 1.3 + 16) / F.h * 100 : 0;
  const lead = context.brandLead?.[F.key];
  const brandLead = lead ? box(Math.max(F.e, lead.x), lead.y,
    Math.min(100 - F.e, lead.x + lead.w) - Math.max(F.e, lead.x), lead.h) : null;
  return { ...F, top, bottom, eyebrow, eyebrowSpace, contentTop: top + eyebrowSpace, brandLead };
}

/** Arquétipo explícito usa só geometria existente, nunca coordenadas da IA. */
function socialLayout(design, fn, formato, photo, structured, variant) {
  let family = design.family;
  let role = fn;
  let choice = variant;
  if (design.layout && SOCIAL_ARCHETYPES.includes(design.layout)) {
    const found = Object.entries(SOCIAL_COMPOSERS).flatMap(([key, spec]) => Object.entries(spec.pick)
      .flatMap(([kind, names]) => (Array.isArray(names) ? names : [names]).map((name, n) => ({ family: key, fn: kind, variant: n, name }))))
      .find(item => item.name === design.layout && (item.family === family || !SOCIAL_COMPOSERS[family]?.pick[fn]));
    const any = found || Object.entries(SOCIAL_COMPOSERS).flatMap(([key, spec]) => Object.entries(spec.pick)
      .flatMap(([kind, names]) => (Array.isArray(names) ? names : [names]).map((name, n) => ({ family: key, fn: kind, variant: n, name }))))
      .find(item => item.name === design.layout);
    if (any) { family = any.family; role = any.fn; choice = any.variant; }
  }
  return socialCardLayout(family, role, { formato, photo, structured, variant: choice, wide: design.layout === 'wideStack' });
}

function rawLayout(design, slide, fn, formato, variant) {
  const photo = design.photo !== 'none';
  const structured = design.block !== 'none';
  let L;
  if (FAMILY_KEYS.includes(design.family)) {
    const kind = fn === 'cover' ? 'cover' : fn === 'closing' ? 'closing' : structured ? 'data'
      : PAGE_KINDS.includes(design.layout) ? design.layout : fn === 'statement' ? 'divider' : variant % 2 ? 'demo' : 'content';
    const raw = familyLayout(design.family, kind, { format: FORMATS[formato], photo, structured, title: slide.title, reading: copy(slide).length });
    L = { ...raw, archetype: `${design.family}:${kind}`, onPhoto: !!(raw.scrim || raw.inkOnPhoto), supportPx: Math.max(BODY_MIN, raw.bodyPx * 0.84) };
  } else L = socialLayout(design, fn, formato, photo, structured, variant);
  // Uma foto importada nunca fica sem zona só porque a família não tem uma
  // nessa função. A alternativa usa outro arquétipo social existente.
  if (photo && !L.photo) L = { ...socialCardLayout('minimal', 'photo', { formato, photo: true, structured, variant }), chrome: L.chrome };
  if (photo && design.ground === 'photo') {
    const full = socialCardLayout('cinema', 'photo', { formato, photo: true, structured: false });
    L = { ...L, photo: full.photo, title: full.title, subtitle: full.subtitle, scrim: full.scrim, onPhoto: true, archetype: `${L.archetype}:bleed` };
  }
  return L;
}

function words(text) { return String(text || '').replace(/\*\*/g, '').trim().split(/\s+/).filter(Boolean); }
function textLines(value, width, px, font, role) {
  if (!String(value || '').trim()) return 0;
  const lines = freeTextLines(value, Math.max(1, width), px, font, role);
  // freeTextLines mede palavras inteiras. Uma primeira palavra maior que a
  // coluna também precisa de linhas, mesmo sem uma palavra anterior.
  return Math.max(lines, ...words(value).map(word => Math.ceil(freeTextWidth(word, px, font, role) / Math.max(1, width))));
}

function fitLayout(L, slide, design, deck, F) {
  const right = design.ground === 'art' ? ART_TEXT_END : 100 - F.e;
  const clip = raw => {
    const x = clamp(raw?.x ?? F.e, F.e, right - 16);
    const y = clamp(raw?.y ?? F.contentTop, F.contentTop, F.bottom - 2);
    return box(x, y, clamp(raw?.w ?? right - x, 16, right - x), Math.max(1, Math.min(raw?.h || 20, F.bottom - y)));
  };
  let T = clip(L.title), S = clip(L.subtitle);
  let P = L.photo ? { ...L.photo } : null;
  let titlePx = clamp(L.titlePx || 104, 56, ['cover', 'closing'].includes(slide.socialFunction) ? 144 : 120);
  let bodyPx = clamp(L.bodyPx || 38, BODY_MIN, 44);
  let supportPx = clamp(L.supportPx || 32, BODY_MIN, 36);
  const titleLeading = 1.1;
  const width = z => Math.max(40, z.w / 100 * F.w - 64);
  const pct = px => px / F.h * 100;
  const photoTextGap = pct(F.eyebrow ? 28 * 1.3 + 16 + 16 : 24);
  const tNeed = () => textLines(slide.title, width(T), titlePx, deck.fonts.display, 'display') * titlePx * titleLeading + titlePx * 0.44 + 16;
  const sNeed = () => textLines(slide.subtitle, width(S), bodyPx, deck.fonts.text, 'text') * bodyPx * 1.4
    + (String(slide.bodyAfterImage || '').trim() ? textLines(slide.bodyAfterImage, width(S), supportPx, deck.fonts.text, 'text') * supportPx * 1.45 + 16 : 0) + 10;
  const structured = design.block !== 'none';
  // Blocos são um terceiro elemento: título e eventual contexto ficam acima
  // deles, medidos com as fontes de 1080 e sem reduzir células abaixo de 28.
  if (structured) {
    const lead = F.useBrandLead && F.brandLead;
    T = lead ? box(lead.x, lead.y + F.eyebrowSpace, Math.min(lead.w, right - lead.x), 20)
      : box(F.e, F.contentTop, right - F.e, 20);
    S = box(F.e, F.contentTop + 22, right - F.e, 10);
    if (P && !L.onPhoto) {
      // A foto enviada continua visível, mas não compete com a tabela. O
      // cabeçalho usa duas colunas; a evidência começa abaixo de ambas.
      const pw = Math.min(25, (right - F.e) * 0.32);
      P = box(right - pw, F.contentTop, pw, pw * F.w / F.h);
      T.w = S.w = round(P.x - F.e - 24 / F.w * 100);
    }
    titlePx = Math.min(titlePx, 80);
    bodyPx = 30; supportPx = 28;
    const block = nativeBlocks(slide)[0];
    const blockPx = blockHeight(block, (right - F.e) / 100 * F.w, deck);
    const neededEnd = () => Math.max(lead ? F.top : 0, T.y + pct(tNeed())) + pct(sNeed() + blockPx + 48);
    for (let n = 0; n < 20 && neededEnd() > F.bottom && titlePx > 56; n += 1) titlePx = Math.max(56, titlePx - 2);
    T.h = round(pct(tNeed()));
    S.y = round(Math.max(lead ? F.top : 0, T.y + T.h) + pct(16));
    S.h = round(Math.max(1, pct(sNeed())));
    const ey = Math.max(S.y + S.h + pct(String(copy(slide)).trim() ? 24 : 10), P && !L.onPhoto ? P.y + P.h + pct(24) : 0);
    const evidence = box(F.e, ey, right - F.e, Math.max(1, F.bottom - ey));
    return { title: T, subtitle: S, evidence, photo: P, titlePx, bodyPx, supportPx,
      over: blockPx > evidence.h / 100 * F.h, titleLeading, ...(lead ? { eyebrowY: lead.y } : {}) };
  }
  // Coluna estreita que pede uma palavra por linha ganha o empilhado, sem
  // retirar a foto. É uma alternativa de geometria, não redução de texto.
  if (P && !L.onPhoto && T.w < 55 && textLines(slide.title, width(T), titlePx, deck.fonts.display, 'display') > 4) {
    const height = Math.min(32, (F.bottom - F.contentTop) * 0.42);
    P = box(F.e, F.top, right - F.e, height);
    T = box(F.e, P.y + P.h + photoTextGap, right - F.e, 20);
    S = box(F.e, T.y + 22, right - F.e, 20);
  }
  const sameColumn = Math.min(T.x + T.w, S.x + S.w) > Math.max(T.x, S.x) + 1;
  if (sameColumn) {
    let top = Math.max(F.contentTop, Math.min(T.y, S.y));
    const photoAbove = P && !L.onPhoto && overlaps({ ...T, y: P.y, h: P.h }, P) && P.y + P.h <= top + 0.5;
    if (photoAbove) top = Math.max(top, P.y + P.h + photoTextGap);
    const need = () => tNeed() + sNeed() + 24;
    if (need() > (F.bottom - top) / 100 * F.h) {
      if (photoAbove) {
        // Marca e rodapé podem consumir mais altura no Quadrado. O módulo
        // fotográfico pode ficar menor, até 180 px reais, antes de comprometer
        // a leitura; nunca desaparecer nem reduzir o texto abaixo do piso.
        const freed = Math.min(P.h - Math.min(22, pct(180)), pct(need()) - (F.bottom - top));
        if (freed > 0) { P.h = round(P.h - freed); top -= freed; }
      } else if (!P || L.onPhoto) top = Math.max(F.contentTop, Math.min(top, F.bottom - pct(need())));
    }
    for (let n = 0; n < 45 && need() > (F.bottom - top) / 100 * F.h; n += 1) {
      if (titlePx > Math.max(56, bodyPx * 1.6)) titlePx = Math.max(56, titlePx - 2);
      else if (bodyPx > BODY_MIN) { bodyPx -= 1; supportPx = Math.max(BODY_MIN, supportPx - 1); }
      else break;
    }
    const over = need() > (F.bottom - top) / 100 * F.h;
    const room = F.bottom - top;
    const tHeight = Math.min(pct(tNeed()), Math.max(4, room - Math.max(2, pct(sNeed())) - pct(24)));
    T = box(T.x, top, T.w, tHeight);
    S = box(S.x, T.y + T.h + pct(24), S.w, Math.max(1, F.bottom - T.y - T.h - pct(24)));
    return { title: T, subtitle: S, photo: P, titlePx, bodyPx, supportPx, over, titleLeading };
  }
  for (let n = 0; n < 45 && (tNeed() > T.h / 100 * F.h || sNeed() > S.h / 100 * F.h); n += 1) {
    if (tNeed() > T.h / 100 * F.h && titlePx > 56) titlePx = Math.max(56, titlePx - 2);
    if (sNeed() > S.h / 100 * F.h && bodyPx > BODY_MIN) { bodyPx -= 1; supportPx = Math.max(BODY_MIN, supportPx - 1); }
  }
  return { title: T, subtitle: S, photo: P, titlePx, bodyPx, supportPx, over: tNeed() > T.h / 100 * F.h || sNeed() > S.h / 100 * F.h, titleLeading };
}

function blockHeight(block, width, deck) {
  const lines = (value, w, px = 28) => textLines(value, w, px, deck.fonts.text, 'text');
  if (!block) return 0;
  if (block.type === 'comparison') {
    const col = width / block.headers.length - 36;
    return Math.max(...block.headers.map(v => lines(v, col))) * 28 * 1.4 + 30
      + block.rows.reduce((sum, row) => sum + Math.max(...row.map(v => lines(v, col))) * 28 * 1.4 + 28, 0);
  }
  if (block.type === 'quote') return lines(block.text, width - 80, 40) * 40 * 1.18 + 110;
  if (block.type === 'bignumber') return 260 + lines(block.label, width - 80, 36) * 44 + lines(block.detail, width - 80) * 40;
  const items = block.items || [];
  const col = width / Math.min(2, items.length || 1) - 64;
  return Math.ceil(items.length / 2) * Math.max(180, ...items.map(item => 120 + lines(item.title || item.label, col, 32) * 40 + lines(item.body || item.detail, col) * 40));
}

function inksFor(design, deck, onPhoto) {
  const p = deck.palette;
  const bg = p[design.ground] || p.bg;
  if (onPhoto) {
    const ink = '#FFFFFF', muted = '#F5F5F7';
    const min = Math.min(0.9, Math.ceil(minScrimAlpha([ink, muted]) / 0.9 * 100) / 100);
    const surface = scrimSurface(Math.max(0.74, min) * 0.9);
    return { bg: p.bg, ink, muted, accent: readableInk(surface, [p.accent, ink]), surface, scrimMin: min };
  }
  const ink = readableInk(bg, [design.ground === 'inverse' ? p.inverseInk : p.ink, p.inverseInk]);
  const muted = readableInk(bg, [p.muted, ink]);
  const art = design.ground === 'art' ? artScrim(bg, [ink, muted]) : null;
  const surface = art?.surface || bg;
  return { bg, ink, muted, accent: readableInk(surface, [p.accent, ink]), surface, art };
}

function resolvedChrome(raw, fit, F, inks, slide, deck) {
  const eyebrow = F.eyebrow ? { t: 'text', text: '{eyebrow}', requires: 'eyebrow', x: fit.title.x,
    y: round(fit.eyebrowY ?? Math.max(F.top, fit.title.y - (28 * 1.3 + 16) / F.h * 100)), w: fit.title.w,
    size: 28, role: 'body', weight: 600, color: inks.ink, opacity: 1, tracking: 5, z: 'over' } : null;
  const textZones = [fit.title, fit.subtitle, fit.evidence, eyebrow && { ...eyebrow, h: 28 * 1.3 / F.h * 100 }].filter(Boolean);
  const colors = { ink: inks.ink, body: inks.ink, muted: inks.muted, accent: inks.accent, accent2: deck.palette.accent2, bg: inks.bg, ground: inks.bg, surface: inks.bg, rule: inks.muted };
  const chrome = freeNeutralChrome(raw || []).flatMap(d => {
    if (d.t === 'text' && /kicker|eyebrow|subtitle|title/.test(d.text || '')) return [];
    const size = Math.max(28, Number(d.size) || 28);
    const h = d.t === 'text' ? size * 1.3 / F.h * 100 : d.h || (d.d ? d.d * F.w / F.h : 0);
    const r = { x: d.x || 0, y: d.y || 0, w: d.w || d.d || 30, h };
    if (d.t === 'text' && (r.y < F.top || r.y + r.h > F.bottom || textZones.some(z => overlaps(z, r)))) return [];
    if (['rule', 'block', 'circle'].includes(d.t) && textZones.some(z => overlaps(z, r))) return [];
    if (d.t === 'text') textZones.push(r);
    return [{ ...d, color: colors[d.color] || inks.muted, ...(d.t === 'text' ? { size, role: d.role === 'display' ? 'title' : 'body', opacity: 1, z: 'over' } : {}) }];
  });
  if (eyebrow) chrome.push(eyebrow);
  return chrome;
}

function composeSlide(slide, design, { deck, fn, formato, variant = 0, context = {}, index = 0, count = 1 }) {
  const original = { ...slide, socialFunction: fn };
  const F = usefulFrame(formato, context, original);
  let L = rawLayout(design, original, fn, F.key, variant);
  const onPhoto = design.photo !== 'none' && !!(L.onPhoto || L.scrim || L.inkOnPhoto);
  if (onPhoto && design.ground !== 'photo') design = { ...design, ground: 'photo' };
  let fit = fitLayout(L, original, design, deck, F);
  if (fit.over && F.brandLead) {
    const lead = F.brandLead;
    const alternative = design.block !== 'none' ? fitLayout(L, original, design, deck, { ...F, useBrandLead: true })
      : !onPhoto && design.photo !== 'none' && lead.h / 100 * F.h >= 180
        ? fitLayout({ ...L, photo: lead, title: box(F.e, F.contentTop, 100 - 2 * F.e, 20),
          subtitle: box(F.e, F.contentTop + 22, 100 - 2 * F.e, 20) }, original, design, deck, F) : null;
    if (alternative && !alternative.over) fit = alternative;
  }
  const inks = inksFor(design, deck, onPhoto);
  const display = freeFontSpec(deck.fonts.display, 'display');
  const text = freeFontSpec(deck.fonts.text, 'text');
  const rawChrome = SOCIAL_COMPOSERS[design.family]
    ? socialDevices(design.family, fn, { ...L, ...fit, hasSub: !!copy(slide).trim(), subUsed: fit.subtitle.h, titleUsed: fit.title.h }, F.key, { photo: !!fit.photo }) : L.chrome;
  const chrome = resolvedChrome(rawChrome, fit, F, inks, original, deck);
  const socialArt = { family: design.family, fn, variant, index, count, formato: F.key, archetype: L.archetype,
    ground: design.ground, chrome, density: fit.over ? 'over' : 'ok', footer: context.footer || {}, topReserve: context.topReserve || {}, brandLead: context.brandLead || {}, logo: context.logo || null,
    typo: { titleFont: display.css, bodyFont: text.css, titleLeading: Math.round(fit.titleLeading * 100), titleCase: 'normal' },
    textOnPhoto: onPhoto, photoInks: { title: inks.ink, body: inks.ink, accent: inks.accent } };
  socialArt.rhythmKey = [design.ground, L.photo ? [L.photo.x, L.photo.y, L.photo.w, L.photo.h].map(Math.round).join(':') : 'none',
    [L.title.x, L.title.y, L.title.w].map(Math.round).join(':'), [L.subtitle.x, L.subtitle.w].map(Math.round).join(':'), L.align].join('|');
  const zones = { title: fit.title, subtitle: fit.subtitle, photo: fit.photo || box(96, 94, 1, 1), ...(fit.evidence ? { evidence: fit.evidence } : {}) };
  return {
    socialPresetId: SOCIAL_FREE_PRESET_ID, socialVisualPresetId: SOCIAL_FREE_PRESET_ID,
    socialPlan: { ...slide.socialPlan, kind: 'social_free', socialPresetId: SOCIAL_FREE_PRESET_ID, formato: F.key },
    socialFreeDesign: { ...design, layout: L.archetype }, socialDeckDesign: deck, socialArt, socialFunction: fn,
    socialFamily: design.family, socialCompositionVersion: 4, socialComposition: `free:${L.archetype}`,
    socialZoneAnchors: { title: 'start', subtitle: 'start' }, socialFreeTextSurfaces: { title: inks.surface, subtitle: inks.surface },
    customBg: inks.bg, titleColor: inks.ink, subtitleColor: inks.ink, textColor: inks.muted,
    layout: L.align === 'center' ? 'tc' : 'tl', align: L.align || 'left', useCultureLayout: false,
    photoRegion: 'full', photoFraming: slide.photoFraming === 'manual' ? 'manual' : 'auto', bgFit: slide.photoFraming === 'manual' ? slide.bgFit : L.photoFit || 'cover',
    presentationSuppressPhoto: design.photo === 'none', overlay: onPhoto ? 70 : 0, overlayMode: onPhoto ? 'scrim' : null,
    socialScrimMin: onPhoto ? inks.scrimMin : undefined, socialScrimTop: onPhoto ? Math.max(0, Math.min(fit.title.y, fit.subtitle.y, ...chrome.filter(d => d.t === 'text').map(d => d.y)) - 5) : undefined,
    textInset: 0, textShadow: false, textBg: false,
    titleSize: toTitleSize(fit.titlePx), subSize: Math.max(toSubSize(BODY_MIN) + 0.1, toSubSize(fit.bodyPx)), bodyAfterSize: Math.max(toBodySize(BODY_MIN) + 0.1, toBodySize(fit.supportPx)),
    titleLeading: Math.round(fit.titleLeading * 100), subLeading: 140, bodyLeading: 145,
    titleWeight: display.weight, subtitleWeight: text.weight, titleCase: 'normal', subtitleCase: 'normal', subtitleItalic: false,
    titleTracking: -titleTrackingBase(display.css), subTracking: 1, bodyTracking: 0.4,
    textFonts: { ...slide.textFonts, title: display.css, subtitle: text.css, bodyAfterImage: text.css, eyebrow: text.css },
    showSwipeCue: index === 0, eyebrowText: F.eyebrow,
    presentationArtScrim: inks.art || null,
    // Apenas a aparência do bloco nativo; não identifica o produto como apresentação.
    presentationArtDirectionVersion: 2, presentationDesignFamily: FAMILY_KEYS.includes(design.family) ? design.family : 'executive',
    presentationPaletteOverrides: { ...freePaletteOverrides(deck), accent: inks.accent }, presentationBlockAnchor: 'start',
    presentationNumericTypography: { fontFamily: display.css, weight: display.weight },
    canvas: { enabled: false, applied: true, variant: 'classic', source: 'social-preset', preserveZones: true, zones },
  };
}

function geometry(slide) {
  if (slide.socialArt?.rhythmKey) return slide.socialArt.rhythmKey;
  const z = slide.canvas?.zones || {};
  const photo = slide.socialFreeDesign?.photo === 'none' ? null : z.photo;
  return [slide.socialFreeDesign?.ground, photo ? [photo.x, photo.y, photo.w, photo.h].map(Math.round).join(':') : 'none',
    z.title && [z.title.x, z.title.y, z.title.w].map(Math.round).join(':'), z.subtitle && [z.subtitle.x, z.subtitle.w].map(Math.round).join(':'), slide.align].join('|');
}

/** Chamado somente na geração ou na ação explícita de aplicar Livre. */
export function applyFreeSocialDesign(slides, { preset, brand = {}, formato = 'carrossel', narrative = 'editorial', deckDesign, plan } = {}) {
  if (!isFreeSocialPreset(preset) || !Array.isArray(slides) || !slides.length) return slides;
  const deck = effectiveDeck(slides, { deckDesign, plan, brand });
  const assigned = assignSocialFunctions(slides, { narrative });
  const result = [];
  let artCount = 0;
  const hasRequestedArt = slides.some((s, i) => (cardPlan(plan, s, i).design || s.socialFreeDesign)?.ground === 'art' && !hasMedia(s));
  for (const [index, source] of slides.entries()) {
    if (socialFreeSlideLocked(source)) { result.push(source); continue; }
    const socialPlan = cardPlan(plan, source, index);
    const blocks = nativeBlocks(source);
    const slide = { ...source, socialPlan, ...(blocks.length ? { presentationBlocks: blocks } : {}) };
    const proposed = socialPlan.design || source.socialFreeDesign;
    const fallback = proposed ? {} : directFreeSlideDesign({ slide: { ...source, presentationPlan: { purpose: index === slides.length - 1 ? 'decision' : 'other' } },
      index, count: slides.length, previous: result.map(s => ({ ...s, presentationFreeDesign: s.socialFreeDesign })), deckDesign: deck });
    let design = normalizeSocialFreeDesign(proposed, fallback);
    const validated = normalizeSlideDesign(design, slide);
    design = { ...design, block: blocks[0]?.type || 'none', emphasis: validated.emphasis, icons: validated.icons };
    if (hasMedia(slide) && design.photo === 'none') design = { ...design, photo: 'half', ground: design.ground === 'art' ? 'bg' : design.ground };
    if (!hasMedia(slide) && !hasRequest(slide)) design = { ...design, photo: 'none', ground: design.ground === 'photo' ? 'bg' : design.ground };
    if (design.photo !== 'none' && design.ground === 'art') design = { ...design, ground: 'bg' };
    if (!hasRequestedArt && artCount === 0 && index > 0 && design.photo === 'none' && !blocks.length) design = { ...design, ground: 'art' };
    if (design.ground === 'art' && artCount >= FREE_ART_MAX_SLIDES) design = { ...design, ground: 'surface' };
    const fn = index === 0 ? 'cover' : index === slides.length - 1 ? 'closing' : blocks[0]?.type === 'comparison' ? 'comparison' : blocks[0]?.type === 'steps' ? 'list' : assigned[index];
    const context = chromeContext(slide, brand);
    const options = { deck, fn, formato, variant: 0, context, index, count: slides.length };
    let patch = composeSlide(slide, design, options);
    const repeated = result.length >= 2 && geometry(result.at(-1)) === geometry(result.at(-2));
    if (repeated && geometry({ ...slide, ...patch }) === geometry(result.at(-1))) {
      const choices = [{ design: { ...design, layout: undefined }, variant: 1 },
        ...['surface', 'inverse', 'accent', 'bg'].filter(ground => ground !== design.ground).map(ground => ({ design: { ...design, ground, layout: undefined }, variant: 1 }))];
      const alternative = choices.map(c => composeSlide(slide, c.design, { ...options, variant: c.variant })).find(p => geometry({ ...slide, ...p }) !== geometry(result.at(-1)));
      if (alternative) patch = { ...alternative, socialFreeDesignOverride: { reason: 'rhythm_geometry', from: design, to: alternative.socialFreeDesign } };
    }
    if (patch.socialFreeDesign.ground === 'art') artCount += 1;
    const next = { ...slide, ...patch };
    if (!patch.socialFreeDesignOverride) delete next.socialFreeDesignOverride;
    result.push(next);
  }
  return result;
}

/** Vista derivada pura; edições manuais e a vista já gravada não são refeitas. */
export function socialFreeFormatPatch(slide, formato = 'carrossel') {
  if (!isFreeSocialSlide(slide) || socialFreeSlideLocked(slide) || !FORMATS[formato] || slide.socialArt?.formato === formato) return {};
  const art = slide.socialArt || {};
  return composeSlide(slide, slide.socialFreeDesign, { deck: normalizeDeckDesign(slide.socialDeckDesign), fn: art.fn || slide.socialFunction || 'development',
    formato, variant: art.variant || 0, context: { footer: art.footer, logo: art.logo, topReserve: art.topReserve, brandLead: art.brandLead }, index: art.index || 0, count: art.count || 1 });
}

/** Ação explícita de inserir mídia. `requested` prepara só o snapshot do pedido
 * individual, antes dos bytes; não altera a escolha usada pelo lote ou boot. */
export function socialFreePhotoPatch(slide, { requested = false } = {}) {
  if (!isFreeSocialSlide(slide) || (!hasMedia(slide) && requested !== true) || slide.socialFreeDesign.photo !== 'none') return {};
  const art = slide.socialArt || {};
  const design = { ...slide.socialFreeDesign, photo: 'half', ground: slide.socialFreeDesign.ground === 'art' ? 'bg' : slide.socialFreeDesign.ground };
  if (socialFreeSlideLocked(slide)) return manualPhotoPatch(slide, design);
  return composeSlide(slide, design, { deck: normalizeDeckDesign(slide.socialDeckDesign), fn: art.fn || slide.socialFunction || 'development',
    formato: art.formato || slide.socialPlan?.formato || 'carrossel', variant: art.variant || 0,
    context: { footer: art.footer, logo: art.logo, topReserve: art.topReserve, brandLead: art.brandLead }, index: art.index || 0, count: art.count || 1 });
}

function manualOccupiedZones(slide, F) {
  const zones = slide.canvas?.zones || {};
  const offset = key => ({ x: Number(slide.elementOffsets?.[key]?.x) || 0, y: Number(slide.elementOffsets?.[key]?.y) || 0 });
  const content = { title: slide.title, subtitle: copy(slide), evidence: nativeBlocks(slide).length };
  const text = Object.entries(content).flatMap(([key, value]) => {
    const z = zones[key], o = offset(key);
    return value && z ? [{ ...z, x: z.x + o.x, y: z.y + o.y }] : [];
  });
  return [...text, ...(slide.socialArt?.chrome || []).filter(d => d.t === 'text').map(d => ({
    x: d.x, y: d.y, w: d.w || 30, h: (d.size || 28) * 1.3 / F.h * 100,
  }))];
}

/** Maior retângulo livre entre as bordas das zonas; só usado após upload. */
function emptyPhotoZone(occupied, F) {
  const gx = 24 / F.w * 100, gy = 24 / F.h * 100;
  const blocked = occupied.map(r => ({ x: Math.max(F.e, r.x - gx), y: Math.max(F.top, r.y - gy),
    right: Math.min(100 - F.e, r.x + r.w + gx), bottom: Math.min(F.bottom, r.y + r.h + gy) }))
    .filter(r => r.right > r.x && r.bottom > r.y);
  const xs = [...new Set([F.e, 100 - F.e, ...blocked.flatMap(r => [r.x, r.right])])].sort((a, b) => a - b);
  let best = null;
  for (let i = 0; i < xs.length; i += 1) for (let j = i + 1; j < xs.length; j += 1) {
    const x = xs[i], w = xs[j] - x;
    if (w / 100 * F.w < 180) continue;
    const bands = blocked.filter(r => r.x < xs[j] && r.right > x).sort((a, b) => a.y - b.y);
    let top = F.top;
    for (const band of [...bands, { y: F.bottom, bottom: F.bottom }]) {
      const h = band.y - top;
      if (h / 100 * F.h >= 180 && (!best || w * h > best.w * best.h)) best = box(x, top, w, h);
      top = Math.max(top, band.bottom);
    }
  }
  return best;
}

function manualPhotoPatch(slide, proposed) {
  const art = slide.socialArt || {};
  const deck = normalizeDeckDesign(slide.socialDeckDesign);
  const F = usefulFrame(art.formato || slide.socialPlan?.formato || 'carrossel', { footer: art.footer, logo: art.logo, topReserve: art.topReserve, brandLead: art.brandLead }, slide);
  const zones = slide.canvas?.zones || {};
  const occupied = manualOccupiedZones(slide, F);
  const hasZone = zones.photo?.w > 2 && zones.photo?.h > 2;
  const photo = hasZone ? zones.photo : emptyPhotoZone(occupied, F) || box(0, 0, 100, 100);
  const onPhoto = occupied.some(z => overlaps(z, photo));
  const design = { ...proposed, photo: photo.w * photo.h >= 7000 ? 'full' : photo.w * photo.h < 2400 ? 'small' : 'half',
    ...(onPhoto ? { ground: 'photo' } : {}) };
  const inks = onPhoto ? inksFor(design, deck, true) : null;
  const chrome = inks ? (art.chrome || []).map(d => d.t === 'text' ? { ...d, color: inks.ink, opacity: 1, z: 'over' } : d) : art.chrome;
  // Uma zona manual pode cobrir só parte do fundo. A tinta clara protegida
  // na foto também precisa ler nas partes sólidas que ficam ao lado dela.
  const bg = inks && [slide.customBg, deck.palette.bg, deck.palette.inverse, deck.palette.ink, inks.surface]
    .find(color => [inks.ink, inks.muted].every(ink => wcagContrast(ink, color) >= 4.5));
  const socialArt = { ...art, ground: design.ground, textOnPhoto: onPhoto, chrome,
    ...(inks ? { photoInks: { title: inks.ink, body: inks.ink, accent: inks.accent } } : {}) };
  delete socialArt.rhythmKey;
  return { socialFreeDesign: design, socialArt, presentationSuppressPhoto: false, presentationArtScrim: null,
    canvas: hasZone ? slide.canvas : { ...slide.canvas, zones: { ...zones, photo } },
    ...(inks ? { customBg: bg, titleColor: inks.ink, subtitleColor: inks.ink, textColor: inks.muted,
      presentationPaletteOverrides: { ...slide.presentationPaletteOverrides, accent: inks.accent },
      socialFreeTextSurfaces: { title: inks.surface, subtitle: inks.surface }, overlay: 70, overlayMode: 'scrim',
      socialScrimMin: inks.scrimMin, socialScrimTop: 0 } : {}) };
}

/** Reaproveita as guardas de cor/arte sem impor papéis de apresentação ao social. */
export function socialFreeDeckViolations(slides = [], { formato } = {}) {
  const list = Array.isArray(slides) ? slides : [];
  const out = [];
  const own = list.filter(isFreeSocialSlide);
  const shared = freeDeckViolations(own.map(s => ({ ...s, presentationFreeDesign: s.socialFreeDesign,
    presentationFreeTextSurfaces: s.socialFreeTextSurfaces, presentationComposition: s.socialFunction })));
  out.push(...shared.filter(v => ['free_contrast', 'free_art_limit'].includes(v.code)).map(v => ({ ...v, code: v.code.replace(/^free_/, 'social_free_'),
    slideIndex: v.slideIndex == null ? null : list.indexOf(own[v.slideIndex]) })));
  list.forEach((s, i) => {
    if (!isFreeSocialSlide(s)) return;
    if (i >= 2 && isFreeSocialSlide(list[i - 1]) && isFreeSocialSlide(list[i - 2]) && geometry(s) === geometry(list[i - 1]) && geometry(s) === geometry(list[i - 2])) out.push({ code: 'social_free_rhythm_geometry', slideIndex: i });
    const F = formatFrame(formato || s.socialArt?.formato || 'carrossel');
    const bottom = Math.min(100 - F.b, 100 - (s.socialArt?.footer?.[F.key] || 0));
    for (const key of ['title', 'subtitle', 'evidence']) {
      const z = s.canvas?.zones?.[key];
      if (z && (z.y < F.t - 0.02 || z.y + z.h > bottom + 0.02 || z.x < 0 || z.x + z.w > 100.02 || z.h <= 0)) out.push({ code: 'social_free_safe_zone', slideIndex: i, field: key });
    }
    if (s.titleSize * 1080 * 0.084 / 100 < BODY_MIN || s.subSize * 1080 * 0.028 / 100 < BODY_MIN || s.bodyAfterSize * 1080 * 0.018 / 100 < BODY_MIN) out.push({ code: 'social_free_reading_floor', slideIndex: i });
    if (i === 0 && words(s.title).length > 8) out.push({ code: 'social_free_cover_words', slideIndex: i });
    if (i === list.length - 1 && ![s.title, s.subtitle, s.bodyAfterImage].some(t => String(t || '').trim())) out.push({ code: 'social_free_closing_empty', slideIndex: i });
    if (s.socialArt?.density === 'over') out.push({ code: 'social_free_text_overflow', slideIndex: i });
  });
  return out;
}
