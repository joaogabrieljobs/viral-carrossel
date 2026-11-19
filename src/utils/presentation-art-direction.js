/**
 * Direção de arte determinística. O modelo fornece conteúdo e a função da
 * página; geometria, tipo e linguagem gráfica vêm de presentation-families.js.
 * Este arquivo mantém a API anterior para os chamadores existentes.
 */
import {
  familyFromPresetId, familyLayout, normalizeFamilyKey, rendererSubtitleSizePercent,
  rendererTitleSizePercent,
} from './presentation-families.js';

const inactivePhoto = () => ({ x: 96, y: 94, w: 1, h: 1 });

export function presentationFamily(id = '') {
  return familyFromPresetId(id);
}

/** Layout completo (zonas, tipo, chão, chrome) para a página. */
export function presentationArtLayout(kind, slide = {}, family, { visual, structured, format = '16:9' } = {}) {
  const reading = String(slide.subtitle || '').length + String(slide.bodyAfterImage || '').length * 0.8;
  return familyLayout(normalizeFamilyKey(family), kind, { format, photo: !!visual, structured: !!structured, title: slide.title, reading });
}

/** Zonas no formato que o renderer grava em `canvas.zones`. */
export function artDirectedPresentationZones(kind, slide, family, { visual, structured, format = '16:9' } = {}) {
  const layout = presentationArtLayout(kind, slide, family, { visual, structured, format });
  return {
    title: layout.title,
    subtitle: layout.subtitle,
    photo: layout.photo || inactivePhoto(),
    ...(layout.evidence ? { evidence: layout.evidence } : {}),
  };
}

/** Tamanhos na escala do renderer (título: % de 0,084·w; apoio: % de 0,028·w). */
export function presentationTypeDirection(family, kind, { format = '16:9', visual = false, structured = false } = {}) {
  const layout = familyLayout(normalizeFamilyKey(family), kind, { format, photo: visual, structured });
  return {
    titleSize: rendererTitleSizePercent(layout.titlePx, format),
    bodySize: rendererSubtitleSizePercent(layout.bodyPx, format),
  };
}
