// Auditoria 23/11 — UX-11: no plano grátis, a 360/390 px, "Salvo só neste
// aparelho" quebrava em 4 linhas e "Guardar na conta" saía cortado. O bloco
// tinha largura fixa, não quebrava e o botão não descia.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GLOBAL_STYLE } from '../../src/styles/global-style.js';
import { ProjectSaveStatus } from '../../src/components/ProjectSaveStatus.jsx';

const render = (props = {}) => renderToStaticMarkup(React.createElement(ProjectSaveStatus, {
  deviceOnly: true, localSavedAt: new Date(2026, 10, 24, 10, 42).getTime(), onUpgrade() {}, ...props,
}));
const css = GLOBAL_STYLE.replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (selector) => new RegExp(`${selector.replace(/[.\-]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] || '';

describe('UX-11 — aviso do plano grátis no topo do celular', () => {
  it('o aviso tem a versão curta para o celular e a completa para telas largas', () => {
    const html = render();
    expect(html).toMatch(/<span class="vc-save-device-only-long">Salvo só neste aparelho às 10:42<\/span>/);
    expect(html).toMatch(/<span class="vc-save-device-only-short">Só neste aparelho<\/span>/);
    // Um único aviso para o leitor de tela, com as duas versões dentro.
    expect(html.match(/role="status"/g)).toHaveLength(1);
  });

  it('o bloco não tem mais largura fixa nem texto que quebra em várias linhas', () => {
    const html = render();
    expect(html).toContain('class="vc-save-device-only"');
    expect(html).not.toContain('max-width:min(230px, 60vw)');
    const block = rule('.vc-save-device-only');
    expect(block).toMatch(/flex-wrap:\s*wrap/);
    expect(block).toMatch(/max-width:\s*100%/);
    expect(rule('.vc-save-device-only-text')).toMatch(/white-space:\s*nowrap/);
  });

  it('abaixo de 768 px vale a versão curta; o botão desce inteiro para a linha de baixo', () => {
    expect(rule('.vc-save-device-only-short')).toMatch(/display:\s*none/);
    const mobile = /@media \(max-width: 767px\) \{\s*\.vc-save-device-only-long \{ display: none; \}\s*\.vc-save-device-only-short \{ display: inline; \}\s*\}/;
    expect(css).toMatch(mobile);
    const html = render();
    const button = /<button[^>]*aria-label="Guardar na conta: ver planos"[^>]*>Guardar na conta<\/button>/.exec(html)?.[0] || '';
    expect(button).toContain('white-space:nowrap');
    expect(button).toContain('min-height:44px');
    expect(button).toContain('flex-shrink:0');
  });

  it('sem caminho de assinatura o aviso continua sem botão', () => {
    expect(render({ onUpgrade: undefined })).not.toContain('<button');
  });
});
