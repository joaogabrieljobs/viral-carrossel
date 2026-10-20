import { describe, expect, it } from 'vitest';
import { applyBrandEdit, applyFormatEdit, brandForFormatDisplay, slideForFormatDisplay, transformFormatVisuals } from '../../src/utils/format-view.js';
import { enableCanvasLayoutSlides, disableCanvasLayoutSlides, removeCanvasLayoutSlides } from '../../src/utils/canvas-zones.js';

const slide = {
  id: 'pitch-1',
  title: 'Receita recorrente e escopo inviolável',
  subtitle: 'Membro paga assinatura para acessar a trajetória. Médico ou clínica acompanham a carteira.',
  bodyAfterImage: 'A assinatura captura o valor da continuidade.',
  bgImageId: 'photo-1',
  presentationCompositionId: 'presentation_split',
  presentationComposition: 'split',
  presentationTypographyByComposition: { split: { title: { sizePercent: 20, italic: true, fontFamily: 'Spectral' } } },
  titleSize: 46, subSize: 72, bodyAfterSize: 40,
  elementOffsets: { logo: { x: 20, y: 30 }, title: { x: 10, y: -12 } },
  canvas: { applied: true, variant: 'classic', source: 'presentation-preset', zones: {
    photo: { x: 65, y: 39, w: 29, h: 49 },
    title: { x: 6, y: 12, w: 88, h: 22 },
    subtitle: { x: 6, y: 38, w: 55, h: 56 },
  } },
};
const views = {
  apresentacao: {
    brand: { titleFont: 'Spectral', bg: '#111111' },
    slides: { 'pitch-1': { bgX: 67, titleColor: '#ffffff', bgFit: 'contain', textFonts: { subtitle: 'Inter' } } },
  },
};

describe('apresentação adaptada a formatos sociais', () => {
  for (const fmt of ['carrossel', 'quadrado', 'stories']) {
    it(`${fmt}: preenche a foto, reorganiza texto e preserva o 16:9`, () => {
      const before = JSON.stringify({ slide, views });
      const landscape = slideForFormatDisplay(slide, 'apresentacao', views);
      const result = slideForFormatDisplay(slide, fmt, views);
      expect(result.canvas.zones.photo).toEqual({ x: 0, y: 0, w: 100, h: 100 });
      expect(result.bgFit).toBe('cover');
      expect(result.bgX).toBe(67);
      expect(result.titleSize).toBeGreaterThan(70);
      expect(result.subSize).toBeGreaterThan(100);
      expect(result.titleColor).toBe('#ffffff');
      expect(result.elementOffsets).toEqual({});
      expect(result.textFonts).toEqual({ title: 'Spectral', subtitle: 'Inter' });
      expect(result.presentationTypographyByComposition['social-format'].title.italic).toBe(true);
      for (const key of ['title', 'subtitle', 'bodyAfterImage', 'bgImageId']) expect(result[key]).toBe(slide[key]);
      const { title, subtitle } = result.canvas.zones;
      expect(title.y).toBeGreaterThanOrEqual(24);
      expect(title.y + title.h).toBeLessThan(subtitle.y);
      expect(subtitle.y + subtitle.h).toBeLessThanOrEqual(fmt === 'stories' ? 82.01 : 92.01);
      expect(slideForFormatDisplay(slide, 'apresentacao', views)).toEqual(landscape);
      expect(JSON.stringify({ slide, views })).toBe(before);
    });

    it(`${fmt}: edição visual e posição ficam só no formato; conteúdo continua compartilhado`, () => {
      const doc = { fmt, slides: [slide], creativePreset: 'apresentacao', formatViews: views };
      const result = applyFormatEdit(doc, 0, {
        titleSize: 90, titleColor: '#eecc99', elementOffsets: { title: { x: 2, y: 3 } }, title: 'Novo título',
      });
      expect(result.slides[0].titleSize).toBe(slide.titleSize);
      expect(result.slides[0].title).toBe('Novo título');
      expect(result.formatViews.apresentacao).toEqual(views.apresentacao);
      const viewed = slideForFormatDisplay(result.slides[0], fmt, result.formatViews);
      expect(viewed.titleSize).toBe(90);
      expect(viewed.titleColor).toBe('#eecc99');
      expect(viewed.elementOffsets).toEqual({ title: { x: 2, y: 3 } });
      // Persistência/reabertura não perde as caixas adaptadas.
      const reopened = JSON.parse(JSON.stringify(result));
      expect(slideForFormatDisplay(reopened.slides[0], fmt, reopened.formatViews)).toEqual(viewed);
    });
  }

  it('marca do 16:9 é herdada, mas editar a marca no feed não altera a apresentação', () => {
    const brand = { bg: '#ffffff', titleFont: 'Arial', name: 'ÉTER' };
    const current = brandForFormatDisplay(brand, 'carrossel', views, 'apresentacao');
    expect(current.bg).toBe('#111111');
    const edited = applyBrandEdit({ fmt: 'carrossel', creativePreset: 'apresentacao', brand, slides: [slide], formatViews: views },
      { ...current, bg: '#222222' });
    expect(edited.brand).toEqual(brand);
    expect(brandForFormatDisplay(brand, 'carrossel', edited.formatViews, 'apresentacao').bg).toBe('#222222');
    expect(brandForFormatDisplay(brand, 'apresentacao', edited.formatViews, 'apresentacao').bg).toBe('#111111');
    const reset = applyBrandEdit(edited, { ...current, bg: '#ffffff' });
    expect(brandForFormatDisplay(brand, 'carrossel', reset.formatViews, 'apresentacao').bg).toBe('#ffffff');
  });

  it('ativar, mover, desativar e remover composição operam na vista atual', () => {
    const doc = { fmt: 'carrossel', creativePreset: 'apresentacao', slides: [slide], formatViews: views };
    const enabled = transformFormatVisuals(doc, slides => enableCanvasLayoutSlides(slides, 'apresentacao'));
    expect(enabled.slides).toEqual(doc.slides);
    const canvas = enabled.formatViews.carrossel.slides[slide.id].canvas;
    expect(canvas.enabled).toBe(true);
    expect(canvas.zones.photo.w).toBe(100);
    const moved = applyFormatEdit(enabled, 0, { canvas: { ...canvas, zones: {
      ...canvas.zones, title: { ...canvas.zones.title, y: 35 },
    } } });
    const disabled = transformFormatVisuals(moved, disableCanvasLayoutSlides);
    const viewed = slideForFormatDisplay(slide, 'carrossel', disabled.formatViews);
    expect(viewed.canvas.enabled).toBe(false);
    expect(viewed.canvas.zones.title.y).toBe(35);
    const removed = transformFormatVisuals(disabled, removeCanvasLayoutSlides);
    expect(slideForFormatDisplay(slide, 'carrossel', removed.formatViews).canvas).toBeNull();
    expect(removed.slides).toEqual(doc.slides);
    expect(removed.formatViews.apresentacao).toEqual(views.apresentacao);
  });

  it('também adapta apresentação sem metadados antigos de composição e sem foto', () => {
    const plain = { id: 'plain', title: 'Decisão', subtitle: 'Próximo passo', bodyAfterImage: 'Contexto', titleColor: '#222222' };
    const result = slideForFormatDisplay(plain, 'carrossel', {}, 'apresentacao');
    expect(result.canvas.zones.photo.w).toBe(100);
    expect(result.overlay).toBe(0);
    expect(result.titleColor).toBe('#222222');
    expect(result.formatAdaptedFrom).toBe('apresentacao');
    expect(slideForFormatDisplay(plain, 'carrossel', {})).toBe(plain);
  });
});
