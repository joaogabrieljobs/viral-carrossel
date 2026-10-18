import { FORMATS } from './formats.js';

const SIZE_MIN = 52;
const SIZE_MAX = 130;

function readingOf(fmt) {
  const f = FORMATS[fmt] || FORMATS.carrossel;
  const top = f.topSafePct;
  const bottom = 100 - f.bottomSafePct;
  const left = f.edgePct;
  const right = 100 - f.edgePct;
  return {
    f,
    top,
    bottom,
    left,
    right,
    pxH: f.h * (bottom - top) / 100,
    pxW: f.w * (right - left) / 100,
  };
}

function clampSize(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 100;
  return Math.round(Math.min(SIZE_MAX, Math.max(SIZE_MIN, n)));
}

function clampPct(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function textColumn(slide, area) {
  const zones = slide?.canvas?.zones;
  const boxes = [zones?.title, zones?.subtitle, zones?.top, zones?.bottom].filter((box) => (
    box && Number.isFinite(box.x) && Number.isFinite(box.y)
  ));
  if (!boxes.length) {
    return {
      left: area.left,
      right: area.right,
      top: area.top,
      bottom: area.bottom,
    };
  }
  return {
    left: Math.max(area.left, Math.min(...boxes.map((box) => box.x))),
    right: Math.min(area.right, Math.max(...boxes.map((box) => box.x + (box.w || 0)))),
    top: area.top,
    bottom: area.bottom,
  };
}

function estimateTextBottom(slide, area) {
  const zones = slide?.canvas?.zones;
  const boxes = [zones?.title, zones?.subtitle, zones?.top, zones?.bottom].filter((box) => (
    box && Number.isFinite(box.y)
  ));
  if (boxes.length) {
    return Math.min(area.bottom, Math.max(...boxes.map((box) => box.y + (box.h || 0))));
  }
  const f = area.f;
  const widthPx = Math.max(80, area.pxW * ((slide.textBlockWidth ?? 78) / 100));
  const titleFs = f.w * 0.084 * ((slide.titleSize ?? 100) / 100);
  const titleChars = String(slide.title || '').trim().length;
  const titleLines = Math.max(
    1,
    Math.ceil(titleChars / Math.max(8, widthPx / Math.max(8, titleFs * 0.5))),
  );
  const subFs = f.w * 0.028 * ((slide.subSize ?? 100) / 100);
  const subChars = String(slide.subtitle || '').trim().length;
  const subLines = subChars
    ? Math.max(1, Math.ceil(subChars / Math.max(10, widthPx / Math.max(8, subFs * 0.45))))
    : 0;
  const topPx = f.h * (area.top / 100);
  const blockPx = titleLines * titleFs * 1.08 + subLines * subFs * 1.45 + f.h * 0.03;
  return ((topPx + blockPx) / f.h) * 100;
}

function fitType(slide, from, to) {
  const factor = (to.pxH / from.pxH) * (from.f.w / to.f.w);
  if (!Number.isFinite(factor) || Math.abs(factor - 1) < 0.02) return { ...slide };
  const next = { ...slide };
  next.titleSize = clampSize((slide.titleSize ?? 100) * factor);
  next.subSize = clampSize((slide.subSize ?? 100) * factor);
  if (slide.bodyAfterSize != null) next.bodyAfterSize = clampSize(slide.bodyAfterSize * factor);
  return next;
}

function shrinkUntilItFits(slide, area) {
  const next = { ...slide };
  for (let i = 0; i < 8; i += 1) {
    const bottom = estimateTextBottom(next, area);
    if (bottom <= area.bottom - 10) return next;
    const title = next.titleSize ?? 100;
    const sub = next.subSize ?? 100;
    if (title <= SIZE_MIN && sub <= SIZE_MIN) return next;
    next.titleSize = clampSize(title - 6);
    next.subSize = clampSize(sub - 4);
  }
  return next;
}

function mapAcross(value, fromA, fromB, toA, toB) {
  const span = fromB - fromA || 1;
  const t = (Number(value) - fromA) / span;
  return toA + clampPct(t, 0, 1) * (toB - toA);
}

function fitOverlays(overlays, from, to, slide) {
  if (!Array.isArray(overlays) || !overlays.length) return overlays;
  const column = textColumn(slide, to);
  const textBottom = estimateTextBottom(slide, to);
  const span = Math.max(8, column.right - column.left);
  return overlays.map((ov) => {
    if (!ov || typeof ov !== 'object') return ov;
    let x = mapAcross(ov.x, from.left, from.right, column.left, column.right);
    let y = mapAcross(ov.y, from.top, from.bottom, column.top, column.bottom);
    if (ov.type === 'cta') {
      x = mapAcross(ov.x, from.left, from.right, column.left + span * 0.08, column.right - span * 0.08);
      y = Math.min(column.bottom - 6, Math.max(textBottom + 2, y));
    }
    x = clampPct(x, column.left + 4, column.right - 4);
    y = clampPct(y, column.top + 2, column.bottom - 4);
    const next = { ...ov, x: round1(x), y: round1(y) };
    if (Number.isFinite(ov.w)) {
      next.w = round1(Math.min(ov.w, Math.max(8, column.right - x)));
    }
    return next;
  });
}

function scaleOffsets(offsets, from, to) {
  if (!offsets || typeof offsets !== 'object') return offsets;
  const sx = from.f.w / to.f.w;
  const sy = from.f.h / to.f.h;
  const next = {};
  for (const [key, value] of Object.entries(offsets)) {
    if (!value || typeof value !== 'object') {
      next[key] = value;
      continue;
    }
    next[key] = {
      ...value,
      ...(Number.isFinite(value.x) ? { x: round1(value.x * sx) } : {}),
      ...(Number.isFinite(value.y) ? { y: round1(value.y * sy) } : {}),
    };
  }
  return next;
}

/**
 * Encaixa texto, botões e deslocamentos na área de leitura do formato novo.
 * A troca de carrossel (4:5, quadrado, stories) escala o tipo. Entrar ou sair
 * da apresentação 16:9 mantém a composição nova e só reposiciona o que ficou
 * fora da coluna de leitura.
 */
export function fitSlideToFormat(slide, fromFmt, toFmt, { composed = false } = {}) {
  if (!slide || !fromFmt || fromFmt === toFmt) return slide;
  const from = readingOf(fromFmt);
  const to = readingOf(toFmt);
  let next = composed ? { ...slide } : fitType(slide, from, to);
  if (!composed) next = shrinkUntilItFits(next, to);
  if (Array.isArray(slide.overlays)) next.overlays = fitOverlays(slide.overlays, from, to, next);
  if (composed) {
    next.elementOffsets = {};
  } else if (slide.elementOffsets) {
    next.elementOffsets = scaleOffsets(slide.elementOffsets, from, to);
  }
  return next;
}

export function fitSlidesToFormat(slides, fromFmt, toFmt, options) {
  if (!Array.isArray(slides) || !fromFmt || fromFmt === toFmt) return slides;
  return slides.map((slide) => fitSlideToFormat(slide, fromFmt, toFmt, options));
}
