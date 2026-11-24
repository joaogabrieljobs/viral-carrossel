import { describe, expect, it } from 'vitest';
import { applyFormatEdit, duplicateSlideInDoc as duplicate, slideForFormatDisplay } from '../../src/utils/format-view.js';

// Auditoria 23/11 (FE-17): duplicar um card perdia os ajustes visuais feitos na
// vista do formato (em apresentação, todos). A vista é lida pelo id do card e
// a cópia nascia com id novo, sem entrada.
const view = (doc, i) => slideForFormatDisplay(doc.slides[i], doc.fmt, doc.formatViews, doc.creativePreset);
const deck = (fmt, creativePreset) => ({
  fmt, creativePreset,
  slides: ['s1', 's2', 's3'].map((id, i) => ({ id, num: i + 1, title: id, logoSize: 300, bgX: 70, titleSize: 100, subSize: 100 })),
});

describe('auditoria 23/11 FE-17: duplicar card com ajustes na vista do formato', () => {
  it('apresentação: a cópia mostra a mesma logo, foto e título do original', () => {
    let doc = deck('apresentacao', 'apresentacao');
    doc = applyFormatEdit(doc, 0, { logoSize: 120, bgX: 10, titleSize: 64 });
    const next = duplicate(doc, 0, 'novo');
    expect(next.slides.map(slide => slide.id)).toEqual(['s1', 'novo', 's2', 's3']);
    expect(next.slides.map(slide => slide.num)).toEqual([1, 2, 3, 4]);
    expect([view(next, 1).logoSize, view(next, 1).bgX, view(next, 1).titleSize]).toEqual([120, 10, 64]);
    expect(view(next, 1).photoFraming).toBe(view(next, 0).photoFraming);
    // O original e os outros cards ficam como estavam.
    expect(view(next, 0).logoSize).toBe(120);
    expect(view(next, 2).logoSize).toBe(300);
  });

  it('carrossel: a cópia leva o ajuste de cada proporção, não só o da aberta', () => {
    let doc = applyFormatEdit(deck('stories', 'livre'), 1, { logoSize: 90, overlay: 20 });
    doc = applyFormatEdit({ ...doc, fmt: 'quadrado' }, 1, { logoSize: 150 });
    const next = duplicate({ ...doc, fmt: 'carrossel' }, 1, 'novo');
    expect(slideForFormatDisplay(next.slides[2], 'stories', next.formatViews, 'livre')).toMatchObject({ logoSize: 90, overlay: 20 });
    expect(slideForFormatDisplay(next.slides[2], 'quadrado', next.formatViews, 'livre').logoSize).toBe(150);
    expect(next.slides[2].logoSize).toBe(300);
  });

  it('mexer na cópia depois não altera o original', () => {
    let doc = applyFormatEdit(deck('stories', 'livre'), 0, { logoSize: 90, elementOffsets: { logo: { x: 3, y: 4 } } });
    doc = duplicate(doc, 0, 'novo');
    doc = applyFormatEdit(doc, 1, { logoSize: 200, elementOffsets: { logo: { x: 9, y: 9 } } });
    expect(view(doc, 0)).toMatchObject({ logoSize: 90, elementOffsets: { logo: { x: 3, y: 4 } } });
    expect(view(doc, 1)).toMatchObject({ logoSize: 200, elementOffsets: { logo: { x: 9, y: 9 } } });
  });

  it('card sem ajuste em vista não cria entrada vazia', () => {
    const next = duplicate(deck('carrossel', 'livre'), 2, 'novo');
    expect(next.slides.map(slide => slide.id)).toEqual(['s1', 's2', 's3', 'novo']);
    expect(next.formatViews).toBeUndefined();
  });
});
