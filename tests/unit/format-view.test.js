import { describe, expect, it } from 'vitest';
import {
  applyBrandEdit,
  applyFormatEdit,
  brandForFormatDisplay,
  formatFitFactor,
  logoRenderPx,
  presentationReadingSurface,
  slideForFormatDisplay,
} from '../../src/utils/format-view.js';

const slide = {
  id: 's1',
  title: 'Sua pele. Seu cuidado.',
  titleSize: 100,
  subSize: 100,
  textBlockWidth: 62,
  bgImage: 'data:image/png,foto',
  elementOffsets: { title: { x: 4, y: 8 } },
};

describe('proporção sem reescrever o card', () => {
  it('o feed desenha o slide salvo', () => {
    expect(slideForFormatDisplay(slide, 'carrossel', {})).toBe(slide);
    expect(formatFitFactor('carrossel')).toBe(1);
  });

  it('a apresentação encolhe o texto só na tela e guarda a largura à parte', () => {
    const viewed = slideForFormatDisplay(slide, 'apresentacao', {
      apresentacao: { slides: { s1: { textBlockWidth: 48 } } },
    });
    expect(viewed.titleSize).toBeLessThan(70);
    expect(viewed.textBlockWidth).toBe(48);
    expect(slide.titleSize).toBe(100);
    expect(slide.textBlockWidth).toBe(62);
  });

  it('editar a caixa fora do feed não mexe no slide', () => {
    const next = applyFormatEdit({ fmt: 'stories', slides: [slide] }, 0, { textBlockWidth: 80 });
    expect(next.slides[0].textBlockWidth).toBe(62);
    expect(next.formatViews.stories.slides.s1.textBlockWidth).toBe(80);
  });

  it('editar a caixa no feed grava no slide', () => {
    const next = applyFormatEdit({ fmt: 'carrossel', slides: [slide] }, 0, { textBlockWidth: 80 });
    expect(next.slides[0].textBlockWidth).toBe(80);
    expect(next.formatViews).toBeUndefined();
  });

  it('mover no feed conserva os outros deslocamentos', () => {
    const next = applyFormatEdit(
      { fmt: 'carrossel', slides: [slide] },
      0,
      { elementOffsets: { text: { x: 2, y: 3 } } },
    );
    expect(next.slides[0].elementOffsets.title).toEqual({ x: 4, y: 8 });
    expect(next.slides[0].elementOffsets.text).toEqual({ x: 2, y: 3 });
  });

  it('fundo de leitura só aparece na apresentação sem foto', () => {
    expect(presentationReadingSurface('apresentacao', '#f7f7f5', '#f7f4ef', false)).toBe('#161616');
    expect(presentationReadingSurface('apresentacao', '#f7f7f5', '#f7f4ef', true)).toBeNull();
    expect(presentationReadingSurface('carrossel', '#f7f7f5', '#f7f4ef', false)).toBeNull();
  });

  it('a logo do 16:9 cabe na altura e a do feed fica no tamanho salvo', () => {
    expect(logoRenderPx('apresentacao', 1920, 260)).toBeLessThan(100);
    expect(logoRenderPx('carrossel', 1080, 260)).toBe(260);
    expect(logoRenderPx('apresentacao', 1920, 520)).toBeGreaterThan(logoRenderPx('apresentacao', 1920, 260));
  });

  it('tamanho salvo na proporção vence o encaixe automático', () => {
    const viewed = slideForFormatDisplay(slide, 'stories', {
      stories: { slides: { s1: { titleSize: 80 } } },
    });
    expect(viewed.titleSize).toBe(80);
    expect(slide.titleSize).toBe(100);
  });

  it('tamanho, cor e logo ajustados fora do feed ficam só nessa proporção', () => {
    const sized = applyFormatEdit({ fmt: 'quadrado', slides: [slide] }, 0, {
      titleSize: 74,
      titleColor: '#112233',
      title: 'Texto compartilhado',
    });
    expect(sized.slides[0].titleSize).toBe(100);
    expect(sized.slides[0].titleColor).toBeUndefined();
    expect(sized.slides[0].title).toBe('Texto compartilhado');
    expect(sized.formatViews.quadrado.slides.s1.titleSize).toBe(74);
    expect(sized.formatViews.quadrado.slides.s1.titleColor).toBe('#112233');

    const branded = applyBrandEdit({
      fmt: 'apresentacao',
      brand: { logoSize: 260, bg: '#fafafc', name: 'Clínica' },
      slides: [slide],
    }, { logoSize: 180, bg: '#111111', name: 'Clínica' });
    expect(branded.brand.logoSize).toBe(260);
    expect(branded.brand.bg).toBe('#fafafc');
    expect(branded.formatViews.apresentacao.brand.logoSize).toBe(180);
    expect(branded.formatViews.apresentacao.brand.bg).toBe('#111111');
    expect(brandForFormatDisplay(branded.brand, 'apresentacao', branded.formatViews).logoSize).toBe(180);
    expect(brandForFormatDisplay(branded.brand, 'carrossel', branded.formatViews).bg).toBe('#fafafc');
  });
});
