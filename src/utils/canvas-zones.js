// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import { X } from 'lucide-react';
import { FORMATS } from './formats.js';
import { applyCompositionToSlide, getComposition, inferCompositionId } from './slide-design-system.js';
import { isPersoHybridDensity, isTendenciaCulturaPreset } from './generation-prompts.js';
import { DEFAULT_SLIDE_TEXT_INSET, CANVAS_ZONE_MIN, SANDWICH_PHOTO_ZONE_MIN_H_PCT, SANDWICH_PHOTO_ZONE_ABSOLUTE_MIN_H_PCT, SANDWICH_TEXT_ZONE_MIN_H_PCT, clampRect, DEFAULT_CANVAS_ZONES_CLASSIC, DEFAULT_CANVAS_ZONES_SANDWICH, DEFAULT_CANVAS_ZONES_STAT, finalizeCanvasMarginsForAutoAdjust } from './canvas-layout.js';

/** Heurísticas para «Ajuste automático»: texto, foto cover, e com canvas — molduras dentro da margem e alturas compatíveis com o tipo. */
function slideAutoAdjustPatch(slide, { creativePreset, fmt = 'carrossel' }) {
  const patch = {};

  const titleRaw = slide.title ?? '';
  const subtitleRaw = slide.subtitle ?? '';
  const bodyRaw = slide.bodyAfterImage ?? '';
  const titleChars = String(titleRaw).trim().length;
  const subChars = String(subtitleRaw).trim().length;
  const bodyChars = String(bodyRaw).trim().length;
  /** Volume útil quando há bloco inferior (sandwich / Cultura). */
  const stackedTextChars = subChars + Math.round(bodyChars * 0.92);
  const titleLines = Math.max(1, String(titleRaw).split(/\n/).filter((ln) => ln.length > 0).length);
  const subLines = Math.max(1, String(subtitleRaw).split(/\n/).length);
  const bodyLines = Math.max(1, String(bodyRaw).split(/\n/).length);
  const maxStackLines = Math.max(subLines, bodyLines);

  if (slide.bgImage) {
    if (slide.bgFit !== 'cover') patch.bgFit = 'cover';
    if ((slide.bgX ?? 50) !== 50) patch.bgX = 50;
    if ((slide.bgY ?? 50) !== 50) patch.bgY = 50;
    if ((slide.bgZoom ?? 100) !== 100) patch.bgZoom = 100;
  }

  const curTitleSz = slide.titleSize ?? 100;
  let nextTitleSz = curTitleSz;
  if (titleChars > 150) nextTitleSz = Math.min(nextTitleSz, 70);
  else if (titleChars > 110) nextTitleSz = Math.min(nextTitleSz, 80);
  else if (titleChars > 75) nextTitleSz = Math.min(nextTitleSz, 90);
  else if (titleChars > 52) nextTitleSz = Math.min(nextTitleSz, 96);

  const curSubSz = slide.subSize ?? 100;
  let nextSubSz = curSubSz;
  const subHeuristicChars = Math.max(subChars, stackedTextChars);
  if (subHeuristicChars > 950) nextSubSz = Math.min(nextSubSz, 68);
  else if (subHeuristicChars > 700) nextSubSz = Math.min(nextSubSz, 76);
  else if (subHeuristicChars > 480) nextSubSz = Math.min(nextSubSz, 84);
  else if (subHeuristicChars > 300) nextSubSz = Math.min(nextSubSz, 92);
  else if (subHeuristicChars > 200) nextSubSz = Math.min(nextSubSz, 97);

  if (nextTitleSz !== curTitleSz) patch.titleSize = nextTitleSz;
  if (nextSubSz !== curSubSz) patch.subSize = nextSubSz;

  const curTLead = slide.titleLeading ?? 105;
  let nextTLead = curTLead;
  if (titleLines >= 4) nextTLead = Math.max(curTLead, 118);
  else if (titleLines >= 2) nextTLead = Math.max(curTLead, 110);

  const curSLead = slide.subLeading ?? 150;
  let nextSLead = curSLead;
  if (maxStackLines >= 9) nextSLead = Math.max(curSLead, 168);
  else if (maxStackLines >= 6) nextSLead = Math.max(curSLead, 160);
  else if (stackedTextChars > 520) nextSLead = Math.max(curSLead, 156);
  else if (maxStackLines >= 4) nextSLead = Math.max(curSLead, 154);

  if (nextTLead !== curTLead) patch.titleLeading = nextTLead;
  if (nextSLead !== curSLead) patch.subLeading = nextSLead;

  const inset = slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
  let nextInset = inset;
  if ((titleChars > 95 || titleLines >= 3) && nextInset < 12) nextInset = Math.min(12, inset + 2);
  if (stackedTextChars > 340 && nextInset < 14) nextInset = Math.min(14, Math.max(nextInset, inset + 2));
  if (stackedTextChars > 540 && nextInset < 17) nextInset = Math.min(17, Math.max(nextInset, inset + 3));
  if (bodyChars > 400 && nextInset < 18) nextInset = Math.min(18, Math.max(nextInset, inset + 4));
  if (nextInset !== inset) patch.textInset = nextInset;

  const hasSandwichBody = bodyChars > 0;
  const heavyStack =
    (creativePreset !== 'tendencia_cultura' && !slide.useCultureLayout) ||
    !hasSandwichBody;
  if (heavyStack && stackedTextChars > 300 && ['mc', 'tc', 'tr', 'tl'].includes(slide.layout)) {
    patch.layout = 'bl';
    if (slide.align === 'center') patch.align = 'left';
  }

  const fFmt = FORMATS[fmt] || FORMATS.carrossel;
  const merged = { ...slide, ...patch };
  if (merged.canvas?.zones && typeof merged.canvas.zones === 'object' && merged.canvas.variant) {
    const fin = finalizeCanvasMarginsForAutoAdjust(merged, fFmt);
    if (fin?.zones) {
      patch.canvas = { ...slide.canvas, ...(patch.canvas || {}), zones: fin.zones };
      if (fin.textInsetAdvice != null) {
        const curIns = merged.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
        if (fin.textInsetAdvice > curIns) {
          patch.textInset = Math.max(patch.textInset ?? curIns, fin.textInsetAdvice);
        }
      }
    }
  }

  return patch;
}

