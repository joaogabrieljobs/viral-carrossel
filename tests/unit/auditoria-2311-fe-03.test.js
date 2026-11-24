import { describe, expect, it } from 'vitest';
import { applyFormatEdit, applyFormatEditToAll, applyLogoToCards, slideForFormatDisplay } from '../../src/utils/format-view.js';
import { resolveLogoControls } from '../../src/utils/slide-logo.js';

// Auditoria 23/11 (FE-03): "Usar em todos os cards" (logo e escurecimento)
// gravava só no documento-base. Em apresentação, Stories e Quadrado o ajuste
// card a card fica na vista do formato, que vence a base: os cards já
// ajustados não mudavam e o Feed mudava sem a pessoa ver.
const deck = () => ['s1', 's2', 's3'].map((id) => ({ id, title: id, logoSize: 260, logoOpacity: 90, overlay: 60 }));
const shown = (doc, key) => doc.slides.map(slide => slideForFormatDisplay(slide, doc.fmt, doc.formatViews, doc.creativePreset)[key]);

describe('auditoria 23/11 FE-03: "usar em todos os cards" fora do Feed', () => {
  it('Stories: os cards já ajustados um a um passam a mostrar o valor novo', () => {
    let doc = { fmt: 'stories', creativePreset: 'livre', slides: deck() };
    doc = applyFormatEdit(doc, 0, { logoSize: 300 });
    doc = applyFormatEdit(doc, 1, { logoSize: 280 });
    doc = applyFormatEdit(doc, 2, { logoSize: 120 });
    const next = applyFormatEditToAll(doc, { logoSize: 120, logoSizeChosen: true, logoOpacity: 70 });
    expect(shown(next, 'logoSize')).toEqual([120, 120, 120]);
    expect(shown(next, 'logoOpacity')).toEqual([70, 70, 70]);
    // A base do Feed não muda.
    expect(next.slides.map(slide => slide.logoSize)).toEqual([260, 260, 260]);
    expect(next.slides.map(slide => slide.logoOpacity)).toEqual([90, 90, 90]);
  });

  it('apresentação: o escurecimento vale em todos os slides', () => {
    let doc = { fmt: 'apresentacao', creativePreset: 'apresentacao', slides: deck() };
    doc = applyFormatEdit(doc, 0, { overlay: 20 });
    doc = applyFormatEdit(doc, 1, { overlay: 80 });
    const next = applyFormatEditToAll(doc, { overlay: 35 });
    expect(shown(next, 'overlay')).toEqual([35, 35, 35]);
    expect(next.slides.map(slide => slide.overlay)).toEqual([60, 60, 60]);
  });

  it('Feed de carrossel continua gravando no card', () => {
    const next = applyFormatEditToAll({ fmt: 'carrossel', creativePreset: 'livre', slides: deck() }, { logoSize: 140, overlay: 30 });
    expect(next.slides.map(slide => [slide.logoSize, slide.overlay])).toEqual([[140, 30], [140, 30], [140, 30]]);
    expect(next.formatViews).toBeUndefined();
  });

  it('com lista de ids, só os cards escolhidos mudam', () => {
    const doc = { fmt: 'stories', creativePreset: 'livre', slides: deck() };
    const next = applyFormatEditToAll(doc, { logoHidden: true }, ['s2']);
    expect(shown(next, 'logoHidden')).toEqual([undefined, true, undefined]);
  });
});

