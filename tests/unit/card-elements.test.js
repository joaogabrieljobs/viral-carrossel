import { describe, it, expect } from 'vitest';
import {
  MOVABLE_ELEMENTS,
  clampOffsetPct,
  getElementOffset,
  hasElementOffset,
  elementOffsetStyle,
  offsetAfterDrag,
  resetElementOffsetsPatch,
} from '../../src/utils/card-elements.js';

const F = { w: 1080, h: 1350 };

describe('offsets de elementos do card', () => {
  it('slide sem offsets devolve zero e nenhum estilo', () => {
    const s = {};
    expect(getElementOffset(s, 'text')).toEqual({ x: 0, y: 0 });
    expect(hasElementOffset(s, 'text')).toBe(false);
    // undefined em vez de transform:none — não cria contexto de empilhamento à toa
    expect(elementOffsetStyle(s, 'text', F)).toBeUndefined();
  });

  it('converte % do card em px do formato', () => {
    const s = { elementOffsets: { text: { x: 10, y: -20 } } };
    expect(elementOffsetStyle(s, 'text', F).transform).toBe('translate(108px, -270px)');
  });

  it('a mesma composição vale em qualquer formato', () => {
    // É por isso que o offset é guardado em %, não em px: o carrossel exportado
    // em 4:5, quadrado e stories tem de manter a composição.
    const s = { elementOffsets: { pill: { x: 25, y: 0 } } };
    const feed = elementOffsetStyle(s, 'pill', { w: 1080, h: 1350 });
    const stories = elementOffsetStyle(s, 'pill', { w: 1080, h: 1920 });
    expect(feed.transform).toBe(stories.transform); // mesma largura → mesmo dx
    const quadrado = elementOffsetStyle(s, 'pill', { w: 1080, h: 1080 });
    expect(quadrado.transform).toBe(feed.transform);
  });

  it('trava o deslocamento para o elemento não sumir do card', () => {
    expect(clampOffsetPct(999)).toBe(60);
    expect(clampOffsetPct(-999)).toBe(-60);
    expect(clampOffsetPct('abc')).toBe(0);
    expect(clampOffsetPct(undefined)).toBe(0);
  });

  it('valor corrompido no storage não quebra o render', () => {
    expect(getElementOffset({ elementOffsets: { text: 'lixo' } }, 'text')).toEqual({ x: 0, y: 0 });
    expect(getElementOffset({ elementOffsets: { text: { x: null } } }, 'text')).toEqual({ x: 0, y: 0 });
  });

  it('arrasto soma ao deslocamento já existente', () => {
    const s = { elementOffsets: { text: { x: 10, y: 0 } } };
    // +108px de card = +10% da largura
    expect(offsetAfterDrag(s, 'text', 108, 0, F).x).toBeCloseTo(20, 6);
    expect(offsetAfterDrag(s, 'text', 0, 135, F).y).toBeCloseTo(10, 6);
  });

  it('repor devolve patch, não o slide inteiro', () => {
    const s = { title: 'x', elementOffsets: { text: { x: 5, y: 5 }, pill: { x: 1, y: 1 } } };
    expect(resetElementOffsetsPatch(s, 'text')).toEqual({ elementOffsets: { pill: { x: 1, y: 1 } } });
    expect(resetElementOffsetsPatch(s)).toEqual({ elementOffsets: {} });
    // não devolve outras chaves do slide — updateSlide faz merge
    expect(resetElementOffsetsPatch(s, 'text').title).toBeUndefined();
  });

  it('a lista de elementos móveis não tem chave repetida', () => {
    const chaves = MOVABLE_ELEMENTS.map((e) => e.key);
    expect(new Set(chaves).size).toBe(chaves.length);
    for (const e of MOVABLE_ELEMENTS) expect(e.label.length).toBeGreaterThan(2);
  });
});