/** Capa / encerramento Cultura ou primeiros dois do Personalizado 1·1 · 1·2 — foto preenche o card,
 *  texto nas zonas inferiores (estilo "manchete sobre foto"). Título com altura ampla pra
 *  acomodar 2-3 linhas de copy editorial sem cortar. */
const DEFAULT_CANVAS_ZONES_COVER_FULLBLEED = {
  photo: { x: 0, y: 0, w: 100, h: 100 },
  title: { x: 6, y: 62, w: 88, h: 22 },
  subtitle: { x: 6, y: 85, w: 88, h: 10 },
};

function slideHasPendingPhotoIntent(slide) {
  // Vídeo importado é "intenção de mídia visual" tanto quanto bgImage —
  // sem isso, sandwich layout (Cultura/Tendência) desativa a zona da foto
  // e o <video> nunca renderiza apesar de slide.videoId estar setado.
  if (slide?.videoId) return true;
  return !!(String(slide?.imageQuery ?? '').trim());
}

function inferCanvasDefaults(slide, creativePreset) {
  const cpPack = creativePreset === 'tendencia_cultura';
  const skin = cpPack || !!slide.useCultureLayout;
  const bodyAfter = (slide.bodyAfterImage || '').trim();
  const hasPhotoIntent = !!slide.bgImage || slideHasPendingPhotoIntent(slide);
  const sandwich = skin && !!bodyAfter && hasPhotoIntent;
  const stat =
    skin && !!bodyAfter && !hasPhotoIntent && !!(slide.subtitle || '').trim();
  if (sandwich) return { variant: 'sandwich', zones: { ...DEFAULT_CANVAS_ZONES_SANDWICH } };
  if (stat) return { variant: 'stat', zones: { ...DEFAULT_CANVAS_ZONES_STAT } };
  // Cultura: capa/encerramento (slide sem bodyAfterImage com foto) usa full-bleed pra
  // título ter espaço amplo. Outros casos usam classic.
  if (skin && hasPhotoIntent) {
    return { variant: 'classic', zones: { ...DEFAULT_CANVAS_ZONES_COVER_FULLBLEED } };
  }
  return { variant: 'classic', zones: { ...DEFAULT_CANVAS_ZONES_CLASSIC } };
}

/**
 * Igual ao trato do botão «Ajuste automático»: aplica zonas já calibradas e `textInset` se preciso.
 * Usado após IA gerar layouts (caps full-bleed 1º/último + canvas) para evitar texto fora das margens.
 */
