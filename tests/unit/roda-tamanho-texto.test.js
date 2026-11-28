import { describe, expect, it } from 'vitest';
import { textSizeTarget, wheelValue } from '../../src/utils/text-size-wheel.js';

// Pedido do João (28/11): no celular, tocar numa caixa de texto mostra uma roda
// ao lado do card; girar para cima aumenta a letra, para baixo diminui.
describe('roda de tamanho: o que cada caixa ajusta', () => {
  const slide = {
    titleSize: 56.2, subSize: 67.53,
    overlays: [{ id: 'a', type: 'text', size: 3.4, text: 'Oi', x: 10, y: 10 }, { id: 'b', type: 'cta', size: 120, text: 'Compre', x: 50, y: 80 }],
  };
  it('título e subtítulo usam o tamanho desenhado na proporção', () => {
    expect(textSizeTarget(slide, 'title')).toMatchObject({ value: 56.2, min: 20, max: 240 });
    expect(textSizeTarget(slide, 'title').patch(60)).toEqual({ titleSize: 60 });
    expect(textSizeTarget(slide, 'subtitle').patch(70)).toEqual({ subSize: 70 });
  });
  it('texto abaixo da foto parte do subtítulo quando não tem tamanho próprio', () => {
    expect(textSizeTarget(slide, 'bodyAfterImage').value).toBe(67.53);
    expect(textSizeTarget(slide, 'bodyAfterImage').patch(80)).toEqual({ bodyAfterSize: 80 });
  });
  it('caixa de texto livre e chamada mudam só a própria caixa', () => {
    const livre = textSizeTarget(slide, 'ov_a');
    expect(livre).toMatchObject({ value: 3.4, min: 1.5, max: 8, step: 0.1 });
    const overlays = livre.patch(4.2).overlays;
    expect(overlays.find(o => o.id === 'a').size).toBe(4.2);
    expect(overlays.find(o => o.id === 'b').size).toBe(120);
    expect(textSizeTarget(slide, 'ov_b')).toMatchObject({ value: 120, min: 50, max: 240 });
  });
  it('foto, logo e caixa inexistente não têm roda', () => {
    for (const key of ['photo', 'logo', 'ov_x', '']) expect(textSizeTarget(slide, key)).toBeNull();
  });
});

describe('roda de tamanho: girar', () => {
  it('para cima aumenta, para baixo diminui, proporcional à faixa', () => {
    expect(wheelValue({ start: 100, pixels: 36, min: 20, max: 240, step: 1 })).toBe(122);
    expect(wheelValue({ start: 100, pixels: -36, min: 20, max: 240, step: 1 })).toBe(78);
  });
  it('respeita limites e passo', () => {
    expect(wheelValue({ start: 230, pixels: 500, min: 20, max: 240, step: 1 })).toBe(240);
    expect(wheelValue({ start: 3.4, pixels: 7, min: 1.5, max: 8, step: 0.1 })).toBe(3.5);
    expect(wheelValue({ start: 1.6, pixels: -400, min: 1.5, max: 8, step: 0.1 })).toBe(1.5);
  });
});
