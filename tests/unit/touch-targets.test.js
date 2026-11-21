import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GLOBAL_STYLE } from '../../src/styles/global-style.js';
import LoginModal from '../../src/components/LoginModal.jsx';
import PasswordField from '../../src/components/PasswordField.jsx';

// MOO-41 (auditoria 20/11): no celular, abas do login (36px), "Esqueci minha
// senha" (27px), "Mostrar senha" e controles de paywall/biblioteca/editor
// ficavam abaixo de 44px de alvo de toque.

const coarseBlock = () => {
  const start = GLOBAL_STYLE.indexOf('@media (pointer: coarse)');
  expect(start).toBeGreaterThan(-1);
  // Bloco até a chave que fecha o @media.
  let depth = 0;
  for (let i = GLOBAL_STYLE.indexOf('{', start); i < GLOBAL_STYLE.length; i += 1) {
    if (GLOBAL_STYLE[i] === '{') depth += 1;
    if (GLOBAL_STYLE[i] === '}') { depth -= 1; if (depth === 0) return GLOBAL_STYLE.slice(start, i + 1); }
  }
  return '';
};

describe('MOO-41 — alvo de toque de 44px em telas de toque', () => {
  it('regra global (pointer: coarse) dá 44px a botões, links, role=button e role=tab', () => {
    const block = coarseBlock();
    for (const sel of ['button', 'a[href]', '[role="button"]', '[role="tab"]']) expect(block).toContain(sel);
    expect(block).toMatch(/min-height:\s*44px/);
    expect(block).toMatch(/min-width:\s*44px/);
    // Especificidade zero: classes e estilos que já definem tamanho continuam valendo.
    expect(block).toContain(':where(');
  });

  it('não incha link no meio do texto nem controle de desenho fixo', () => {
    const block = coarseBlock();
    expect(block).toMatch(/:not\(:where\(p, li, small, label, figcaption, blockquote, td\) a\)/);
    expect(block).toContain('[data-touch-compact]');
    expect(block).toContain('[aria-label^="Ir para slide"]');
    // Compactos ganham área de toque invisível em vez de mudar o desenho.
    expect(block).toMatch(/\[data-touch-compact\]::after\s*\{[^}]*position:\s*absolute/);
  });

  it('stepper da caixa de texto no card e seleção de card não mudam de desenho', () => {
    const src = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
    expect(src('src/components/card/SlideCardInner.jsx')).toMatch(/aria-label=\{label\}\s+title=\{label\}\s+data-touch-compact=""/);
    expect(src('src/components/SidebarContent.jsx')).toMatch(/aria-pressed=\{isSelected\}\s+data-touch-compact=""/);
  });

  it('login: abas e "Esqueci minha senha" têm 44px em qualquer aparelho', () => {
    const html = renderToStaticMarkup(React.createElement(LoginModal, { open: true, onClose: () => {} }));
    for (const label of ['Entrar', 'Criar conta', 'Esqueci minha senha']) {
      const tag = new RegExp(`<button[^>]*style="[^"]*min-height:44px[^"]*"[^>]*>\\s*${label}\\s*</button>`);
      expect(html).toMatch(tag);
    }
  });

  it('"Mostrar senha" tem 44px', () => {
    const html = renderToStaticMarkup(React.createElement(PasswordField, { value: '', onChange: () => {} }));
    expect(html).toMatch(/<button[^>]*aria-label="Mostrar senha"[^>]*style="[^"]*min-height:44px/);
  });
});
