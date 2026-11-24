import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REMOVE_CANVAS_LAYOUT_LABEL, canvasLayoutScopeNotice } from '../../src/utils/canvas-layout-copy.js';
import { disableCanvasLayoutSlides, enableCanvasLayoutSlides, removeCanvasLayoutSlides } from '../../src/utils/canvas-zones.js';

// UX-05: o aviso da composição mandava desfazer por "Desativar", botão que não
// existe com esse nome, e a ação equivalente não devolvia o layout dos cards.
const source = readFileSync(new URL('../../src/components/SidebarContent.jsx', import.meta.url), 'utf8');
const deck = () => ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, num: i + 1, title: `Card ${i + 1}`, subtitle: 'Texto', layout: 'bottom-left' }));

describe('UX-05 — aviso da composição cita um controle que existe e que desfaz', () => {
  const notice = canvasLayoutScopeNotice(5, 'cards');

  it('diz quantos cards mudam e cita o botão pelo nome que ele tem na tela', () => {
    expect(notice).toContain('Muda o layout dos 5 cards deste projeto.');
    expect(notice).toContain(REMOVE_CANVAS_LAYOUT_LABEL);
    expect(notice).toContain('Desfazer');
  });

  it('não cita "Desativar" nem atalho que só existe no Mac', () => {
    expect(notice).not.toMatch(/Desativar/);
    expect(notice).not.toMatch(/Cmd|Ctrl|⌘/);
  });

  it('o controle citado deixa todos os cards sem composição aplicada', () => {
    const active = enableCanvasLayoutSlides(deck(), 'livre');
    expect(active.every((slide) => slide.canvas?.applied === true)).toBe(true);
    const removed = removeCanvasLayoutSlides(active);
    expect(removed.filter((slide) => slide.canvas?.applied)).toHaveLength(0);
    // "Concluir edição" só sai do modo de edição: por isso não serve de saída.
    expect(disableCanvasLayoutSlides(active).every((slide) => slide.canvas?.applied === true)).toBe(true);
  });

  it('a barra lateral usa o mesmo texto no aviso e no botão', () => {
    expect(source).toContain('{canvasLayoutScopeNotice(slides.length, itemsLabel)}');
    expect(source).toMatch(/onClick=\{removeCanvasLayout\}[\s\S]{0,700}\{REMOVE_CANVAS_LAYOUT_LABEL\}/);
    expect(source).not.toMatch(/aria-label=\{`Desativar composição/);
  });
});
