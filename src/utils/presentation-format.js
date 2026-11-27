import { FORMATS } from './formats.js';
import { normalizePresentationBlocks } from './presentation-quality.js';
import { FORMAT_SPECS, familyFont, familyLayout, familySpec, normalizeFamilyKey, rendererSubtitleSizePercent } from './presentation-families.js';
import { familyPresentationFields } from './presentation-composition.js';
import { freeTextLines } from './free-design.js';

/** Piso de leitura do apoio e do corpo em Feed, Quadrado e Stories (px a 1080). */
export const SOCIAL_READING_FLOOR_PX = 28;

const SOCIAL_FORMAT = { carrossel: '4:5', quadrado: '1:1', stories: '9:16' };
// Limites verticais do texto (% da altura). Stories: entre as faixas da
// interface do Instagram (14% a 82%), como em `socialSafeArea`.
const READING_TOP = { '4:5': 6, '1:1': 6, '9:16': 14 };
const READING_BOTTOM = { '4:5': 94, '1:1': 94, '9:16': 82 };
const STACK_GAP = { '4:5': 2.6, '1:1': 2.6, '9:16': 2.6 };
// Foto menor que isto deixa de ser foto e vira faixa; sai da página.
const MIN_PHOTO_H = { '4:5': 16, '1:1': 18, '9:16': 12 };

const isBleed = (r) => r && r.x === 0 && r.y === 0 && r.w === 100 && r.h === 100;
const spanX = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
const round2 = (v) => Math.round(v * 100) / 100;

/**
 * Altura (% da página) que apoio e corpo ocupam na zona `zone` no menor
 * tamanho que o renderer permite (piso de 28 px). Métricas da fonte da
 * família, com o mesmo respiro (padding) que a zona desenha.
 */
function readingHeightPct(zone, { family, format, subPx, bodyPx, subtitle, body }) {
  const { w, h } = FORMAT_SPECS[format];
  const width = zone.w / 100 * w * 0.96 - 24;
  const font = familyFont(family, 'text').family;
  const leading = familySpec(family).type.bodyLeading;
  const sizes = [subtitle ? subPx : null, body ? bodyPx : null].filter(Boolean);
  if (!sizes.length) return 0;
  const scale = Math.min(1, SOCIAL_READING_FLOOR_PX / Math.min(...sizes));
  const block = (text, px) => freeTextLines(text, width, px * scale, font, 'text') * px * scale * leading;
  const px = (subtitle ? block(subtitle, subPx) : 0) + (body ? block(body, bodyPx) : 0);
  // Margem do corpo (1,8% da altura), respiro da zona (0,6% em cima e em
  // baixo) e 4% de folga de arredondamento das linhas.
  return (px * 1.04 + (subtitle && body ? h * 0.018 : 0) + h * 0.012 + 6) / h * 100;
}

/**
 * Garante a leitura no piso: se a zona do apoio da família não comporta o
 * texto a 28 px, primeiro cresce para o espaço livre abaixo; depois a página
 * é reempilhada (foto, título e apoio na ordem da família) e a foto perde
 * altura; sem altura mínima para a foto, ela sai. O texto nunca é cortado nem
 * reduzido abaixo do piso. Devolve `{ layout, fits }`.
 */
function ensureReadingRoom(layout, reading) {
  const format = layout.format;
  const need = readingHeightPct(layout.subtitle, reading);
  if (!need || layout.subtitle.h >= need) return { layout, fits: true };
  const bottom = READING_BOTTOM[format];
  const gap = STACK_GAP[format];
  const sub = layout.subtitle;
  // 1) Cresce para baixo até o próximo elemento na mesma coluna.
  const below = [layout.photo, layout.evidence, layout.title]
    .filter(r => r && !isBleed(r) && spanX(r, sub) > 0.5 && r.y >= sub.y + sub.h - 0.5)
    .map(r => r.y - gap);
  const limit = Math.min(bottom, ...below);
  if (limit - sub.y >= need) {
    return { layout: { ...layout, subtitle: { ...sub, h: round2(Math.max(sub.h, need)) } }, fits: true };
  }
  // 2) Reempilha em coluna: foto (se couber) · título · apoio, na ordem da
  // família. 3) Sem espaço nem assim, o título (que tem o próprio ajuste)
  // cede até 40% da altura da zona antes de o apoio ficar abaixo do piso.
  let stacked = restackForReading(layout, reading, layout.title.h);
  if (!stacked.fits) {
    const deficit = stacked.need - stacked.layout.subtitle.h;
    stacked = restackForReading(layout, reading, Math.max(layout.title.h * 0.6, layout.title.h - deficit));
  }
  return { layout: stacked.layout, fits: stacked.fits };
}

