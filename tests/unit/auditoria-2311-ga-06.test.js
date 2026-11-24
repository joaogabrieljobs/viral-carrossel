import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as viewer from '../../src/components/card/FullscreenViewer.jsx';
import { slideStoredPresentationCssFilter } from '../../src/components/card/SlideCardInner.jsx';

const { DEFAULT_PRESENTATION_IMG_ADJUST, buildPresentationImageFilter, normalizePresentationImgAdjust, presentationAdjustIsNeutral } = viewer;
const PB_DA_FAMILIA = 'grayscale(1) contrast(1.2)';
const suico = (extra = {}) => ({
  id: 's1', bgImage: 'data:image/png;base64,AAAA', presentationArtDirectionVersion: 2, presentationPhotoTreatment: PB_DA_FAMILIA, ...extra,
});

/** O que "Salvar" grava no projeto (persistFullscreenPresentationAdjustDraft). */
function salvo(slide, draft) {
  const normalized = normalizePresentationImgAdjust(draft);
  const next = { ...slide };
  if (presentationAdjustIsNeutral(normalized)) delete next.presentationImgAdjust;
  else next.presentationImgAdjust = normalized;
  return next;
}

describe('GA-06: a prévia do ajuste da foto na tela cheia é o que fica salvo', () => {
  it('a prévia é o slide com o rascunho aplicado; sem rascunho, o próprio slide', () => {
    const { fullscreenPreviewSlide } = viewer;
    expect(typeof fullscreenPreviewSlide).toBe('function');
    const slide = suico({ presentationImgAdjust: { ...DEFAULT_PRESENTATION_IMG_ADJUST, contrast: 5 } });
    expect(fullscreenPreviewSlide(slide, undefined)).toBe(slide);
    for (const draft of [{ ...DEFAULT_PRESENTATION_IMG_ADJUST }, { ...DEFAULT_PRESENTATION_IMG_ADJUST, contrast: 20 }, { brightness: 12 }]) {
      expect(fullscreenPreviewSlide(slide, draft)).toEqual(salvo(slide, draft));
    }
  });

  it('família com tratamento de foto: "Restaurar" mostra o preto e branco da família, antes e depois de salvar', () => {
    const { fullscreenPreviewSlide } = viewer;
    const slide = suico({ presentationImgAdjust: { ...DEFAULT_PRESENTATION_IMG_ADJUST, contrast: 5 } });
    const restaurado = { ...DEFAULT_PRESENTATION_IMG_ADJUST };
    const previa = slideStoredPresentationCssFilter(fullscreenPreviewSlide(slide, restaurado));
    expect(previa).toBe(PB_DA_FAMILIA);
    expect(previa).toBe(slideStoredPresentationCssFilter(salvo(slide, restaurado)));
  });

  it('carrossel da biblioteca com tratamento por família: mesma regra', () => {
    const { fullscreenPreviewSlide } = viewer;
    const slide = { id: 'c1', bgImage: 'data:image/png;base64,AAAA', socialCompositionVersion: 4, socialPhotoTreatment: 'grayscale(1) contrast(1.12)' };
    expect(slideStoredPresentationCssFilter(fullscreenPreviewSlide(slide, { ...DEFAULT_PRESENTATION_IMG_ADJUST }))).toBe('grayscale(1) contrast(1.12)');
  });

  it('rascunho com ajuste: a prévia usa o mesmo filtro que o valor gravado produz', () => {
    const { fullscreenPreviewSlide } = viewer;
    const draft = { ...DEFAULT_PRESENTATION_IMG_ADJUST, contrast: 20, color: -10 };
    const previa = slideStoredPresentationCssFilter(fullscreenPreviewSlide(suico(), draft));
    expect(previa).toBe(buildPresentationImageFilter(draft));
    expect(previa).toBe(slideStoredPresentationCssFilter(salvo(suico(), draft)));
  });

  it('sem tratamento de família, rascunho neutro sobre ajuste gravado: sem filtro, como depois de salvar', () => {
    const { fullscreenPreviewSlide } = viewer;
    const slide = { id: 'x', bgImage: 'data:image/png;base64,AAAA', presentationImgAdjust: { ...DEFAULT_PRESENTATION_IMG_ADJUST, exposure: 10 } };
    expect(slideStoredPresentationCssFilter(slide)).toBe(buildPresentationImageFilter(slide.presentationImgAdjust));
    expect(slideStoredPresentationCssFilter(fullscreenPreviewSlide(slide, { ...DEFAULT_PRESENTATION_IMG_ADJUST }))).toBeUndefined();
  });

  it('o visualizador entrega o slide da prévia ao card e não manda mais um filtro à parte', () => {
    const fonte = readFileSync(new URL('../../src/components/card/FullscreenViewer.jsx', import.meta.url), 'utf8');
    expect(fonte).toMatch(/slide=\{fullscreenPreviewSlide\(/);
    expect(fonte).not.toMatch(/presentationImgFilter:/);
  });

  it('o rascunho não sobrevive ao fechar nem ao salvar: reabrir mostra o valor gravado', () => {
    const fonte = readFileSync(new URL('../../src/components/card/FullscreenViewer.jsx', import.meta.url), 'utf8');
    // Ao fechar (mesmo bloco que fecha os painéis).
    expect(fonte).toMatch(/if \(!open\) \{\s*setPhotoAdjustOpen\(false\);\s*setCaptionOpen\(false\);\s*(?:\/\/[^\n]*\s*)?setImgAdjBySlide\(\(prev\) => \(Object\.keys\(prev\)\.length \? \{\} : prev\)\);/);
    // Depois de salvar.
    expect(fonte).toMatch(/onSavePresentationAdjust\(imgAdjBySlide\);\s*(?:\/\/[^\n]*\s*)?setImgAdjBySlide\(\{\}\);/);
  });
});
