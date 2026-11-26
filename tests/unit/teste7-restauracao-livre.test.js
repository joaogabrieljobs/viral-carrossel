// A vista de formato também participa da geração: não pode reabrir um slot
// sem foto só porque restou uma imagem de IA, nem devolver o CENA removido.
import { describe, expect, it } from 'vitest';
import { getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { restorePresentationPhotoComposition } from '../../src/utils/presentation-composition.js';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';
import { applyFinalizeCanvasMarginsToSlides, autoAdjustSlides } from '../../src/utils/canvas-zones.js';
import { repairPresentationLayouts } from '../../src/utils/presentation-quality.js';
import { deckArtLayer } from '../../src/utils/deck-art.js';

const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';
const withoutPhoto = ({ family = 'cinematic', ground = 'inverse', preset = 'presentation_free' } = {}) => {
  const slide = {
    id: 'legacy-none', title: 'Identidade em movimento', subtitle: 'Um encontro com personalidade.', eyebrow: 'A PERSONALIDADE',
    presentationPlan: { schemaVersion: 3, visualRole: 'content', purpose: 'vision',
      design: { family, ground, photo: 'none', block: 'none', emphasis: [], icons: [] } },
  };
  return { ...slide, ...getPresentationCompositionOverrides(preset, { slide, index: 3, count: 5 }) };
};

describe('Teste 7: etapas posteriores à composição preservam o Livre', () => {
  it('autoajuste, margens e reparo de áreas não recompõem a família, os chapéus nem a arte', () => {
    const original = withoutPhoto({ family: 'editorial', ground: 'art' });
    const adjusted = autoAdjustSlides([original], { creativePreset: 'apresentacao', fmt: 'apresentacao' });
    const finalized = applyFinalizeCanvasMarginsToSlides(adjusted, 'apresentacao');
    const [slide] = repairPresentationLayouts(finalized, { fmt: 'apresentacao' }).slides;
    for (const key of ['presentationPresetId', 'presentationFreeDesign', 'presentationDesignFamily', 'eyebrow', 'presentationChrome']) {
      expect(slide[key], key).toEqual(original[key]);
    }
    expect(slide.canvas.zones).toEqual(original.canvas.zones);
  });
});

describe('Teste 7: mídia de IA residual em um slot sem foto', () => {
  it('preserva a decisão none e o chrome salvo na vista, sem mostrar CENA ou nova área de foto', () => {
    const slide = { ...withoutPhoto(), bgImage: PHOTO, bgImageSource: 'ai', bgImageId: 'old-ai' };
    expect(restorePresentationPhotoComposition(slide)).toBe(slide);
    const view = slideForFormatDisplay(slide, 'apresentacao', {}, 'apresentacao');
    expect(view.presentationSuppressPhoto).toBe(true);
    expect(view.presentationFreeDesign.photo).toBe('none');
    expect(view.presentationChrome.chrome.map(d => d.text || '').join(' ')).not.toMatch(/CENA/);
    expect(view.canvas.zones).toEqual(slide.canvas.zones);
    expect(slide.bgImageId).toBe('old-ai');
  });

  it('a arte permanece efetiva mesmo quando há um asset de foto de IA antigo', () => {
    const slide = {
      ...withoutPhoto({ family: 'editorial', ground: 'art' }),
      presentationArtImage: PHOTO, presentationArtImageId: 'deck-art',
      bgImageId: 'old-ai', bgImageSource: 'ai',
    };
    const view = slideForFormatDisplay(slide, 'apresentacao', {}, 'apresentacao');
    expect(view.presentationFreeDesign).toMatchObject({ ground: 'art', photo: 'none' });
    expect(view.presentationSuppressPhoto).toBe(true);
    expect(deckArtLayer(view)?.image).toBe(PHOTO);
    expect(view.canvas.zones).toEqual(slide.canvas.zones);
  });
});

describe('Teste 7: foto explicitamente adicionada continua visível', () => {
  it.each(['imported', 'edited', undefined])('mantém a foto de origem %s e o eyebrow, sem recriar CENA', bgImageSource => {
    const slide = { ...withoutPhoto(), bgImage: PHOTO, bgImageSource };
    const view = restorePresentationPhotoComposition(slide);
    expect(view.presentationSuppressPhoto).toBe(false);
    expect(view.presentationFreeDesign.photo).not.toBe('none');
    expect(view.bgImage).toBe(PHOTO);
    expect(view.eyebrow).toBe(slide.eyebrow);
    const labels = view.presentationChrome.chrome.map(d => d.text || '');
    expect(labels.join(' ')).not.toMatch(/CENA/);
    expect(labels.filter(text => text.includes('{kicker'))).toHaveLength(1);
  });

  it('uma nova geração individual explícita também pode preencher o slot none', () => {
    const slide = { ...withoutPhoto(), bgImage: PHOTO, bgImageSource: 'ai', presentationPhotoRequested: true };
    const view = restorePresentationPhotoComposition(slide);
    expect(view.presentationSuppressPhoto).toBe(false);
    expect(view.bgImage).toBe(PHOTO);
    expect(view.presentationChrome.chrome.map(d => d.text || '').join(' ')).not.toMatch(/CENA/);
  });

  it('ao inserir foto sobre uma página de arte, usa fundo compatível e conserva o asset de arte', () => {
    const slide = { ...withoutPhoto({ family: 'editorial', ground: 'art' }),
      presentationArtImage: PHOTO, presentationArtImageId: 'deck-art', bgImage: PHOTO, bgImageSource: 'imported' };
    const view = restorePresentationPhotoComposition(slide);
    expect(view.presentationFreeDesign.photo).not.toBe('none');
    expect(view.presentationFreeDesign.ground).not.toBe('art');
    expect(view.presentationArtImageId).toBe('deck-art');
    expect(view.bgImage).toBe(PHOTO);
    expect(slide.presentationFreeDesign.ground).toBe('art');
  });

  it('o preset Cinemático comum mantém seu chrome narrativo ao receber foto', () => {
    const slide = { ...withoutPhoto({ preset: 'presentation_cinematic' }), bgImage: PHOTO, bgImageSource: 'imported' };
    const view = restorePresentationPhotoComposition(slide);
    expect(view.presentationSuppressPhoto).toBe(false);
    expect(view.presentationChrome.chrome.map(d => d.text || '').join(' ')).toMatch(/CENA/);
  });
});
