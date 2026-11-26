import { describe, expect, it } from 'vitest';
import { freePresentationCompositionOverrides } from '../../src/utils/free-design.js';
import { reconcileFreeImageFallback } from '../../src/utils/free-image-fallback.js';
import { applyFreeSlideImageToStoredProject } from '../../src/utils/free-image-persistence.js';
import { applySlideImageToStoredProject, slideImageIdentity } from '../../src/utils/image-store.js';

function fixture() {
  const content = {
    id: 'slide-6', title: 'Brasil na pista', subtitle: 'A música aproxima as pessoas.',
    bodyAfterImage: 'Um encontro brasileiro e contemporâneo.', eyebrow: 'A MÚSICA',
    imageQuery: 'A DJ wearing headphones in an intimate club',
    presentationPlan: { visualRole: 'content', purpose: 'context', design: {
      family: 'editorial', ground: 'bg', photo: 'half', block: 'none', emphasis: [], icons: [],
    } },
  };
  const original = { ...content, ...freePresentationCompositionOverrides({}, { slide: content, index: 5, count: 10 }) };
  const slides = Array.from({ length: 10 }, (_, i) => i === 5 ? original : { id: `context-${i}`, title: `Título ${i}` });
  const failed = reconcileFreeImageFallback(slides, slides.map((s, i) => i === 5 ? { ...s, bgImageFailed: true, bgImageError: 'timeout' } : s));
  const other = { id: 'open-project', name: 'Projeto aberto', doc: { slides: [{ id: 'other', title: 'Outro conteúdo', bgImageId: 'user-photo' }] } };
  const library = [{ id: 'origin', name: 'Apoteose', doc: { slides: failed, caption: 'Legenda original', visualPreset: 'presentation_free' } }, other];
  const target = {
    id: original.id, expectedImageIdentity: slideImageIdentity(failed[5]),
    patch: { bgImageId: 'generated-new', bgImage: 'blob:current-session/new-photo', bgImageSource: 'ai', bgImageFailed: false, bgImageError: null },
  };
  return { original, failed, library, target };
}

describe('Teste 7: imagem concluída no projeto de origem', () => {
  it('restaura o layout da foto após trocar de projeto, sem esperar reabertura', () => {
    const { original, library, target } = fixture();
    const before = JSON.stringify(library);
    const result = applyFreeSlideImageToStoredProject(library, 'origin', target);
    const saved = result.library[0].doc.slides[5];
    expect(result.applied).toBe(true);
    expect(saved.bgImageId).toBe('generated-new');
    expect(saved.presentationImageFallback).toBeUndefined();
    expect(saved.presentationFreeDesign).toEqual(original.presentationFreeDesign);
    expect(saved.canvas.zones.photo).toEqual(original.canvas.zones.photo);
    expect(saved.presentationSuppressPhoto).toBe(false);
    expect(JSON.stringify(library)).toBe(before);
  });

  it('recusa o resultado atrasado se a pessoa já colocou outra foto no slide', () => {
    const { library, target } = fixture();
    const origin = library[0];
    origin.doc.slides[5] = { ...origin.doc.slides[5], bgImageId: 'photo-added-by-user', bgImageSource: 'imported', bgImageFailed: false, bgImageError: null };
    const result = applyFreeSlideImageToStoredProject(library, 'origin', target);
    expect(result.applied).toBe(false);
    expect(result.library).toBe(library);
    expect(result.library[0].doc.slides[5].bgImageId).toBe('photo-added-by-user');
  });

  it('preserva outros projetos, demais slides, texto e edição manual posterior à falha', () => {
    const { original, library, target } = fixture();
    const source = library[0].doc.slides[5];
    library[0].doc.slides[5] = {
      ...source, title: 'Título editado durante a geração', customBg: '#352160',
      canvas: { ...source.canvas, zones: { ...source.canvas.zones, title: { ...source.canvas.zones.title, x: 12 } } },
    };
    const result = applyFreeSlideImageToStoredProject(library, 'origin', target);
    const saved = result.library[0].doc.slides[5];
    expect(result.library[1]).toBe(library[1]);
    expect(result.library[0].doc.slides[2]).toBe(library[0].doc.slides[2]);
    expect(result.library[0].doc.caption).toBe('Legenda original');
    expect(saved.title).toBe('Título editado durante a geração');
    expect(saved.subtitle).toBe(source.subtitle);
    expect(saved.bodyAfterImage).toBe(source.bodyAfterImage);
    expect(saved.imageQuery).toBe(source.imageQuery);
    expect(saved.customBg).toBe('#352160');
    expect(saved.canvas.zones.title.x).toBe(12);
    expect(saved.canvas.zones.photo).toEqual(original.canvas.zones.photo);
    expect(saved.presentationImageFallback).toBeUndefined();
  });

  it('mantém a aplicação existente para presets comuns e projeto não encontrado', () => {
    const library = [{ id: 'common', doc: { slides: [{ id: 'card', title: 'Composição comum', canvas: { enabled: true, zones: {} } }] } }];
    const target = { id: 'card', expectedImageIdentity: 'none', patch: { bgImageId: 'photo', bgImageFailed: false } };
    expect(applyFreeSlideImageToStoredProject(library, 'common', target)).toEqual(applySlideImageToStoredProject(library, 'common', target));
    expect(applyFreeSlideImageToStoredProject(library, 'missing', target)).toEqual({ applied: false, library });
  });
});
