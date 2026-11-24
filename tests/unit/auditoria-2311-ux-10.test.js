import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { textNudgePosition } from '../../src/utils/text-nudge-position.js';

// UX-10: sem espaço ao lado do bloco de texto, os botões −/+ eram presos a
// 4 px da borda do card, por cima do título que a pessoa estava revisando.
const SIZE = 26;
const CLUSTER_W = SIZE * 2 + 4;
const rectOf = (pos) => ({ left: pos.left, right: pos.left + CLUSTER_W, top: pos.top, bottom: pos.top + SIZE });
const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const inside = (rect, card) => rect.left >= 4 && rect.top >= 4 && rect.right <= card.width - 4 && rect.bottom <= card.height - 4;

// Medidas da auditoria, em px relativos ao card (layout padrão: texto embaixo,
// à esquerda, ocupando quase toda a largura).
const CASES = {
  '390 px': { card: { width: 366, height: 457 }, block: { left: 42, right: 324, top: 250, bottom: 420 } },
  '1440 px': { card: { width: 360, height: 450 }, block: { left: 41, right: 319, top: 240, bottom: 410 } },
};

describe('UX-10 — botões −/+ não cobrem o texto do card ativo', () => {
  it.each(Object.entries(CASES))('layout padrão a %s: o par fica fora do bloco de texto e dentro do card', (_, { card, block }) => {
    const rect = rectOf(textNudgePosition({ block, card }));
    expect(intersects(rect, block)).toBe(false);
    expect(inside(rect, card)).toBe(true);
  });

  it('cabendo à direita ou à esquerda, continua ao lado, na altura do meio do bloco', () => {
    const card = { width: 400, height: 500 };
    expect(textNudgePosition({ block: { left: 30, right: 250, top: 100, bottom: 200 }, card })).toEqual({ left: 256, top: 137 });
    expect(textNudgePosition({ block: { left: 150, right: 380, top: 100, bottom: 200 }, card })).toEqual({ left: 88, top: 137 });
  });

  it('sem lado livre: acima do bloco; colado no topo: abaixo', () => {
    const card = { width: 366, height: 457 };
    const above = textNudgePosition({ block: { left: 20, right: 346, top: 200, bottom: 400 }, card });
    expect(above.top + SIZE).toBeLessThanOrEqual(200);
    const below = textNudgePosition({ block: { left: 20, right: 346, top: 10, bottom: 180 }, card });
    expect(below.top).toBeGreaterThanOrEqual(180);
    for (const pos of [above, below]) expect(inside(rectOf(pos), card)).toBe(true);
  });

  it('em qualquer posição do bloco com alguma faixa livre, o par não o cobre', () => {
    const card = { width: 366, height: 457 };
    for (let left = 4; left <= 120; left += 29) for (let width = 120; left + width <= 362; width += 60) {
      for (let top = 4; top <= 300; top += 37) for (let height = 40; top + height <= 453; height += 70) {
        const block = { left, right: left + width, top, bottom: top + height };
        const free = left >= CLUSTER_W + 10 || card.width - block.right >= CLUSTER_W + 10 || top >= SIZE + 10 || card.height - block.bottom >= SIZE + 10;
        if (!free) continue;
        const rect = rectOf(textNudgePosition({ block, card }));
        expect(intersects(rect, block), JSON.stringify(block)).toBe(false);
        expect(inside(rect, card), JSON.stringify(block)).toBe(true);
      }
    }
  });

  it('bloco do tamanho do card: o par ainda aparece, dentro do card', () => {
    const card = { width: 366, height: 457 };
    expect(inside(rectOf(textNudgePosition({ block: { left: 0, right: 366, top: 0, bottom: 457 }, card })), card)).toBe(true);
  });

  it('o card usa esta função para posicionar o par', () => {
    const source = readFileSync(new URL('../../src/components/card/SlideCardInner.jsx', import.meta.url), 'utf8');
    expect(source).toContain('textNudgePosition({');
  });
});
