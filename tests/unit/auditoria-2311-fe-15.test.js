import { describe, expect, it } from 'vitest';
import { applyFormatEdit, applyPhotoSwapSlides, slideForFormatDisplay } from '../../src/utils/format-view.js';
import { automaticPhotoFramingPatch } from '../../src/utils/photo-framing.js';
import { applySlidePatchIfImageCurrent, slideImageIdentity } from '../../src/utils/image-store.js';
import { applyBatchPhotosToSlides } from '../../src/utils/batch-photos.js';
import { mkSlide } from '../../src/utils/doc-schema.js';


// Auditoria 23/11 (FE-15): a foto nova herdava, nas outras proporções, o
// recorte manual feito para a foto antiga (zoom e posição, cabeça cortada).
// A troca só limpava o formato aberto ou só o slide-base.
const fotoA = { bgImageId: 'foto-a', bgImage: 'blob:foto-a' };
const fotoB = { bgImageId: 'foto-b', bgImage: 'blob:foto-b' };
const deck = (fmt, creativePreset = 'livre') => ({
  fmt, creativePreset,
  slides: [{ id: 's1', title: 'Card', ...fotoA, photoFraming: 'auto', bgFit: 'cover', bgX: 50, bgY: 50, bgZoom: 100, elementOffsets: { title: { x: 2, y: 3 } } }],
});
const framing = (doc, fmt) => {
  const s = slideForFormatDisplay(doc.slides[0], fmt, doc.formatViews, doc.creativePreset);
  return [s.photoFraming, s.bgX, s.bgY, s.bgZoom, s.elementOffsets?.photo?.x || 0];
};
const AUTO = ['auto', 50, 50, 100, 0];
/** Reposicionar a foto A no Stories. */
const storiesManual = () => applyFormatEdit(deck('stories'), 0, { bgX: 10, bgY: 85, bgZoom: 170, elementOffsets: { photo: { x: 6, y: -4 } } });

describe('auditoria 23/11 FE-15: foto nova não herda o recorte da antiga', () => {
  it('o ajuste manual no Stories é mesmo da foto A', () => {
    expect(framing(storiesManual(), 'stories')).toEqual(['manual', 10, 85, 170, 6]);
  });

  it('importação no Feed: o Stories mostra a foto nova com enquadramento automático', () => {
    const feed = { ...storiesManual(), fmt: 'carrossel' };
    const next = applyFormatEdit(feed, 0, automaticPhotoFramingPatch({ ...fotoB, bgImageSource: 'imported' }, feed.slides[0]));
    expect(next.slides[0].bgImageId).toBe('foto-b');
    expect(framing(next, 'stories')).toEqual(AUTO);
    expect(framing(next, 'carrossel')).toEqual(AUTO);
  });

  it('imagem gerada por IA: o recorte antigo sai do Stories e do Quadrado', () => {
    let doc = storiesManual();
    doc = applyFormatEdit({ ...doc, fmt: 'quadrado' }, 0, { bgZoom: 140 });
    const slides = applySlidePatchIfImageCurrent(doc.slides, {
      id: 's1', expectedImageIdentity: slideImageIdentity(doc.slides[0]),
      patch: automaticPhotoFramingPatch({ ...fotoB, bgImageSource: 'ai' }, doc.slides[0]),
    });
    const next = applyPhotoSwapSlides(doc, slides);
    expect(framing(next, 'stories')).toEqual(AUTO);
    expect(framing(next, 'quadrado')).toEqual(AUTO);
    // Deslocamento de outros elementos e demais ajustes da vista ficam.
    expect(slideForFormatDisplay(next.slides[0], 'stories', next.formatViews, 'livre').elementOffsets.title).toEqual({ x: 2, y: 3 });
  });

  it('importação em lote: idem', () => {
    const doc = storiesManual();
    const next = applyPhotoSwapSlides(doc, applyBatchPhotosToSlides(doc.slides, [fotoB], mkSlide, null));
    expect(next.slides[0].bgImageId).toBe('foto-b');
    expect(framing(next, 'stories')).toEqual(AUTO);
  });

  it('inverso: ajuste no Feed, recorte da foto no Stories', () => {
    const feed = applyFormatEdit(deck('carrossel'), 0, { bgX: 20, bgY: 80, bgZoom: 150 });
    expect(framing(feed, 'carrossel')).toEqual(['manual', 20, 80, 150, 0]);
    const stories = { ...feed, fmt: 'stories' };
    const shown = slideForFormatDisplay(stories.slides[0], 'stories', stories.formatViews, 'livre');
    const next = applyFormatEdit(stories, 0, automaticPhotoFramingPatch({ ...fotoB, bgImageSource: 'edited' }, shown));
    expect(framing(next, 'carrossel')).toEqual(AUTO);
    expect(framing(next, 'stories')).toEqual(AUTO);
  });

  it('apresentação: a foto nova entra automática no 16:9 e nas proporções derivadas', () => {
    let doc = applyFormatEdit(deck('apresentacao', 'apresentacao'), 0, { bgX: 5, bgZoom: 180 });
    expect(framing(doc, 'apresentacao').slice(0, 2)).toEqual(['manual', 5]);
    doc = applyFormatEdit(doc, 0, automaticPhotoFramingPatch({ ...fotoB }, doc.slides[0]));
    expect(framing(doc, 'apresentacao')).toEqual(AUTO);
    expect(slideForFormatDisplay(doc.slides[0], 'stories', doc.formatViews, 'apresentacao').photoFraming).toBe('auto');
  });

  it('sem troca de foto, o ajuste manual fica', () => {
    const doc = storiesManual();
    // Recarregar a mesma foto (novo endereço local, mesmo id) não é troca.
    const reloaded = applyPhotoSwapSlides(doc, doc.slides.map(slide => ({ ...slide, bgImage: 'blob:foto-a-recarregada' })));
    expect(framing(reloaded, 'stories')).toEqual(['manual', 10, 85, 170, 6]);
    // Foto que volta junto com o próprio recorte manual não é troca automática.
    const restored = applyPhotoSwapSlides(doc, doc.slides.map(slide => ({ ...slide, ...fotoB, photoFraming: 'manual' })));
    expect(framing(restored, 'stories')).toEqual(['manual', 10, 85, 170, 6]);
    // Card que ficou sem foto também não.
    const emptied = applyPhotoSwapSlides(doc, doc.slides.map(slide => ({ ...slide, bgImageId: null, bgImage: null })));
    expect(emptied.formatViews.stories.slides.s1.bgZoom).toBe(170);
    // Outro ajuste no Feed (texto, escurecimento) não toca o recorte do Stories.
    const edited = applyFormatEdit({ ...doc, fmt: 'carrossel' }, 0, { overlay: 30, title: 'Novo' });
    expect(framing(edited, 'stories')).toEqual(['manual', 10, 85, 170, 6]);
    // Remover a foto não apaga o recorte: só a foto nova o faz.
    const removed = applyFormatEdit({ ...doc, fmt: 'carrossel' }, 0, { bgImage: null, bgImageId: null });
    expect(removed.formatViews.stories.slides.s1.bgZoom).toBe(170);
  });
});
