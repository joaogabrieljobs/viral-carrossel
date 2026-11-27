import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { HistoryButtons } from '../../src/components/ui/HistoryButtons.jsx';

// Telas do iPhone (27/11): o desfazer da faixa "Contexto ON" era um ícone
// pequeno e apagado, e havia outro desfazer redondo na fila de miniaturas.
// Os dois chamavam o mesmo histórico. Agora há um desfazer só, com rótulo.
const render = props => renderToStaticMarkup(React.createElement(HistoryButtons, {
  onUndo() {}, onRedo() {}, canUndo: true, canRedo: false, ...props,
}));
const tag = (html, label) => html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0] || '';
const px = (html, prop) => Number(html.match(new RegExp(`${prop}:(\\d+)px`))?.[1]);

describe('Desfazer: um botão, com rótulo e alvo de toque', () => {
  it('mostra "Desfazer" escrito, com 44 px de altura, e o Refazer ao lado', () => {
    const html = render();
    const undo = tag(html, 'Desfazer');
    expect(undo).toBeTruthy();
    expect(html).toMatch(/>Desfazer<\/span>/);
    expect(px(undo, 'min-height')).toBeGreaterThanOrEqual(44);
    expect(undo).not.toContain('disabled');
    const redo = tag(html, 'Refazer');
    expect(px(redo, 'min-height')).toBeGreaterThanOrEqual(44);
    expect(px(redo, 'min-width')).toBeGreaterThanOrEqual(44);
    expect(redo).toContain('disabled');
  });

  it('desabilitado fica claro: nativo, com aviso e sem cor de ação', () => {
    const html = render({ canUndo: false });
    const undo = tag(html, 'Desfazer');
    expect(undo).toContain('disabled');
    expect(undo).toContain('title="Nada para desfazer"');
    expect(undo).toContain('dashed');
    expect(render()).toContain('title="Desfazer a última alteração (⌘Z)"');
  });

  it('a faixa "Contexto ON" não repete o desfazer do editor', () => {
    const banner = fs.readFileSync(new URL('../../src/components/ProjectContextBanner.jsx', import.meta.url), 'utf8');
    expect(banner).not.toMatch(/onUndo|Undo2|<button/);
  });
});
