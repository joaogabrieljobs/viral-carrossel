// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).

/** Padding multiplicador por defeito (slider «Distância das bordas»); slides antigos sem campo usam o mesmo fallback na renderização. */
const DEFAULT_SLIDE_TEXT_INSET = 10;

const CANVAS_ZONE_MIN = { w: 8, h: 5 };
/** Miolo sanduíche: altura-alvo mínima da zona foto (% do card), alinhada ao layout flat (~31%). */
const SANDWICH_PHOTO_ZONE_MIN_H_PCT = 32;
/** Se não couber com texto legível, a foto pode descer até este piso (%). */
const SANDWICH_PHOTO_ZONE_ABSOLUTE_MIN_H_PCT = 20;
/** Altura mínima das zonas de texto topo/fundo no sanduíche — evita molduras tipo faixa que cortam parágrafos. */
const SANDWICH_TEXT_ZONE_MIN_H_PCT = 14;

function clampRect(r) {
  const x = Math.max(0, Math.min(100 - CANVAS_ZONE_MIN.w, r.x));
  const y = Math.max(0, Math.min(100 - CANVAS_ZONE_MIN.h, r.y));
  const w = Math.max(CANVAS_ZONE_MIN.w, Math.min(100 - x, r.w));
  const h = Math.max(CANVAS_ZONE_MIN.h, Math.min(100 - y, r.h));
  return { x, y, w, h };
}

const DEFAULT_CANVAS_ZONES_CLASSIC = {
  photo: { x: 0, y: 0, w: 100, h: 58 },
  title: { x: 6, y: 62, w: 88, h: 14 },
  subtitle: { x: 6, y: 77, w: 88, h: 20 },
};

const DEFAULT_CANVAS_ZONES_SANDWICH = {
  top: { x: 6, y: 7, w: 88, h: 22 },
  photo: { x: 6, y: 31, w: 88, h: 41 },
  bottom: { x: 6, y: 74, w: 88, h: 23 },
};

const DEFAULT_CANVAS_ZONES_STAT = {
  top: { x: 6, y: 8, w: 88, h: 40 },
  bottom: { x: 6, y: 52, w: 88, h: 38 },
};

/** Margem lateral mínima do card para molduras de texto no «Ajuste automático». */
const CANVAS_AUTO_EDGE_PCT = 8;
/** Padding interno (`textInset`) mínimo com canvas quando se corre o ajuste — evita tipo colado na moldura azul. */
const CANVAS_AUTO_TEXT_INSET_MIN = 13;

/** Limita zonas texto à faixa lateral [EDGE,100-EDGE]; foto mantém proporções usuário (clamp só segurança). */
function tightenCanvasTextZoneRect(r) {
  const g = CANVAS_AUTO_EDGE_PCT;
  const b = clampRect(r);
  let x = Math.max(g, Math.min(b.x, 100 - g - CANVAS_ZONE_MIN.w));
  let w = Math.max(CANVAS_ZONE_MIN.w, Math.min(b.w, 100 - x - g));
  if (x + w > 100 - g) w = Math.max(CANVAS_ZONE_MIN.w, 100 - g - x);
  x = Math.max(g, Math.min(x, 100 - g - w));
  let y = Math.max(g, Math.min(b.y, 100 - g - CANVAS_ZONE_MIN.h));
  let h = Math.max(CANVAS_ZONE_MIN.h, Math.min(b.h, 100 - y - g));
  if (y + h > 100 - g) h = Math.max(CANVAS_ZONE_MIN.h, 100 - g - y);
  y = Math.max(g, Math.min(y, 100 - g - h));
  return clampRect({ x, y, w, h });
}

function estimateWrappedLines(chars, nlLines, availW_px, fsPx, charWidthFactor = 0.5) {
  if ((chars ?? 0) <= 0) return Math.max(1, nlLines);
  const cpl = Math.max(8, Math.floor(availW_px / Math.max(fsPx * 0.35, fsPx * charWidthFactor)));
  return Math.max(nlLines, Math.ceil(chars / cpl));
}

/**
 * Mantém zonas dentro da margem do canvas e aumenta molduras até o texto caber (~ClassicCanvasInner + sanduíche canvas).
 */
