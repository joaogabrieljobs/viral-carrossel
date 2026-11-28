import { describe, expect, it } from 'vitest';
import { applyBrandTypographyEdit, slideForFormatDisplay } from '../../src/utils/format-view.js';

// Apoteose 10 (27/11, slide 9): no Stories o slide tinha tamanho próprio
// gravado na vista (subtítulo 143, texto abaixo da foto 180). A régua
// "Tamanho subtítulo" mudava só o slide base; a vista vencia e nada mudava.
const slide = {
  id: 's9', title: 'O esquenta', subtitle: 'Texto', bodyAfterImage: 'Apoio',
  subSize: 176.51, bodyAfterSize: 233.77, titleSize: 123.49,
  presentationCompositionId: 'presentation_executive_minimal:content',
  presentationFreeDesign: { block: 'none' },
};
const doc = {
  fmt: 'stories', creativePreset: 'apresentacao',
  brand: { textSubSize: 100, textBodyAfterSize: 100, textTitleSize: 100 },
  slides: [slide],
  formatViews: { stories: { brand: {}, slides: { s9: { subSize: 143, bodyAfterSize: 180, titleSize: 131 } } } },
};
const shown = d => slideForFormatDisplay(d.slides[0], d.fmt, d.formatViews, d.creativePreset);

describe('régua de tipografia da marca numa proporção derivada', () => {
  it('muda o tamanho que o card mostra, inclusive quando a vista tem valor próprio', () => {
    const next = applyBrandTypographyEdit(doc, doc.brand, { ...doc.brand, textSubSize: 150 });
    expect(shown(doc).subSize).toBe(143);
    expect(shown(next).subSize).toBe(214.5);
    // Só o campo mexido muda.
    expect(shown(next).bodyAfterSize).toBe(180);
    expect(shown(next).titleSize).toBe(131);
  });

  it('texto abaixo da foto segue a régua dele', () => {
    const next = applyBrandTypographyEdit(doc, doc.brand, { ...doc.brand, textBodyAfterSize: 80 });
    expect(shown(next).bodyAfterSize).toBe(144);
  });

  it('no Feed de carrossel comum continua gravando no slide', () => {
    const feed = { fmt: 'carrossel', creativePreset: 'carrossel', brand: { textSubSize: 100 },
      slides: [{ id: 'a', subSize: 80 }], formatViews: {} };
    const next = applyBrandTypographyEdit(feed, feed.brand, { textSubSize: 120 });
    expect(next.slides[0].subSize).toBe(96);
    expect(next.formatViews).toEqual({});
  });

  it('devolve o mesmo documento quando nenhum campo muda', () => {
    expect(applyBrandTypographyEdit(doc, doc.brand, { ...doc.brand })).toBe(doc);
  });
});

// Na apresentação, o renderer desenha o tamanho do token tipográfico da
// composição (sizePercent); titleSize/subSize do slide ficavam sem efeito.
describe('tamanho de título e subtítulo em slide de apresentação', () => {
  const deck = (entry = {}) => ({
    fmt: 'apresentacao', creativePreset: 'apresentacao',
    brand: { textSubSize: 100, textTitleSize: 100 },
    slides: [{
      id: 'p1', title: 'T', subtitle: 'S', subSize: 176.51, titleSize: 123.49,
      presentationComposition: 'demo', presentationCompositionId: 'presentation_executive_minimal:content',
      presentationTypographyByComposition: { demo: { title: { sizePercent: 40.5, weight: 700 }, subtitle: { sizePercent: 74.5 } } },
    }],
    formatViews: { apresentacao: { brand: {}, slides: entry ? { p1: entry } : {} } },
  });
  const tok = d => shown(d).presentationTypographyByComposition.demo;

  it('o card mostra no campo o tamanho que está desenhado', () => {
    expect(shown(deck()).subSize).toBe(74.5);
    expect(shown(deck()).titleSize).toBe(40.5);
  });

  it('a régua muda o tamanho desenhado, em proporção', () => {
    const d = deck();
    const next = applyBrandTypographyEdit(d, d.brand, { ...d.brand, textSubSize: 120 });
    expect(tok(next).subtitle.sizePercent).toBe(89.4);
    expect(tok(next).title.sizePercent).toBe(40.5);
    expect(tok(next).title.weight).toBe(700);
    // O slide base e as outras proporções não mudam.
    expect(next.slides[0].presentationTypographyByComposition.demo.subtitle.sizePercent).toBe(74.5);
  });

  it('tamanho gravado na proporção vence o token', () => {
    expect(tok(deck({ subSize: 90 })).subtitle.sizePercent).toBe(90);
    expect(shown(deck({ subSize: 90 })).subSize).toBe(90);
  });
});