function restackForReading(layout, reading, titleH) {
  const format = layout.format;
  const bottom = READING_BOTTOM[format];
  const gap = STACK_GAP[format];
  const { title, subtitle: sub } = layout;
  const x = Math.min(title.x, sub.x);
  const width = Math.max(title.x + title.w, sub.x + sub.w) - x;
  const column = { x, w: round2(Math.min(width, 100 - 2 * x)) };
  const top = Math.min(READING_TOP[format], title.y, sub.y);
  const need = readingHeightPct({ ...sub, w: column.w }, reading);
  const photo = layout.photo && !isBleed(layout.photo) ? layout.photo : null;
  const topBleed = !!photo && photo.x === 0 && photo.y === 0 && photo.w === 100;
  const textH = titleH + gap + need;
  const photoH = !photo ? 0 : topBleed
    ? Math.min(photo.h, bottom - textH - gap)
    : Math.min(photo.h, bottom - top - textH - gap);
  const keepPhoto = !!photo && photoH >= MIN_PHOTO_H[format];
  const order = [
    ...(keepPhoto ? [['photo', photo]] : []), ['title', title], ['subtitle', sub],
  ].sort((a, b) => a[1].y - b[1].y);
  const next = { ...layout, photo: keepPhoto || isBleed(layout.photo) ? layout.photo : null };
  let y = keepPhoto && topBleed ? 0 : top;
  for (const [key] of order) {
    if (key === 'photo') {
      next.photo = { ...photo, y: round2(y), h: round2(photoH) };
      y += photoH + gap;
      if (topBleed) y = Math.max(y, top);
    } else if (key === 'title') {
      next.title = { ...column, y: round2(y), h: round2(titleH) };
      y += titleH + gap;
    } else {
      next.subtitle = { ...column, y: round2(y), h: 0 };
      y += need + gap;
    }
  }
  // O apoio fica com toda a altura até o próximo bloco (ou o fim da área).
  const after = order.findIndex(([key]) => key === 'subtitle') + 1;
  const nextTop = after < order.length ? next[order[after][0]].y - gap : bottom;
  next.subtitle = { ...next.subtitle, h: round2(Math.min(bottom - next.subtitle.y, Math.max(need, nextTop - next.subtitle.y))) };
  // Sem quadro nesta página reempilhada; fios e blocos que cairiam sobre o
  // texto saem (o texto nunca).
  const texts = [next.title, next.subtitle];
  next.evidence = null;
  next.chrome = (layout.chrome || []).filter(c => c.w == null || c.h == null || c.y == null
    || !texts.some(r => spanX(c, r) > 0.3 && Math.min(c.y + c.h, r.y + r.h) - Math.max(c.y, r.y) > 0.3));
  return { layout: next, need, fits: next.subtitle.h >= need - 0.01 };
}

/**
 * Recomposição de Feed, Quadrado e Stories pela família: a página é redesenhada
 * para a proporção (foto ganha altura, evidência ocupa a largura, título muda de
 * lugar conforme a família) em vez de ser o slide reduzido com a foto atrás.
 * Nenhum texto é cortado; o autofit reduz em passos e, no piso, a revisão
 * pede divisão em outra página.
 */
