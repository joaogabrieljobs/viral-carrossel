const box = (x, y, w, h) => ({ x, y, w, h });
const PHOTO_ESSAY = new Set(['editorial_magazine', 'mood_sepia', 'reflexivo_cream', 'cinematic_hybrid']);

/** Composições editáveis para presets sociais; nunca reescreve conteúdo. */
export function applySocialVisualComposition(slides, { preset, photoRegion = 'full' } = {}) {
  if (!preset || preset.isCustom || preset.productKind === 'apresentacao' || photoRegion !== 'full') return slides;
  const editorial = PHOTO_ESSAY.has(preset.id);
  return slides.map((slide, index) => {
    const photo = !!(slide.imageQuery || slide.bgImage || slide.bgImageId || slide.bgImageAssetId);
    const cover = index === 0;
    const close = index === slides.length - 1 && !cover;
    const fullBleed = photo && (cover || (close && !editorial));
    const portrait = photo && !fullBleed && editorial;
    const zones = fullBleed ? {
      photo: box(0, 0, 100, 100), title: box(7, 47, 86, 28), subtitle: box(7, 77, 86, 14),
    } : portrait ? {
      photo: box(0, 0, 46, 100), title: box(51, 17, 43, 32), subtitle: box(51, 53, 43, 36),
    } : photo ? {
      photo: box(0, 0, 100, 49), title: box(7, 53, 86, 20), subtitle: box(7, 76, 86, 14),
    } : {
      photo: box(96, 94, 1, 1), title: box(8, cover ? 24 : 20, 84, 30), subtitle: box(8, 55, 84, 34),
    };
    return {
      ...slide,
      useCultureLayout: false,
      layout: fullBleed ? 'bl' : 'tl', align: 'left',
      photoRegion: 'full', photoFraming: 'auto', bgFit: 'cover', overlay: fullBleed ? 62 : 0,
      textInset: 0, textShadow: fullBleed,
      titleSize: fullBleed ? 88 : portrait ? 66 : 76,
      subSize: portrait ? 100 : 108, bodyAfterSize: 140,
      titleLeading: 110, subLeading: 138,
      socialVisualPresetId: preset.id,
      socialComposition: fullBleed ? 'cover-photo' : portrait ? 'portrait-editorial' : photo ? 'photo-story' : 'typographic',
      canvas: { enabled: false, applied: true, variant: 'classic', source: 'social-preset', preserveZones: true, zones },
    };
  });
}