function applyFinalizeCanvasMarginsToSlides(slides, fmt = 'carrossel') {
  const fFmt = FORMATS[fmt] || FORMATS.carrossel;
  return slides.map((slide) => {
    if (!slide.canvas?.zones || typeof slide.canvas.zones !== 'object' || !slide.canvas.variant)
      return slide;
    const fin = finalizeCanvasMarginsForAutoAdjust(slide, fFmt);
    if (!fin?.zones) return slide;
    const next = {
      ...slide,
      canvas: { ...slide.canvas, zones: fin.zones },
    };
    const insetAdv = fin.textInsetAdvice;
    if (insetAdv != null) {
      const cur = next.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
      if (insetAdv > cur) next.textInset = insetAdv;
    }
    if (next.canvas.variant === 'classic') {
      const ph = clampRect(next.canvas.zones.photo || DEFAULT_CANVAS_ZONES_CLASSIC.photo);
      const fullBleed = ph.h >= 89 && ph.y <= 2 && ph.w >= 92;
      if (fullBleed && next.layout === 'mc') {
        next.layout = next.align === 'center' || next.align === 'justify' ? 'bc' : 'bl';
      }
    }
    return next;
  });
}

/** Ao mudar `titleSize` / `subSize` com canvas ativo: escala alturas das molduras de texto (~tamanho do tipo); a zona foto cede espaço até ao mínimo. */
function canvasZonesFontScalePatch(prevSlide, mergedSlide) {
  const canvas = mergedSlide.canvas;
  if (!canvas?.enabled || !canvas.zones || typeof canvas.zones !== 'object' || !canvas.variant) return null;

  const oldT = prevSlide.titleSize ?? 100;
  const oldS = prevSlide.subSize ?? 100;
  const oldB = prevSlide.bodyAfterSize ?? prevSlide.subSize ?? 100;
  const newT = mergedSlide.titleSize ?? 100;
  const newS = mergedSlide.subSize ?? 100;
  const newB = mergedSlide.bodyAfterSize ?? mergedSlide.subSize ?? 100;
  const rT = newT / oldT;
  const rS = newS / oldS;
  const rB = newB / oldB;
  if (
    Math.abs(rT - 1) < 0.003 &&
    Math.abs(rS - 1) < 0.003 &&
    Math.abs(rB - 1) < 0.003
  ) return null;

  const zIn = mergedSlide.canvas.zones;

  if (canvas.variant === 'classic') {
    const photo = clampRect(zIn.photo || DEFAULT_CANVAS_ZONES_CLASSIC.photo);
    const title = clampRect(zIn.title || DEFAULT_CANVAS_ZONES_CLASSIC.title);
    const sub = clampRect(zIn.subtitle || DEFAULT_CANVAS_ZONES_CLASSIC.subtitle);
    const gapTS = Math.max(0.5, sub.y - (title.y + title.h));
    const newTitleH = Math.max(CANVAS_ZONE_MIN.h, title.h * rT);
    const newSubH = Math.max(CANVAS_ZONE_MIN.h, sub.h * rS);
    const subY = title.y + newTitleH + gapTS;
    let overflow = subY + newSubH - 98;
    let photoNext = { ...photo };
    if (overflow > 0) {
      const shrink = Math.min(overflow + 0.75, Math.max(0, photoNext.h - CANVAS_ZONE_MIN.h));
      photoNext.h = Math.max(CANVAS_ZONE_MIN.h, photoNext.h - shrink);
      overflow -= shrink;
    }
    const adjSubH = overflow > 0
      ? Math.max(CANVAS_ZONE_MIN.h, newSubH - overflow)
      : newSubH;
    return {
      canvas: {
        ...canvas,
        zones: {
          ...zIn,
          photo: clampRect(photoNext),
          title: clampRect({ ...title, h: newTitleH }),
          subtitle: clampRect({ ...sub, y: subY, h: adjSubH }),
        },
      },
    };
  }

  if (canvas.variant === 'sandwich') {
    const photoFloor = SANDWICH_PHOTO_ZONE_MIN_H_PCT;
    const photoAbsMin = SANDWICH_PHOTO_ZONE_ABSOLUTE_MIN_H_PCT;
    const needTopMin =
      String(mergedSlide.title ?? '').trim().length > 0 || String(mergedSlide.subtitle ?? '').trim().length > 0
        ? SANDWICH_TEXT_ZONE_MIN_H_PCT
        : CANVAS_ZONE_MIN.h;
    const needBotMin =
      String(mergedSlide.bodyAfterImage ?? '').trim().length > 0 ? SANDWICH_TEXT_ZONE_MIN_H_PCT : CANVAS_ZONE_MIN.h;
    const top = clampRect(zIn.top || DEFAULT_CANVAS_ZONES_SANDWICH.top);
    const photo = clampRect(zIn.photo || DEFAULT_CANVAS_ZONES_SANDWICH.photo);
    const bottom = clampRect(zIn.bottom || DEFAULT_CANVAS_ZONES_SANDWICH.bottom);
    const gapTP = Math.max(0.5, photo.y - (top.y + top.h));
    const gapPB = Math.max(0.5, bottom.y - (photo.y + photo.h));
    const newTopH = Math.max(needTopMin, top.h * Math.max(rT, rS));
    const newBotH = Math.max(needBotMin, bottom.h * rB);
    const photoY = top.y + newTopH + gapTP;
    let botY = bottom.y;
    let botHAdj = newBotH;
    if (botY + botHAdj > 98) botY = 98 - botHAdj;
    let photoH = botY - gapPB - photoY;
    if (photoH < photoFloor) {
      const shortage = photoFloor - photoH;
      botHAdj = Math.max(needBotMin, botHAdj - shortage);
      botY = Math.min(bottom.y, 98 - botHAdj);
      photoH = Math.max(photoAbsMin, botY - gapPB - photoY);
      if (photoH < photoFloor) {
        botY = Math.min(98 - needBotMin, photoY + gapPB + photoFloor);
        botHAdj = Math.max(needBotMin, 98 - botY);
        photoH = Math.max(photoAbsMin, botY - gapPB - photoY);
      }
    }
    botY = photoY + photoH + gapPB;
    let spaceForBottom = 98 - botY;
    let guardFs = 0;
    while (spaceForBottom + 0.08 < needBotMin && photoH > photoAbsMin + 0.35 && guardFs < 90) {
      guardFs += 1;
      photoH -= 0.95;
      botY = photoY + photoH + gapPB;
      spaceForBottom = 98 - botY;
    }
    botHAdj = 98 - botY;

    return {
      canvas: {
        ...canvas,
        zones: {
          ...zIn,
          top: clampRect({ ...top, h: newTopH }),
          photo: clampRect({ ...photo, y: photoY, h: photoH }),
          bottom: clampRect({ ...bottom, y: botY, h: botHAdj }),
        },
      },
    };
  }

  if (canvas.variant === 'stat') {
    const top = clampRect(zIn.top || DEFAULT_CANVAS_ZONES_STAT.top);
    const bot = clampRect(zIn.bottom || DEFAULT_CANVAS_ZONES_STAT.bottom);
    const gapTB = Math.max(0.5, bot.y - (top.y + top.h));
    const newTopH = Math.max(CANVAS_ZONE_MIN.h, top.h * Math.max(rT, rS));
    const newBotH = Math.max(CANVAS_ZONE_MIN.h, bot.h * Math.max(rS, rB));
    const botY = top.y + newTopH + gapTB;
    const overflow = botY + newBotH - 98;
    const adjBotH = overflow > 0
      ? Math.max(CANVAS_ZONE_MIN.h, newBotH - overflow)
      : newBotH;
    return {
      canvas: {
        ...canvas,
        zones: {
          ...zIn,
          top: clampRect({ ...top, h: newTopH }),
          bottom: clampRect({ ...bot, y: botY, h: adjBotH }),
        },
      },
    };
  }

  return null;
}

