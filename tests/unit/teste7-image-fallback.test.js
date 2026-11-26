import { describe, expect, it } from 'vitest';
import { getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { reconcileFreeImageFallback, freeImageGenerationSlide, reconcileFreeImageDocument } from '../../src/utils/free-image-fallback.js';
import { applyFormatEdit } from '../../src/utils/format-view.js';
import { wcagContrast } from '../../src/utils/wcag.js';

const photoSlide = () => {
  const content = {
    id: 'failed-photo', title: 'Brasil na pista', subtitle: 'A música reúne encontros, movimento e liberdade.',
    bodyAfterImage: 'Uma linguagem brasileira e contemporânea.', eyebrow: 'A MÚSICA',
    imageQuery: 'A DJ wearing headphones in an intimate club',
    presentationPlan: { visualRole: 'content', purpose: 'context', design: {
      family: 'editorial', ground: 'bg', photo: 'half', block: 'none', emphasis: [], icons: [],
    } },
  };
  return { ...content, ...getPresentationCompositionOverrides('presentation_free', {
    slide: content, index: 5, count: 10,
    deckDesign: { palette: { bg: '#2B2158', surface: '#0E0E0F', ink: '#FFFFFF', accent: '#F8701E', accent2: '#28B2D4' } },
  }) };
};
const fail = (s, reason = 'timeout') => {
  const deck = Array.from({ length: 10 }, (_, i) => i === 5 ? s : { id: `context-${i}` });
  return reconcileFreeImageFallback(deck, deck.map((slide, i) => i === 5 ? { ...slide, bgImageFailed: true, bgImageError: reason } : slide))[5];
};

describe('Teste 7: falha e recuperação da imagem pelo estado da geração', () => {
  it.each(['timeout', 'quota_exhausted', 'generation_failed', 'batch_generation_stopped'])('%s recompõe o slide com a paleta sem apagar o pedido ou o texto', reason => {
    const source = photoSlide();
    const result = fail(source, reason);
    expect(result.presentationFreeDesign.photo).toBe('none');
    expect(result.presentationSuppressPhoto).toBe(true);
    // A geometria sem foto usa uma caixa sentinela de 1%, suprimida no DOM.
    expect(result.canvas.zones.photo?.w || 0).toBeLessThanOrEqual(1);
    expect(result.canvas.zones.subtitle.w).toBeGreaterThan(source.canvas.zones.subtitle.w);
    expect(result.presentationImageFallback.reason).toBe(reason);
    expect(result.presentationImageFallback.originalDesign.photo).toBe(source.presentationFreeDesign.photo);
    for (const key of ['title', 'subtitle', 'bodyAfterImage', 'eyebrow', 'imageQuery', 'presentationPlan']) expect(result[key]).toEqual(source[key]);
    expect(wcagContrast(result.titleColor, result.customBg)).toBeGreaterThanOrEqual(4.5);
  });

  it('regeneração usa a composição original para pedir a foto e restaura o layout quando ela chega', () => {
    const source = photoSlide();
    const failed = fail(source);
    const requestSlide = freeImageGenerationSlide(failed);
    expect(requestSlide.canvas.zones).toEqual(source.canvas.zones);
    expect(requestSlide.presentationFreeDesign).toEqual(source.presentationFreeDesign);
    const ready = reconcileFreeImageFallback([failed], [{ ...failed, bgImageId: 'generated-new', bgImageSource: 'ai', bgImageFailed: false, bgImageError: null }])[0];
    expect(ready.presentationImageFallback).toBeUndefined();
    expect(ready.presentationFreeDesign).toEqual(source.presentationFreeDesign);
    expect(ready.canvas).toEqual(source.canvas);
    expect(ready.bgImageId).toBe('generated-new');
  });

  it('nova tentativa que falha não substitui a composição original por outra sem foto', () => {
    const source = photoSlide();
    const once = fail(source);
    const twice = fail(once, 'quota_exhausted');
    expect(twice.presentationImageFallback.originalDesign).toEqual(source.presentationFreeDesign);
    expect(twice.presentationImageFallback.reason).toBe('quota_exhausted');
  });

  it('uma nova tentativa explícita recompõe um slide legado já marcado como falho, sem mudar a reabertura', () => {
    const source = { ...photoSlide(), bgImageFailed: true, bgImageError: 'timeout' };
    expect(reconcileFreeImageFallback([source], [source])[0]).toBe(source);
    const failed = reconcileFreeImageFallback([source], [{ ...source, bgImageError: 'timeout' }], { failedSlideIds: [source.id] })[0];
    expect(failed.presentationFreeDesign.photo).toBe('none');
    expect(failed.presentationImageFallback.originalDesign.photo).toBe('half');
  });

  it('a foto importada pela edição do formato recupera a composição gravada e preserva ajustes da vista', () => {
    const source = photoSlide();
    const failed = fail(source);
    const doc = { fmt: 'apresentacao', slides: [failed], formatViews: { apresentacao: { slides: { [failed.id]: { titleSize: 77 } } } } };
    const edited = applyFormatEdit(doc, 0, { bgImageId: 'uploaded', bgImageSource: 'imported', bgImageFailed: false, bgImageError: null, photoFraming: 'auto' });
    const result = reconcileFreeImageDocument(doc, edited);
    expect(result.slides[0].presentationImageFallback).toBeUndefined();
    expect(result.slides[0].canvas.zones).toEqual(source.canvas.zones);
    expect(result.slides[0].bgImageId).toBe('uploaded');
    expect(result.formatViews.apresentacao.slides[failed.id].titleSize).toBe(77);
  });

  it('reabrir ou editar texto não recompõe um projeto salvo e a recuperação preserva edições posteriores', () => {
    const source = photoSlide();
    const failed = fail(source);
    const reopened = JSON.parse(JSON.stringify(failed));
    expect(reconcileFreeImageFallback([reopened], [reopened])[0]).toBe(reopened);
    const edited = { ...failed, title: 'Novo título', canvas: { ...failed.canvas, zones: { ...failed.canvas.zones, title: { ...failed.canvas.zones.title, x: 12 } } } };
    const ready = reconcileFreeImageFallback([edited], [{ ...edited, bgImageId: 'new', bgImageFailed: false }])[0];
    expect(ready.title).toBe('Novo título');
    expect(ready.canvas.zones.title.x).toBe(12);
    expect(ready.canvas.zones.photo).toEqual(source.canvas.zones.photo);
  });

  it('não esconde foto existente nem recompõe os presets comuns', () => {
    const source = photoSlide();
    for (const protectedSlide of [{ ...source, bgImageId: 'uploaded', bgImageSource: 'user' }, { ...source, presentationPresetId: 'presentation_editorial', presentationFreeDesign: undefined }]) {
      const failed = { ...protectedSlide, bgImageFailed: true, bgImageError: 'timeout' };
      expect(reconcileFreeImageFallback([protectedSlide], [failed])[0]).toBe(failed);
    }
  });

  it('preserva zonas manuais anteriores à falha e mantém o aviso para permitir nova tentativa', () => {
    const source = photoSlide();
    const manual = { ...source, canvas: { ...source.canvas, enabled: true, zones: { ...source.canvas.zones, title: { ...source.canvas.zones.title, x: 12 } } } };
    const failed = fail(manual);
    expect(failed.canvas).toEqual(manual.canvas);
    expect(failed.presentationImageFallback.layoutPreserved).toBe(true);
  });

  it('não guarda URLs ou bytes de arte dentro do snapshot de recuperação', () => {
    const source = photoSlide();
    const art = { id: 'art', presentationArtImageId: 'stored-art', presentationArtImage: 'blob:old-session/art' };
    const failed = reconcileFreeImageFallback([art, source], [art, { ...source, bgImageFailed: true, bgImageError: 'timeout' }])[1];
    expect(JSON.stringify(failed.presentationImageFallback)).not.toContain('blob:');
    expect(JSON.stringify(failed.presentationImageFallback)).not.toContain('presentationArtImage');
  });

  it('usa a cor base quando a recuperação criaria uma quarta página com arte', () => {
    const source = photoSlide();
    const art = Array.from({ length: 3 }, (_, i) => ({ id: `art-${i}`, presentationArtImageId: 'shared-art', presentationFreeDesign: { ground: 'art', photo: 'none' } }));
    const result = reconcileFreeImageFallback([...art, source], [...art, { ...source, bgImageFailed: true, bgImageError: 'timeout' }])[3];
    expect(result.presentationFreeDesign.ground).toBe('bg');
    expect(result.presentationFreeDesign.photo).toBe('none');
  });
});
