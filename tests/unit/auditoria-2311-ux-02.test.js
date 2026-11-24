import { describe, expect, it } from 'vitest';
import {
  applyBrandEdit, applyFormatEdit, applyLogoToCards, brandForFormatDisplay,
  followLogoDefaultOnAllCards as follow, slideForFormatDisplay,
} from '../../src/utils/format-view.js';
import { brandWithSlideLogo } from '../../src/utils/slide-logo.js';

// Auditoria 23/11 (UX-02): em "Padrão em todos os cards", mexer em "Tamanho
// padrão" depois de "Aplicar em todos" só mudava o card aberto. O ajuste por
// card criado pelo botão passava a vencer o padrão da marca nos outros.
const brand = { logo: 'marca.png', logoSize: 180, logoOpacity: 90, logoPosition: 'tr' };
const deck = (fmt = 'carrossel', creativePreset = 'livre') => ({
  fmt, creativePreset, brand, slides: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, title: id })),
});
const rendered = (doc) => doc.slides.map((slide) => brandWithSlideLogo(
  brandForFormatDisplay(doc.brand, doc.fmt, doc.formatViews, doc.creativePreset),
  slideForFormatDisplay(slide, doc.fmt, doc.formatViews, doc.creativePreset),
));
/** O que o controle "padrão" faz: grava na marca e solta os cards. */
const setDefault = (doc, partial) => follow(applyBrandEdit(doc, { ...brandForFormatDisplay(doc.brand, doc.fmt, doc.formatViews, doc.creativePreset), ...partial }), partial);
const applyToAll = (doc) => applyLogoToCards(doc, {
  sourceSlide: slideForFormatDisplay(doc.slides[0], doc.fmt, doc.formatViews, doc.creativePreset),
  brand: brandForFormatDisplay(doc.brand, doc.fmt, doc.formatViews, doc.creativePreset),
});

describe('auditoria 23/11 UX-02: padrão da logo depois de "Aplicar em todos"', () => {
  it('Feed: "Tamanho padrão" 240 chega aos 5 cards', () => {
    const next = setDefault(applyToAll(deck()), { logoSize: 240 });
    expect(rendered(next).map(b => b.logoSize)).toEqual([240, 240, 240, 240, 240]);
    // Os cards voltam a herdar a marca; posição e opacidade copiadas ficam.
    expect(next.slides.map(slide => slide.logoSize)).toEqual(Array(5).fill(undefined));
    expect(next.slides.map(slide => slide.logoOpacity)).toEqual(Array(5).fill(90));
  });

  it('Feed: posição e opacidade padrão também chegam a todos', () => {
    let next = setDefault(applyToAll(deck()), { logoPosition: 'bl' });
    next = setDefault(next, { logoOpacity: 55 });
    expect(rendered(next).map(b => [b.logoPosition, b.logoOpacity])).toEqual(Array(5).fill(['bl', 55]));
  });

  it('Stories: vale para os 5 cards e não mexe no Feed', () => {
    const feed = applyToAll(deck());
    let stories = applyFormatEdit({ ...feed, fmt: 'stories' }, 1, { logoSize: 400 });
    stories = setDefault(stories, { logoSize: 240 });
    expect(rendered(stories).map(b => b.logoSize)).toEqual([240, 240, 240, 240, 240]);
    expect(rendered({ ...stories, fmt: 'carrossel' }).map(b => b.logoSize)).toEqual([180, 180, 180, 180, 180]);
  });

  it('apresentação: vale para todos os slides', () => {
    let doc = deck('apresentacao', 'apresentacao');
    doc = applyFormatEdit(doc, 0, { logoSize: 120 });
    doc = setDefault(applyToAll(doc), { logoSize: 240 });
    expect(rendered(doc).map(b => b.logoSize)).toEqual([240, 240, 240, 240, 240]);
  });

  it('card sem ajuste próprio não ganha um', () => {
    const next = setDefault(deck(), { logoSize: 240 });
    expect(next.slides).toEqual(deck().slides);
    expect(next.formatViews).toBeUndefined();
  });
});
