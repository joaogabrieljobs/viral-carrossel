import { FORMATS } from './formats.js';

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
  return {
    ...source,
    layout: 'tl',
    align: 'left',
    photoRegion: 'full',
    bgFit: 'cover',
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
}