/** `<img>` na zona foto (canvas sanduíche/stat) — mesmo raciocínio que `background-*` no modo classic (X/Y, zoom, fit, espelho, opacidade). */
function sandwichPhotoZoneImgStyle(slide, presentationFilter) {
  const bgFit = slide.bgFit ?? 'cover';
  const bx = slide.bgX ?? 50;
  const by = slide.bgY ?? 50;
  const origin = `${bx}% ${by}%`;
  const zoom = (slide.bgZoom ?? 100) / 100;
  const mirror = slide.bgMirror ? 'scaleX(-1) ' : '';
  const filt = presentationFilter ? { filter: presentationFilter } : {};
  const op = (slide.bgOpacity ?? 100) / 100;
  const transform = `${mirror}${zoom !== 1 ? `scale(${zoom})` : ''}`.trim() || undefined;

  if (bgFit === 'contain') {
    return {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      objectPosition: origin,
      transform,
      transformOrigin: origin,
      opacity: op,
      ...filt,
    };
  }

  return {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: origin,
    transform,
    transformOrigin: origin,
    opacity: op,
    ...filt,
  };
}

/**
 * Depois da geração com IA: define canvas ativo (zonas) para encaixar fotos pendentes mesmo sem «modo canvas» manual.
 * Tendência/Cultura: capa e último slide full-bleed; miolo sandwich com rotação vertical da zona foto.
 */