export function familyCarouselAdaptation(source, fmt = 'carrossel') {
  if (source?.presentationArtDirectionVersion !== 2 || !source.presentationDesignFamily) return null;
  const family = normalizeFamilyKey(source.presentationDesignFamily);
  const kind = ['cover', 'divider', 'content', 'demo', 'data', 'closing'].includes(source.presentationComposition)
    ? source.presentationComposition : 'content';
  const structured = normalizePresentationBlocks(source.presentationBlocks).length > 0;
  const photo = !!(source.bgImage || source.bgImageId || source.bgImageAssetId) && !source.presentationSuppressPhoto;
  const format = SOCIAL_FORMAT[fmt];
  if (!format) return null;
  const designed = familyLayout(family, kind, { format, photo, structured, title: source.title,
    reading: String(source.subtitle || '').length + String(source.bodyAfterImage || '').length });
  const { w } = FORMAT_SPECS[format];
  // Tamanhos já arredondados como o renderer os desenha.
  const subPx = rendererSubtitleSizePercent(Math.max(SOCIAL_READING_FLOOR_PX, designed.bodyPx), format) / 100 * w * 0.028;
  const bodyAfterSize = Math.ceil(Math.max(SOCIAL_READING_FLOOR_PX, designed.bodyPx * 0.86) / (w * 0.018) * 100);
  const bodyPx = bodyAfterSize / 100 * w * 0.018;
  // Quadro estruturado tem a própria zona; a leitura dele não passa por aqui.
  const { layout, fits } = designed.evidence
    ? { layout: designed, fits: true }
    : ensureReadingRoom(designed, {
      family, format, subPx, bodyPx,
      subtitle: String(source.subtitle || '').trim(), body: String(source.bodyAfterImage || '').trim(),
    });
  const { typography, ...fields } = familyPresentationFields({ ...layout, bodyPx: subPx }, { format });
  return {
    ...source,
    ...fields,
    presentationComposition: 'social-format',
    presentationSourceComposition: kind,
    formatAdaptedFrom: 'apresentacao',
    photoRegion: 'full', bgFit: 'cover', photoFraming: 'auto', bgZoom: 100, bgOpacity: 100,
    textBg: false, textInset: 0,
    bodyAfterSize,
    // O renderer não reduz o apoio abaixo de 28 px quando a zona comporta o
    // texto nesse tamanho (`ensureReadingRoom`).
    presentationReadingFloor: fits,
    presentationSuppressPhoto: !layout.photo,
    presentationRequiresImage: false,
    presentationGlass: null,
    presentationAutofit: { enabled: true, minScale: 0.7 },
    elementOffsets: {},
    logoPosition: 'tl', logoSize: 160,
    presentationTypographyByComposition: {
      ...source.presentationTypographyByComposition,
      'social-format': {
        title: { ...typography.title, sizePercent: fields.titleSize },
        subtitle: { ...typography.subtitle, sizePercent: fields.subSize },
      },
    },
    canvas: {
      enabled: false, applied: true, variant: 'classic',
      source: 'presentation-format', preserveZones: true,
      zones: {
        title: layout.title, subtitle: layout.subtitle,
        photo: layout.photo || { x: 96, y: 94, w: 1, h: 1 },
        ...(layout.evidence ? { evidence: layout.evidence } : {}),
      },
    },
  };
}

export function hasPresentationDesign(slide, creativePreset) {
  return creativePreset === 'apresentacao'
    || !!slide?.presentationPresetId
    || !!slide?.presentationCompositionId
    || slide?.canvas?.source === 'presentation-preset';
}

function linesFor(text, width, fontSize) {
  return String(text || '').split('\n').reduce((sum, line) => (
    sum + (line ? Math.max(1, Math.ceil(line.length * fontSize * 0.53 / width)) : 0)
  ), 0);
}

/**
 * A apresentação continua salva em 16:9. Esta é uma composição de leitura
 * para a proporção de destino, nunca uma transformação do conteúdo original.
 */
