// Auditoria 23/11 — UX-04: nos Ajustes rápidos a miniatura fotografada esconde a
// cor de fundo e o acento do estilo. O painel passa a mostrar as mesmas bolinhas
// de paleta do seletor grande, com as cores que o estilo aplica.
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuickAdjustmentsPanel } from '../../src/components/panels/QuickAdjustmentsPanel.jsx';
import { VISUAL_PRESETS } from '../../src/styles/visual-presets.jsx';
import { paletteSwatches } from '../../src/components/VisualStylePicker.jsx';

const presetButton = (html, label) => {
  const start = html.indexOf(`aria-label="Estilo ${label}"`);
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, html.indexOf('</button>', start));
};

describe('UX-04 — Ajustes rápidos mostram as cores reais de cada estilo', () => {
  const html = renderToStaticMarkup(React.createElement(QuickAdjustmentsPanel, {
    slide: { id: 'one', title: 'Título' }, activeIdx: 0, cardCount: 3, presets: VISUAL_PRESETS, visualPreset: 'bold_promo_rosa',
  }));

  it('"Bold Promo Pink" mostra o rosa do fundo e o âmbar do acento', () => {
    const pink = VISUAL_PRESETS.find((preset) => preset.id === 'bold_promo_rosa');
    expect(paletteSwatches(pink)).toEqual(['#be185d', '#ffffff', '#fbbf24']);
    const button = presetButton(html, 'Bold Promo Pink');
    expect(button).toContain('data-vc-style-swatches');
    for (const color of ['#be185d', '#ffffff', '#fbbf24']) expect(button).toContain(`background:${color}`);
  });

  it('cada estilo visível leva as próprias bolinhas, escondidas do leitor de tela', () => {
    const groups = html.match(/<span class="vc-quick-adjustments-swatches"[^>]*>/g) || [];
    expect(groups.length).toBeGreaterThanOrEqual(6);
    for (const group of groups) expect(group).toContain('aria-hidden="true"');
  });

  it('a folha de estilo dá tamanho às bolinhas', () => {
    const css = readFileSync(new URL('../../src/styles/quick-adjustments.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.vc-quick-adjustments-swatches\s*\{/);
    expect(css).toMatch(/\.vc-quick-adjustments-swatches i\s*\{[^}]*width:\s*10px/);
  });
});