function finalizeCanvasMarginsForAutoAdjust(mergedSlide, f) {
  const cv = mergedSlide.canvas;
  if (!cv?.zones || typeof cv.zones !== 'object' || !cv.variant) return null;

  const edgePct = typeof f.edgePct === 'number' ? f.edgePct : CANVAS_AUTO_EDGE_PCT;
  const topSafePct = typeof f.topSafePct === 'number' ? f.topSafePct : 14;

  const baselineInsetPad = mergedSlide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
  const insetCalc = Math.max(CANVAS_AUTO_TEXT_INSET_MIN, baselineInsetPad);
  const padXpx = f.w * (0.012 + insetCalc * 0.004);
  const padYpx = f.h * (0.006 + insetCalc * 0.004);
  const padYMarg = padYpx * 2;

  const titleChars = String(mergedSlide.title ?? '').trim().length;
  const subChars = String(mergedSlide.subtitle ?? '').trim().length;
  const bodyChars = String(mergedSlide.bodyAfterImage ?? '').trim().length;

  const titleLinesNl = Math.max(
    1,
    String(mergedSlide.title ?? '').split('\n').filter((ln) => String(ln).trim().length > 0).length,
  );
  const subLinesNl = Math.max(1, String(mergedSlide.subtitle ?? '').split('\n').length);
  const bodyLinesNl = Math.max(1, String(mergedSlide.bodyAfterImage ?? '').split(/\n/).length);

  const ts = mergedSlide.titleSize ?? 100;
  const ss = mergedSlide.subSize ?? 100;
  const bs = mergedSlide.bodyAfterSize ?? mergedSlide.subSize ?? 100;
  const tLeadClassic = (mergedSlide.titleLeading ?? 105) / 100;
  const sLeadClassic = (mergedSlide.subLeading ?? 150) / 100;
  const tLeadCv = (mergedSlide.titleLeading ?? 105) / 100;
  const subLeadCv = (mergedSlide.subLeading ?? 142) / 100;
  const bodyLeadCv = (mergedSlide.subLeading ?? 145) / 100;

  const bottomLim = Math.min(100 - edgePct, 99);
  const TOP_SAFE_PCT = topSafePct;
  /** Espaços verticais harmónicos (% da altura do card) entre molduras. */
  const gapTitleSub = 1.35;
  const gapPhotoTitle = 1.6;

  let zones = { ...cv.zones };

  if (cv.variant === 'classic') {
    const prevP = clampRect(zones.photo || DEFAULT_CANVAS_ZONES_CLASSIC.photo);
    const prevT = clampRect(zones.title || DEFAULT_CANVAS_ZONES_CLASSIC.title);
    const prevS = clampRect(zones.subtitle || DEFAULT_CANVAS_ZONES_CLASSIC.subtitle);
    /** Foto atrás tipo capa (`h`≈100%): texto reorganiza como bloco inferior. */
    const fullBleedPhoto = prevP.h >= 89 && prevP.y <= 2 && prevP.w >= 92;
    /** Foto só na faixa superior: título vinha logo abaixo da foto. */
    const bandPhoto = prevP.y + prevP.h <= prevT.y + 1.5;

    const ux = edgePct;
    const uw = Math.max(CANVAS_ZONE_MIN.w * 4, 100 - 2 * edgePct);

    const titleFs = f.w * 0.084 * (ts / 100);
    const innerTW = Math.max(f.w * 0.06, (uw / 100) * f.w - 2 * padXpx);
    const titleLinesEff = estimateWrappedLines(titleChars, titleLinesNl, innerTW, titleFs, 0.52);
    let needTitlePct = Math.min(
      44,
      ((titleLinesEff * titleFs * tLeadClassic + padYMarg + titleFs * 0.38) / f.h) * 100,
    );
    needTitlePct = Math.max(CANVAS_ZONE_MIN.h, needTitlePct);

    const subFs = f.w * 0.028 * (ss / 100);
    const innerSW = Math.max(f.w * 0.06, (uw / 100) * f.w - 2 * padXpx);
    const paras = Math.max(subLinesNl, String(mergedSlide.subtitle ?? '').split(/\n\n+/).filter((p) => p.trim()).length);
    const subLinesEff = estimateWrappedLines(subChars, Math.max(subLinesNl, paras), innerSW, subFs, 0.47);
    let needSubPct = Math.min(
      52,
      ((subLinesEff * subFs * sLeadClassic + padYMarg + subFs * 0.28) / f.h) * 100,
    );
    needSubPct = Math.max(CANVAS_ZONE_MIN.h, needSubPct);

    let photo = { ...prevP };
    let title = { ...tightenCanvasTextZoneRect(prevT), x: ux, w: uw };
    let subtitle = { ...tightenCanvasTextZoneRect(prevS), x: ux, w: uw };

    if (fullBleedPhoto) {
      photo = clampRect({ x: 0, y: 0, w: 100, h: 100 });
      let subY = bottomLim - needSubPct;
      let titY = subY - gapTitleSub - needTitlePct;
      if (titY < TOP_SAFE_PCT) {
        const shortfall = TOP_SAFE_PCT - titY;
        const roomFromSub = Math.max(0, needSubPct - CANVAS_ZONE_MIN.h - 1.2);
        const roomFromTit = Math.max(0, needTitlePct - CANVAS_ZONE_MIN.h - 1.2);
        const takeS = Math.min(roomFromSub, shortfall * 0.45);
        const takeT = Math.min(roomFromTit, shortfall - takeS);
        needSubPct = Math.max(CANVAS_ZONE_MIN.h, needSubPct - takeS);
        needTitlePct = Math.max(CANVAS_ZONE_MIN.h, needTitlePct - takeT);
        subY = bottomLim - needSubPct;
        titY = subY - Math.max(0.65, gapTitleSub * 0.65) - needTitlePct;
        if (titY < TOP_SAFE_PCT) titY = TOP_SAFE_PCT;
      }
      title = { ...title, y: titY, h: needTitlePct };
      subtitle = { ...subtitle, y: subY, h: needSubPct };
    } else if (bandPhoto) {
      let photoTop = Math.max(0, prevP.y);
      let photoH = Math.max(CANVAS_ZONE_MIN.h, prevP.h);
      let titY = photoTop + photoH + gapPhotoTitle;
      let subY = titY + needTitlePct + gapTitleSub;
      let over = subY + needSubPct - bottomLim;
      if (over > 0) {
        photoH = Math.max(CANVAS_ZONE_MIN.h, photoH - Math.min(over + 1, photoH - CANVAS_ZONE_MIN.h));
        titY = photoTop + photoH + gapPhotoTitle;
        subY = titY + needTitlePct + gapTitleSub;
        over = subY + needSubPct - bottomLim;
        if (over > 0) {
          needSubPct = Math.max(CANVAS_ZONE_MIN.h, needSubPct - over);
          subY = Math.min(subY, bottomLim - needSubPct);
          titY = subY - gapTitleSub - needTitlePct;
        }
      }
      if (titY < TOP_SAFE_PCT) titY = TOP_SAFE_PCT;
      photo = clampRect({
        ...prevP,
        y: photoTop,
        h: photoH,
        x: prevP.x,
        w: prevP.w,
      });
      title = { ...title, y: titY, h: needTitlePct };
      subtitle = { ...subtitle, y: subY, h: needSubPct };
    } else {
      /** Caso intermediário ou molduras livres — ancora subtítulo ao fundo e sobe o título, alinhando larguras. */
      let subY = bottomLim - needSubPct;
      let titY = subY - gapTitleSub - needTitlePct;
      if (titY < TOP_SAFE_PCT) titY = TOP_SAFE_PCT;
      if (titY + needTitlePct + gapTitleSub + needSubPct > bottomLim + 0.2) {
        needSubPct = Math.max(CANVAS_ZONE_MIN.h, bottomLim - (titY + needTitlePct + gapTitleSub));
        subY = bottomLim - needSubPct;
      }
      title = { ...title, y: titY, h: needTitlePct };
      subtitle = { ...subtitle, y: subY, h: needSubPct };
      let over = subtitle.y + subtitle.h - bottomLim;
      if (over > 0.12) {
        subtitle = { ...subtitle, h: Math.max(CANVAS_ZONE_MIN.h, subtitle.h - over) };
      }
      over = Math.max(0, subtitle.y + subtitle.h - bottomLim);
      if (photo.h < 99) {
        const shave = Math.min(
          over + 0.85,
          Math.max(0, photo.h - CANVAS_ZONE_MIN.h),
        );
        if (shave > 0) {
          photo = {
            ...photo,
            h: Math.max(CANVAS_ZONE_MIN.h, photo.h - shave),
          };
        }
      }
    }

    zones = { ...zones, photo: clampRect(photo), title: clampRect(title), subtitle: clampRect(subtitle) };
  } else if (cv.variant === 'sandwich') {
    const ux = CANVAS_AUTO_EDGE_PCT;
    const uw = Math.max(CANVAS_ZONE_MIN.w * 4, 100 - 2 * CANVAS_AUTO_EDGE_PCT);
    const prevTp = clampRect(zones.top || DEFAULT_CANVAS_ZONES_SANDWICH.top);
    const prevPh = clampRect(zones.photo || DEFAULT_CANVAS_ZONES_SANDWICH.photo);
    const prevBt = clampRect(zones.bottom || DEFAULT_CANVAS_ZONES_SANDWICH.bottom);

    const gapTP = Math.max(1.1, prevPh.y - (prevTp.y + prevTp.h));
    const gapPB = Math.max(1.1, prevBt.y - (prevPh.y + prevPh.h));

    const needTopMin =
      titleChars > 0 || subChars > 0 ? SANDWICH_TEXT_ZONE_MIN_H_PCT : CANVAS_ZONE_MIN.h;
    const needBotMin =
      bodyChars > 0 ? SANDWICH_TEXT_ZONE_MIN_H_PCT : CANVAS_ZONE_MIN.h;

    const innerUw = Math.max(f.w * 0.06, (uw / 100) * f.w - 2 * padXpx);
    const titFs = f.w * 0.036 * (ts / 100);
    const subFsTop = f.w * 0.031 * (ss / 100);
    const titleStackLines = estimateWrappedLines(titleChars, titleLinesNl, innerUw, titFs, 0.48);
    const subStackLines = estimateWrappedLines(subChars, subLinesNl, innerUw, subFsTop, 0.45);
    const stackGapPx = Math.max(f.h * 0.012, titFs * 0.22);
    let blkTopH = Math.min(
      58,
      ((padYMarg +
        titleStackLines * titFs * tLeadCv +
        stackGapPx +
        subStackLines * subFsTop * subLeadCv +
        titFs * 0.22) /
        f.h) *
        100,
    );
    blkTopH = Math.max(needTopMin, blkTopH);

    const bodyFs = f.w * 0.029 * (bs / 100);
    const bodyParas = Math.max(bodyLinesNl, String(mergedSlide.bodyAfterImage ?? '').split(/\n\n+/).filter((p) => p.trim()).length);
    const bodyEffLines = estimateWrappedLines(bodyChars, Math.max(bodyLinesNl, bodyParas), innerUw, bodyFs, 0.45);
    let blkBotH = Math.min(
      58,
      ((bodyEffLines * bodyFs * bodyLeadCv + padYMarg + bodyFs * 0.26) / f.h) * 100,
    );
    blkBotH = Math.max(needBotMin, Math.max(prevBt.h, blkBotH));

    const topY = CANVAS_AUTO_EDGE_PCT;
    const photoFloor = SANDWICH_PHOTO_ZONE_MIN_H_PCT;
    const photoAbsMin = SANDWICH_PHOTO_ZONE_ABSOLUTE_MIN_H_PCT;
    let photoY = topY + blkTopH + gapTP;
    let botY = bottomLim - blkBotH;
    let photoH = botY - gapPB - photoY;

    for (let iter = 0; iter < 120 && photoH < photoFloor; iter++) {
      if (blkBotH > needBotMin + 0.6) blkBotH -= 1.2;
      else if (blkTopH > needTopMin + 0.6) blkTopH -= 1.2;
      else break;
      photoY = topY + blkTopH + gapTP;
      botY = bottomLim - blkBotH;
      photoH = botY - gapPB - photoY;
    }
    if (photoH < photoFloor) {
      photoH = photoFloor;
      const maxPhotoY = bottomLim - needBotMin - gapPB - photoH;
      if (photoY > maxPhotoY) {
        blkTopH = Math.max(needTopMin, blkTopH - (photoY - maxPhotoY));
        photoY = topY + blkTopH + gapTP;
      }
      botY = photoY + photoH + gapPB;
      blkBotH = bottomLim - botY;
    }

    /** Garante altura útil mínima para o texto inferior (encolhe foto e só depois o topo). */
    const rebalanceForTextMin = () => {
      botY = photoY + photoH + gapPB;
      blkBotH = bottomLim - botY;
      let guard = 0;
      while (blkBotH + 0.08 < needBotMin && guard < 90) {
        guard += 1;
        if (photoH > photoAbsMin + 0.35) {
          photoH -= 0.95;
        } else if (blkTopH > needTopMin + 0.35) {
          blkTopH -= 0.95;
          photoY = topY + blkTopH + gapTP;
        } else {
          break;
        }
        botY = photoY + photoH + gapPB;
        blkBotH = bottomLim - botY;
      }
    };
    rebalanceForTextMin();

    const top = clampRect({ ...prevTp, x: ux, w: uw, y: topY, h: blkTopH });
    const photo = clampRect({ ...prevPh, x: ux, w: uw, y: photoY, h: photoH });
    const bottom = clampRect({ ...prevBt, x: ux, w: uw, y: botY, h: blkBotH });

    zones = { ...zones, top, photo, bottom };
  } else if (cv.variant === 'stat') {
    const ux = CANVAS_AUTO_EDGE_PCT;
    const uw = Math.max(CANVAS_ZONE_MIN.w * 4, 100 - 2 * CANVAS_AUTO_EDGE_PCT);
    const prevTp = clampRect(zones.top || DEFAULT_CANVAS_ZONES_STAT.top);
    const prevBt = clampRect(zones.bottom || DEFAULT_CANVAS_ZONES_STAT.bottom);
    const gapTB = Math.max(1.1, prevBt.y - (prevTp.y + prevTp.h));

    const statNeedTop =
      titleChars > 0 || subChars > 0 ? SANDWICH_TEXT_ZONE_MIN_H_PCT : CANVAS_ZONE_MIN.h;
    const statNeedBot =
      bodyChars > 0 ? SANDWICH_TEXT_ZONE_MIN_H_PCT : CANVAS_ZONE_MIN.h;

    const innerUw = Math.max(f.w * 0.06, (uw / 100) * f.w - 2 * padXpx);
    const titFs = f.w * 0.036 * (ts / 100);
    const subFsTop = f.w * 0.031 * (ss / 100);
    const titleStackLines = estimateWrappedLines(titleChars, titleLinesNl, innerUw, titFs, 0.48);
    const subStackLines = estimateWrappedLines(subChars, subLinesNl, innerUw, subFsTop, 0.45);
    const stackGapPx = Math.max(f.h * 0.012, titFs * 0.22);
    let blkTopH = Math.min(
      62,
      ((padYMarg +
        titleStackLines * titFs * tLeadCv +
        stackGapPx +
        subStackLines * subFsTop * subLeadCv +
        titFs * 0.22) /
        f.h) *
        100,
    );
    blkTopH = Math.max(statNeedTop, blkTopH);

    const bodyFsStat = f.w * 0.029 * (bs / 100);
    const bodyParas = Math.max(bodyLinesNl, String(mergedSlide.bodyAfterImage ?? '').split(/\n\n+/).filter((p) => p.trim()).length);
    const bodyEffLines = estimateWrappedLines(bodyChars, Math.max(bodyLinesNl, bodyParas), innerUw, bodyFsStat, 0.45);
    let blkBotH = Math.min(
      58,
      ((bodyEffLines * bodyFsStat * bodyLeadCv + padYMarg + bodyFsStat * 0.26) / f.h) * 100,
    );
    blkBotH = Math.max(statNeedBot, Math.max(prevBt.h, blkBotH));

    const topY = CANVAS_AUTO_EDGE_PCT;
    let botY = topY + blkTopH + gapTB;
    let space = bottomLim - botY;
    if (blkBotH > space - 0.35) blkBotH = Math.max(statNeedBot, space - 0.35);
    if (topY + blkTopH + gapTB + blkBotH > bottomLim) {
      blkTopH = Math.max(statNeedTop, bottomLim - gapTB - blkBotH - topY);
    }

    const top = clampRect({ ...prevTp, x: ux, w: uw, y: topY, h: blkTopH });
    botY = top.y + top.h + gapTB;
    blkBotH = Math.min(blkBotH, Math.max(statNeedBot, bottomLim - botY - 0.35));
    const bot = clampRect({ ...prevBt, x: ux, w: uw, y: botY, h: blkBotH });

    zones = { ...zones, top, bottom: bot };
  }

  return {
    zones,
    textInsetAdvice: insetCalc > baselineInsetPad ? insetCalc : null,
  };
}

export {
  DEFAULT_SLIDE_TEXT_INSET,
  CANVAS_ZONE_MIN,
  SANDWICH_PHOTO_ZONE_MIN_H_PCT,
  SANDWICH_PHOTO_ZONE_ABSOLUTE_MIN_H_PCT,
  SANDWICH_TEXT_ZONE_MIN_H_PCT,
  clampRect,
  DEFAULT_CANVAS_ZONES_CLASSIC,
  DEFAULT_CANVAS_ZONES_SANDWICH,
  DEFAULT_CANVAS_ZONES_STAT,
  CANVAS_AUTO_EDGE_PCT,
  CANVAS_AUTO_TEXT_INSET_MIN,
  tightenCanvasTextZoneRect,
  estimateWrappedLines,
  finalizeCanvasMarginsForAutoAdjust,
};
