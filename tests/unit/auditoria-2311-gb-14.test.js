// Auditoria 23/11 — GB-14: o Criar rápido dizia "Projetos sincronizam na nuvem
// com a sua conta" também no plano grátis, onde o projeto só existe no aparelho.
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CriarRapidoHome } from '../../src/components/panels/CriarRapidoHome.jsx';

const render = (props = {}) => renderToStaticMarkup(React.createElement(CriarRapidoHome, {
  brand: { name: 'Marca' }, setBrand() {}, styleKit: {}, setStyleKit() {}, onExportBackup() {}, ...props,
}));

describe('GB-14 — onde os projetos ficam, conforme o plano', () => {
  it('no plano grátis o painel não promete nuvem e pede o backup', () => {
    const html = render({ freePlan: true });
    expect(html).not.toContain('sincronizam na nuvem');
    expect(html).toContain('ficam só neste aparelho');
    expect(html).toContain('backup JSON');
  });

  it('com plano pago o texto de nuvem continua', () => {
    expect(render()).toContain('Projetos sincronizam na nuvem com a sua conta.');
  });

  it('a barra lateral repassa o plano grátis ao Criar rápido', () => {
    const sidebar = readFileSync(new URL('../../src/components/SidebarContent.jsx', import.meta.url), 'utf8');
    const call = sidebar.slice(sidebar.indexOf('<CriarRapidoHome'));
    expect(call.slice(0, call.indexOf('/>'))).toContain('freePlan={freePlan}');
  });
});
