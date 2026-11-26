import { describe, expect, it } from 'vitest';
import { applyFreeSocialDesign } from '../../src/utils/social-free-design.js';
import { applyFormatEdit, slideForFormatDisplay } from '../../src/utils/format-view.js';
import { reconcileFreeImageDocument } from '../../src/utils/free-image-fallback.js';

function manualView(formato, canonicalFormat = 'carrossel') {
  const slides = applyFreeSocialDesign(Array.from({ length: 3 }, (_, index) => ({
    id: `manual-view-${index}`, title: 'Um encontro que fica', subtitle: 'Música, arte e gente.',
    bodyAfterImage: 'Preserve este apoio.', imageQuery: '',
    socialFreeDesign: { family: 'editorial', ground: 'art', photo: 'none', block: 'none' },
  })), { preset: 'social_free', formato: canonicalFormat });
  const original = { fmt: formato, slides, formatViews: {} };
  const shown = slideForFormatDisplay(slides[1], formato, original.formatViews);
  const canvas = { ...shown.canvas, userEdited: true, zones: { ...shown.canvas.zones,
    title: { x: 11, y: 25, w: 70, h: 20 }, subtitle: { x: 11, y: 50, w: 70, h: 12 },
  } };
  return applyFormatEdit(original, 1, { canvas, elementOffsets: { title: { x: 1, y: 2 } } });
}

const incomingPhoto = { bgImage: 'data:image/png;base64,NEW_USER_PHOTO', bgImageId: 'new-user-photo', bgImageSource: 'imported' };
const visible = doc => slideForFormatDisplay(doc.slides[1], doc.fmt, doc.formatViews);

describe('Livre social: upload novo na vista manual derivada', () => {
  it.each([
    ['stories', 'carrossel'], ['quadrado', 'carrossel'], ['carrossel', 'stories'],
  ])('%s: revela a foto preservando caixas de texto, offsets e outras vistas', (formato, canonicalFormat) => {
    const previous = manualView(formato, canonicalFormat);
    const before = visible(previous);
    const otherFormat = formato === 'quadrado' ? 'stories' : 'quadrado';
    const otherView = { slides: { [before.id]: { titleSize: 77 } } };
    previous.formatViews[otherFormat] = otherView;
    const next = reconcileFreeImageDocument(previous, applyFormatEdit(previous, 1, incomingPhoto));
    const shown = visible(next);
    expect(shown.bgImageId).toBe(incomingPhoto.bgImageId);
    expect(shown.canvas.zones.photo.w * shown.canvas.zones.photo.h).toBeGreaterThan(400);
    expect(shown.presentationSuppressPhoto).not.toBe(true);
    expect(shown.canvas.userEdited).toBe(true);
    expect(shown.canvas.zones.title).toEqual(before.canvas.zones.title);
    expect(shown.canvas.zones.subtitle).toEqual(before.canvas.zones.subtitle);
    expect(shown.elementOffsets).toEqual(before.elementOffsets);
    for (const key of ['title', 'subtitle', 'bodyAfterImage', 'eyebrowText']) expect(shown[key]).toEqual(before[key]);
    expect(next.formatViews[otherFormat]).toBe(otherView);
    expect(next.slides[0]).toBe(previous.slides[0]);
    expect(next.slides[2]).toBe(previous.slides[2]);
  });

  it('hidratação da mesma mídia não recompõe uma vista manual salva', () => {
    const previous = manualView('stories');
    previous.slides[1] = { ...previous.slides[1], bgImageId: 'saved-photo', bgImageSource: 'imported' };
    const hydrated = applyFormatEdit(previous, 1, { bgImage: 'data:image/png;base64,SAVED_BYTES' });
    const next = reconcileFreeImageDocument(previous, hydrated);
    expect(next).toBe(hydrated);
    expect(next.formatViews).toBe(previous.formatViews);
  });

  it('não reativa o Livre na vista que escolheu um estilo fixo', () => {
    const previous = manualView('stories');
    const entry = previous.formatViews.stories.slides[previous.slides[1].id];
    Object.assign(entry, { socialFreeDesign: null, socialPlan: null, socialPresetId: null,
      socialArt: null, socialComposition: null, socialCompositionVersion: null, visualPresetId: 'social_revista' });
    const next = reconcileFreeImageDocument(previous, applyFormatEdit(previous, 1, incomingPhoto));
    expect(next.formatViews).toBe(previous.formatViews);
    expect(visible(next).socialFreeDesign).toBeNull();
    expect(visible(next).visualPresetId).toBe('social_revista');
  });
});