function attachGenerationCanvasLayouts(slides, { creativePreset, slideTextDensity }) {
  const n = slides.length;
  if (!n) return slides;
  const isTC = isTendenciaCulturaPreset(creativePreset);
  const persoHybrid = isPersoHybridDensity(creativePreset, slideTextDensity);
  const zonesByKey = {
    cover: DEFAULT_CANVAS_ZONES_COVER_FULLBLEED,
    classic: DEFAULT_CANVAS_ZONES_CLASSIC,
    sandwich: DEFAULT_CANVAS_ZONES_SANDWICH,
    stat: DEFAULT_CANVAS_ZONES_STAT,
  };

  return slides.map((s, i) => {
    const q = String(s.imageQuery || '').trim();
    const bod = String(s.bodyAfterImage || '').trim();

    // Composition explícita (templates / IA futura) tem prioridade.
    if (s.composition && getComposition(s.composition)) {
      return applyCompositionToSlide(s, s.composition, zonesByKey);
    }

    if (isTC) {
      const fullBleedPortrait = i === 0 || i === n - 1;
      if (fullBleedPortrait && q) {
        return applyCompositionToSlide(
          { ...s, imageQuery: q },
          i === n - 1 ? 'cta_close' : 'hook_fullbleed',
          zonesByKey,
        );
      }
      const mid = i > 0 && i < n - 1;
      if (mid && bod && q) {
        return applyCompositionToSlide(s, 'sandwich_editorial', zonesByKey);
      }
      if (mid && bod && !q) {
        return applyCompositionToSlide(s, 'stat_proof', zonesByKey);
      }
      if (mid && q && !bod) {
        return applyCompositionToSlide(s, 'reveal_bridge', zonesByKey);
      }
      const inferred = inferCompositionId({
        index: i, total: n, hasPhoto: !!q, hasBodyAfter: !!bod, isStat: mid && bod && !q,
      });
      return applyCompositionToSlide(s, inferred, zonesByKey);
    }

    if (persoHybrid) {
      const firstPair = i <= 1;
      if (firstPair && q) {
        return {
          ...s,
          canvas: {
            enabled: true,
            variant: 'classic',
            zones: { ...DEFAULT_CANVAS_ZONES_COVER_FULLBLEED },
          },
        };
      }
      if (firstPair && !q) {
        const d = inferCanvasDefaults({ ...s, bodyAfterImage: '', useCultureLayout: false }, 'livre');
        return { ...s, canvas: { enabled: false, variant: d.variant, zones: { ...d.zones } } };
      }
      if (s.useCultureLayout && bod && q) {
        return {
          ...s,
          canvas: {
            enabled: true,
            variant: 'sandwich',
            // Mesmo do botão (zonas amplas) — evita corte de texto denso
            zones: { ...DEFAULT_CANVAS_ZONES_SANDWICH },
          },
        };
      }
      if (s.useCultureLayout && bod && !q) {
        return {
          ...s,
          canvas: { enabled: true, variant: 'stat', zones: { ...DEFAULT_CANVAS_ZONES_STAT } },
        };
      }
      if (!s.useCultureLayout && q && i >= 2) {
        return {
          ...s,
          canvas: {
            enabled: true,
            variant: 'classic',
            zones: { ...DEFAULT_CANVAS_ZONES_COVER_FULLBLEED },
          },
        };
      }
      const d = inferCanvasDefaults({ ...s }, creativePreset);
      return { ...s, canvas: { enabled: false, variant: d.variant, zones: { ...d.zones } } };
    }

    const d = inferCanvasDefaults(s, creativePreset);
    const needsCanvas = slideHasPendingPhotoIntent(s);
    if (!needsCanvas) return { ...s };
    return {
      ...s,
      canvas: {
        enabled: true,
        variant: d.variant,
        zones: { ...d.zones },
      },
    };
  });
}

export {
  slideAutoAdjustPatch,
  DEFAULT_CANVAS_ZONES_COVER_FULLBLEED,
  slideHasPendingPhotoIntent,
  inferCanvasDefaults,
  applyFinalizeCanvasMarginsToSlides,
  canvasZonesFontScalePatch,
  sandwichPhotoZoneImgStyle,
  attachGenerationCanvasLayouts,
};
