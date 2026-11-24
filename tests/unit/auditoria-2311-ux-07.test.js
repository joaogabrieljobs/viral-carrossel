// Auditoria 23/11 — UX-07: o roxo da marca (#5b53e8) fica entre 2,8 e 3,6:1 como
// texto pequeno em fundo escuro. O acento continua em fundo e borda; texto
// pequeno usa `--accent-secondary`, que acompanha o produto (violeta no
// carrossel, lima clara na apresentação).
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GLOBAL_STYLE } from '../../src/styles/global-style.js';
import { wcagContrast } from '../../src/utils/wcag.js';
import AccountUsage from '../../src/components/AccountUsage.jsx';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const token = (name) => new RegExp(`--${name}:\\s*([^;]+);`).exec(GLOBAL_STYLE)?.[1].trim();
const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const over = (fg, bg, alpha) => `#${channels(fg).map((v, i) => Math.round(v * alpha + channels(bg)[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;

const backgrounds = [token('bg-primary'), token('bg-secondary'), token('bg-tertiary')];
// Carrossel: valores de :root. Apresentação: o que o editor troca no contêiner.
const monolith = source('ViralCarrossel.jsx');
const presentation = (name) => new RegExp(`'--${name}':\\s*'([^']+)'`).exec(monolith)?.[1];
const palettes = [
  { name: 'carrossel', accent: token('accent-primary'), text: token('accent-violet'), onAccent: token('text-on-accent'), surfaceAlpha: 0.12 },
  { name: 'apresentação', accent: presentation('accent'), text: presentation('accent-secondary'), onAccent: presentation('text-on-accent'), surfaceAlpha: 0.11 },
];

describe('UX-07 — contraste do acento como texto', () => {
  it('os tokens lidos são os esperados', () => {
    expect(backgrounds).toEqual(['#090a0f', '#11131b', '#181b25']);
    expect(token('accent-secondary')).toBe('var(--accent-violet)');
    expect(palettes.map((p) => [p.accent, p.text, p.onAccent])).toEqual([
      ['#5b53e8', '#9a94ff', '#ffffff'], ['#d7ff5a', '#e8ff9b', '#090a0f'],
    ]);
  });

  it('o roxo da marca não chega a 4,5:1 como texto: por isso ele sai do texto pequeno', () => {
    for (const bg of backgrounds) expect(wcagContrast('#5b53e8', bg)).toBeLessThan(4.5);
  });

  it.each(palettes)('$name: texto de acento passa de 4,5:1 nos três fundos e sobre a superfície de acento', ({ accent, text, surfaceAlpha }) => {
    for (const bg of backgrounds) {
      expect(wcagContrast(text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(wcagContrast(text, over(accent, bg, surfaceAlpha))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(palettes)('$name: texto sobre o acento cheio passa de 4,5:1', ({ accent, onAccent }) => {
    expect(wcagContrast(onAccent, accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('Ajustes rápidos: o botão principal e o selo usam a cor de texto sobre acento, que existe', () => {
    const css = source('src/styles/quick-adjustments.css');
    expect(css).not.toContain('--accent-text');
    expect(css).toMatch(/\.vc-quick-adjustments-primary \{[^}]*color: var\(--text-on-accent, #fff\) !important/);
    expect(css).toMatch(/\.vc-quick-adjustments-selected \{[^}]*color: var\(--text-on-accent, #fff\)/);
  });

  it('início: "Começar a criação", "atual", "Renomear" e "Abrindo projeto…" usam o texto de acento', () => {
    expect(source('src/styles/project-entry.css'))
      .toContain('.project-entry-choice--create .project-entry-choice-action { color: var(--accent-secondary); }');
    const shell = source('src/components/AccountHomeShell.jsx');
    expect(shell).not.toMatch(/color:\s*'var\(--accent\)'/);
    expect(shell.match(/color:\s*'var\(--accent-secondary\)'/g)).toHaveLength(3);
  });

  it('Marca e planos: "Só no card N" e o selo do plano usam o texto de acento', () => {
    const logo = source('src/components/panels/SlideLogoPanel.jsx');
    expect(logo.slice(logo.indexOf('Só no card') - 220, logo.indexOf('Só no card'))).toContain("color: 'var(--accent-secondary)'");
    const paywall = source('src/components/Paywall.jsx');
    expect(paywall.slice(paywall.indexOf("'Escolha o plano'") - 260, paywall.indexOf("'Escolha o plano'"))).toContain("color: 'var(--accent-secondary, #9a94ff)'");
  });

  it('Uso: "Crédito devolvido" sai com o texto de acento', () => {
    const html = renderToStaticMarkup(React.createElement(AccountUsage, {
      planTier: 'creator',
      imageQuota: { status: 'available', available: true, used: 1, limit: 50, remaining: 49, tier: 'creator',
        activity: [{ source: 'editor', status: 'refunded', createdAt: '2026-11-20T12:00:00.000Z', updatedAt: '2026-11-20T12:01:00.000Z' }] },
    }));
    expect(html).toMatch(/color:var\(--accent-secondary\)">Crédito devolvido</);
  });

  it('"Composição ativa": o texto sobre o verde passa de 4,5:1', () => {
    const sidebar = source('src/components/SidebarContent.jsx');
    const button = sidebar.slice(sidebar.indexOf('onClick={enableCanvasLayout}'), sidebar.indexOf('Composição ativa'));
    const [, textVar] = /color: anyCanvasEnabled \? 'var\(--([a-z-]+)\)'/.exec(button) || [];
    expect(textVar).toBe('bg-primary');
    expect(wcagContrast('#ffffff', token('success'))).toBeLessThan(4.5);
    for (const green of [token('success'), '#16a34a']) expect(wcagContrast(token(textVar), green)).toBeGreaterThanOrEqual(4.5);
  });
});
