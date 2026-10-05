/** Dimensões de export por formato — Feed 4:5, Quadrado, Stories, Apresentação 16:9. */
export const FORMATS = {
  carrossel: { w: 1080, h: 1350, label: 'Feed 4:5', edgePct: 8, topSafePct: 14, bottomSafePct: 8 },
  quadrado:  { w: 1080, h: 1080, label: 'Quadrado', edgePct: 8, topSafePct: 12, bottomSafePct: 8 },
  stories:   { w: 1080, h: 1920, label: 'Stories',  edgePct: 8, topSafePct: 14, bottomSafePct: 18 },
  /** Deck landscape estilo Gamma / pitch — PDF nativo em landscape. */
  apresentacao: { w: 1920, h: 1080, label: 'Apresentação 16:9', edgePct: 7, topSafePct: 10, bottomSafePct: 10 },
};

export function isPresentationFormat(fmt) {
  return fmt === 'apresentacao';
}