describe('auditoria 23/11 FE-03: "Aplicar em todos" da logo fora do Feed', () => {
  const brand = { logo: 'marca.png', logoSize: 260, logoOpacity: 90, logoPosition: 'tr' };
  const controls = (doc) => doc.slides.map(slide => resolveLogoControls(brand, slideForFormatDisplay(slide, doc.fmt, doc.formatViews, doc.creativePreset)));

  it('Stories: posição, tamanho e opacidade do card atual chegam a todos, e a base não muda', () => {
    let doc = { fmt: 'stories', creativePreset: 'livre', slides: deck() };
    doc = applyFormatEdit(doc, 0, { logoSize: 110, logoOpacity: 60, logoPosition: 'bl' });
    doc = applyFormatEdit(doc, 1, { logoSize: 300, logoHidden: true });
    const source = slideForFormatDisplay(doc.slides[0], doc.fmt, doc.formatViews, doc.creativePreset);
    const next = applyLogoToCards(doc, { logoImageId: 'png-1', logoImage: 'blob:png-1', sourceSlide: source, brand });
    expect(controls(next)).toEqual(Array(3).fill({ logoPosition: 'bl', logoSize: 110, logoOpacity: 60 }));
    expect(shown(next, 'logoHidden')).toEqual([false, false, false]);
    // O arquivo é do card; o desenho da base (Feed) fica como estava.
    expect(next.slides.map(slide => slide.logoImageId)).toEqual(['png-1', 'png-1', 'png-1']);
    expect(next.slides.map(slide => slide.logoSize)).toEqual([260, 260, 260]);
    expect(next.slides.map(slide => slide.logoSizeChosen)).toEqual([true, true, true]);
  });

  it('o arrasto livre da logo segue o card de origem, inclusive quando ele não tem arrasto', () => {
    let doc = { fmt: 'stories', creativePreset: 'livre', slides: deck().map((slide, i) => (i === 2 ? { ...slide, elementOffsets: { logo: { x: 9, y: 9 }, title: { x: 1, y: 1 } } } : slide)) };
    doc = applyFormatEdit(doc, 1, { elementOffsets: { logo: { x: -5, y: 8 }, title: { x: 4, y: 5 } } });
    const view = (d, i) => slideForFormatDisplay(d.slides[i], d.fmt, d.formatViews, d.creativePreset);
    const semArrasto = applyLogoToCards(doc, { sourceSlide: view(doc, 0), brand });
    expect([0, 1, 2].map(i => view(semArrasto, i).elementOffsets?.logo || null)).toEqual([null, null, null]);
    expect(view(semArrasto, 1).elementOffsets.title).toEqual({ x: 4, y: 5 });
    expect(view(semArrasto, 2).elementOffsets.title).toEqual({ x: 1, y: 1 });
    // A base do card 3 guarda o arrasto que ele tem no Feed.
    expect(semArrasto.slides[2].elementOffsets.logo).toEqual({ x: 9, y: 9 });
    const comArrasto = applyLogoToCards(doc, { sourceSlide: view(doc, 1), brand });
    expect([0, 1, 2].map(i => view(comArrasto, i).elementOffsets.logo)).toEqual(Array(3).fill({ x: -5, y: 8 }));
  });

  it('Feed de carrossel: mesmo resultado de antes, gravado no card', () => {
    const slides = [
      { id: 'a', elementOffsets: { logo: { x: 17, y: -9 }, title: { x: 2, y: 3 } }, logoPosition: 'bl', logoSize: 280, logoOpacity: 64 },
      { id: 'b', elementOffsets: { logo: { x: -5, y: 8 }, title: { x: 4, y: 5 } }, logoPosition: 'tr', logoSize: 90, logoImageAssetId: 'conta-1', logoImageId: 'antiga', logoImage: 'blob:antiga' },
      { id: 'c', elementOffsets: { logo: { x: 1, y: 1 } } },
    ];
    const next = applyLogoToCards({ fmt: 'carrossel', creativePreset: 'livre', slides }, { logoImageId: 'nova', logoImage: 'blob:nova', sourceSlide: slides[0], brand, ids: ['b'] });
    expect(next.formatViews).toBeUndefined();
    expect(next.slides[1]).toMatchObject({ logoPosition: 'bl', logoSize: 280, logoOpacity: 64, logoHidden: false, logoSizeChosen: true, logoImageId: 'nova' });
    expect(next.slides[1].elementOffsets).toEqual({ logo: { x: 17, y: -9 }, title: { x: 4, y: 5 } });
    // Logo trocada no editor deixa de apontar para o arquivo antigo da conta.
    expect(next.slides[1].logoImageAssetId).toBeNull();
    expect(next.slides[2]).toBe(slides[2]);
    const semArrasto = applyLogoToCards({ fmt: 'carrossel', creativePreset: 'livre', slides }, { sourceSlide: { id: 'x', logoSize: 200 }, brand });
    expect(semArrasto.slides.map(slide => Object.hasOwn(slide.elementOffsets, 'logo'))).toEqual([false, false, false]);
  });
});
