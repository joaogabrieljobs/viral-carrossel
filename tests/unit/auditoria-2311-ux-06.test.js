import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CaptionEditorDialog from '../../src/components/CaptionEditorDialog.jsx';

// UX-06: o diálogo da legenda se declarava modal, mas não fechava com Esc,
// deixava o Tab sair para o editor e não bloqueava o fundo. O ambiente de teste
// é node (sem DOM): o comportamento de foco é do hook compartilhado, já coberto;
// aqui garantimos que este diálogo está ligado a ele e mantém o que mostrava.
const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const render = (props = {}) => renderToStaticMarkup(React.createElement(CaptionEditorDialog, {
  open: true, onClose: () => {}, value: 'Legenda de teste', onChange: () => {}, onCopy: () => {}, ...props,
}));

describe('UX-06 — diálogo da legenda segue o contrato dos modais do editor', () => {
  it('usa o hook que trata Esc, prende o Tab, bloqueia o fundo e devolve o foco', () => {
    const dialog = source('src/components/CaptionEditorDialog.jsx');
    expect(dialog).toContain("import { useModalDialog } from '../hooks/useModalDialog.js'");
    expect(dialog).toMatch(/useModalDialog\(\{ open, onClose, initialFocusRef: \w+ \}\)/);
    expect(dialog).toContain('ref={overlayRef}');
    expect(dialog).toContain('ref={dialogRef}');
    expect(dialog).toContain('onKeyDown={onDialogKeyDown}');
  });

  it('o painel é o diálogo focável; o fundo escuro é só apresentação', () => {
    const html = render();
    expect(html).toMatch(/^<div[^>]*class="modal-overlay"[^>]*role="presentation"/);
    expect(html).toMatch(/<div[^>]*class="modal-panel"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-label="Legenda da publicação"[^>]*tabindex="-1"/);
    expect(html.match(/role="dialog"/g)).toHaveLength(1);
  });

  it('mantém título, campo, Copiar, Feito e Fechar', () => {
    const html = render();
    expect(html).toContain('Legenda de teste</textarea>');
    expect(html).toContain('placeholder="Escreva a legenda da publicação…"');
    expect(html).toContain('aria-label="Fechar"');
    expect(html).toContain('Copiar</button>');
    expect(html).toContain('Feito</button>');
  });

  it('em apresentação o nome do diálogo cita o número do slide', () => {
    const html = render({ isPresentation: true, slideNumber: 4 });
    expect(html).toContain('aria-label="Notas do slide 4"');
    expect(html).toContain('Notas · slide 4');
    expect(html).toContain('placeholder="Notas deste slide…"');
  });

  it('fechado não desenha nada', () => {
    expect(render({ open: false })).toBe('');
  });

  it('o editor usa este componente, sem diálogo de legenda montado à mão', () => {
    const app = source('ViralCarrossel.jsx');
    expect(app).toContain("import CaptionEditorDialog from './src/components/CaptionEditorDialog.jsx'");
    expect(app).toContain('<CaptionEditorDialog');
    expect(app).not.toMatch(/className="modal-overlay"\s+role="dialog"/);
  });
});