export function presentationForSocialFormat(source, fmt) {
  const recomposed = familyCarouselAdaptation(source, fmt);
  if (recomposed) return recomposed;
  const { w, h, bottomSafePct } = FORMATS[fmt];
  const hasPhoto = !!(source.bgImage || source.bgImageId || source.bgImageAssetId);
  const square = fmt === 'quadrado';
  const titlePx = w * (square ? 0.062 : 0.07);
  const subPx = w * (square ? 0.030 : 0.034);
  const bodyPx = w * (square ? 0.025 : 0.028);
  const textWidth = w * 0.82;
  const paddingY = h * 0.012;
  const titleHeight = Math.max(h * 0.05, linesFor(source.title, textWidth, titlePx) * titlePx * 1.1 + paddingY);
  const subHeight = linesFor(source.subtitle, textWidth, subPx) * subPx * 1.35;
  const bodyHeight = linesFor(source.bodyAfterImage, textWidth, bodyPx) * bodyPx * 1.35;
  const supportingHeight = Math.max(h * 0.05, subHeight + bodyHeight
    + (subHeight && bodyHeight ? h * 0.018 : 0) + paddingY);
  const gap = h * 0.012;
  const bottom = h * (1 - bottomSafePct / 100);
  // Reserva a faixa superior para a marca e a foto. Textos longos ganham
  // altura antes de o renderizador precisar reduzir a fonte.
  const available = bottom - h * 0.25;
  const fit = Math.min(1, available / Math.max(1, titleHeight + supportingHeight + gap));
  const titleH = titleHeight * fit;
  const supportH = supportingHeight * fit;
  const titleY = bottom - titleH - supportH - gap;
  const typography = source.presentationTypographyByComposition?.[source.presentationComposition];
  const textFonts = { ...source.textFonts };
  for (const key of ['title', 'subtitle']) {
    if (!textFonts[key] && typography?.[key]?.fontFamily) textFonts[key] = typography[key].fontFamily;
  }
  const adapted = {
    ...source,
    layout: 'tl',
    align: 'left',
    photoRegion: 'full',
    bgFit: 'cover',
    photoFraming: 'auto',
    bgZoom: 100,
    bgOpacity: 100,
    overlay: hasPhoto ? Math.max(64, Number(source.overlay) || 0) : 0,
    textBg: false,
    textShadow: hasPhoto,
    textInset: 0,
    textBlockWidth: 84,
    titleSize: titlePx / (w * 0.084) * 100,
    subSize: subPx / (w * 0.028) * 100,
    bodyAfterSize: bodyPx / (w * 0.018) * 100,
    titleLeading: 110,
    subLeading: 135,
    bodyLeading: 135,
    titleWeight: typography?.title?.weight ?? source.titleWeight ?? 700,
    titleColor: hasPhoto ? '#ffffff' : source.titleColor,
    subtitleColor: hasPhoto ? '#f5f5f7' : source.subtitleColor,
    textColor: hasPhoto ? '#f5f5f7' : source.textColor,
    textFonts,
    // Métricas e vidro da composição landscape não podem prevalecer sobre
    // os controles/tamanhos da nova proporção.
    presentationComposition: 'social-format',
    formatAdaptedFrom: 'apresentacao',
    presentationTypographyByComposition: {
      ...source.presentationTypographyByComposition,
      'social-format': Object.fromEntries(['title', 'subtitle'].map(key => [key, {
        italic: typography?.[key]?.italic,
        case: typography?.[key]?.case,
      }])),
    },
    presentationGlass: null,
    presentationAutofit: { enabled: true, minScale: 0.7 },
    elementOffsets: {},
    logoPosition: 'tl',
    logoSize: 220,
    logoTone: hasPhoto ? 'light' : source.logoTone,
    canvas: {
      enabled: false, applied: true, variant: 'classic',
      source: 'presentation-format', preserveZones: true,
      zones: {
        photo: { x: 0, y: 0, w: 100, h: 100 },
        title: { x: 5, y: titleY / h * 100, w: 90, h: titleH / h * 100 },
        subtitle: { x: 5, y: (titleY + titleH + gap) / h * 100, w: 90, h: supportH / h * 100 },
      },
    },
  };
  if (!normalizePresentationBlocks(source.presentationBlocks).length) return adapted;
  // Native evidence needs its own space in a portrait/square adaptation. It
  // must not disappear because the social photo layout replaces its zones.
  const nativeTitleH = Math.min(h * 0.18, titleHeight);
  const nativeSupportH = Math.min(h * 0.16, supportingHeight);
  const nativeTitleY = h * 0.16;
  const nativeSupportY = nativeTitleY + nativeTitleH + gap;
  const evidenceY = nativeSupportY + nativeSupportH + gap;
  return {
    ...adapted,
    presentationSuppressPhoto: true,
    presentationRequiresImage: false,
    overlay: 0, textShadow: false,
    titleColor: source.titleColor, subtitleColor: source.subtitleColor, textColor: source.textColor,
    canvas: { ...adapted.canvas, zones: {
      ...adapted.canvas.zones,
      title: { x: 6, y: nativeTitleY / h * 100, w: 88, h: nativeTitleH / h * 100 },
      subtitle: { x: 6, y: nativeSupportY / h * 100, w: 88, h: nativeSupportH / h * 100 },
      evidence: { x: 6, y: evidenceY / h * 100, w: 88, h: Math.max(25, (bottom - evidenceY) / h * 100) },
    } },
  };
}
