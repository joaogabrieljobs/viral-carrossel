import { describe, expect, it } from 'vitest';
import { applyFreeSocialDesign } from '../../src/utils/social-free-design.js';
import { reconcileFreeImageDocument, reconcileFreeImageFallback } from '../../src/utils/free-image-fallback.js';

function deck(formato = 'carrossel') {
  return applyFreeSocialDesign([
    { id: 'cover', title: 'O Carnaval começa antes', subtitle: 'Conheça a Apoteose.' },
    { id: 'content', title: 'Um encontro que fica', subtitle: 'Música, arte e gente.', bodyAfterImage: 'O Carnaval começa antes.' },
    { id: 'close', title: 'Salve para acompanhar', subtitle: 'Veja os próximos encontros.' },
  ].map(slide => ({ ...slide, imageQuery: '', socialFreeDesign: { family: 'editorial', ground: 'art', photo: 'none', block: 'none' } })), {
    preset: 'social_free', formato,
  });
}
const uploaded = slide => ({ ...slide, bgImageId: 'own-photo', bgImage: 'data:image/png;base64,USERPHOTO',
  bgImageSource: 'imported', bgImageFailed: false, bgX: 31, bgY: 62, bgZoom: 117, bgFit: 'cover' });

describe('Livre social: foto enviada depois da geração', () => {
  it.each(['carrossel', 'quadrado', 'stories'])('abre espaço para a foto no %s sem reescrever texto, mídia ou outros cards', formato => {
    const before = deck(formato);
    const incoming = before.map((slide, index) => index === 1 ? uploaded(slide) : slide);
    const result = reconcileFreeImageFallback(before, incoming);
    const target = result[1];
    expect(target.socialFreeDesign.photo).not.toBe('none');
    expect(target.socialFreeDesign.ground).not.toBe('art');
    expect(target.canvas.zones.photo.w).toBeGreaterThan(0);
    expect(target.canvas.zones.photo.h).toBeGreaterThan(0);
    expect(target.presentationSuppressPhoto).toBe(false);
    expect(target).toMatchObject({
      id: 'content', title: before[1].title, subtitle: before[1].subtitle, bodyAfterImage: before[1].bodyAfterImage,
      bgImageId: 'own-photo', bgImage: 'data:image/png;base64,USERPHOTO', bgImageSource: 'imported',
      bgX: 31, bgY: 62, bgZoom: 117, bgFit: 'cover',
    });
    expect(result[0]).toBe(before[0]);
    expect(result[2]).toBe(before[2]);
    expect(result.map(slide => slide.id)).toEqual(before.map(slide => slide.id));
  });

  it('não recompõe documento salvo, nem ao hidratar os bytes da mesma imagem', () => {
    const saved = deck();
    saved[1] = { ...saved[1], bgImageId: 'saved-photo', bgImageSource: 'imported' };
    expect(reconcileFreeImageFallback(saved, saved)).toBe(saved);
    const hydrated = saved.map((slide, index) => index === 1 ? { ...slide, bgImage: 'data:image/png;base64,EXISTING' } : slide);
    expect(reconcileFreeImageFallback(saved, hydrated)).toBe(hydrated);
  });

  it('preserva zonas manuais, corte e ajustes por formato ao revelar a nova foto', () => {
    const before = deck('stories');
    const zones = { ...before[1].canvas.zones, photo: { x: 12, y: 48, w: 76, h: 26 } };
    before[1] = { ...before[1], canvas: { ...before[1].canvas, userEdited: true, zones } };
    const formatViews = { quadrado: { slides: { content: { titleSize: 77, elementOffsets: { title: { x: 2, y: 3 } } } } } };
    const previous = { fmt: 'stories', slides: before, formatViews };
    const result = reconcileFreeImageDocument(previous, { ...previous, slides: before.map((slide, index) => index === 1 ? uploaded(slide) : slide) });
    expect(result.slides[1].canvas.zones).toEqual(zones);
    expect(result.slides[1].canvas.userEdited).toBe(true);
    expect(result.slides[1].presentationSuppressPhoto).toBe(false);
    expect(result.formatViews).toBe(formatViews);
    expect(result.slides[1]).toMatchObject({ bgX: 31, bgY: 62, bgZoom: 117 });
  });
});
