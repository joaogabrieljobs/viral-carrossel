// Auditoria 23/11 — UX-08: interruptores sem anel de foco e sem estado, campo de
// texto com o contorno de teclado apagado, plano escolhido sem anúncio e posições
// da logo com nome só em seta.
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GLOBAL_STYLE } from '../../src/styles/global-style.js';
import { wcagContrast } from '../../src/utils/wcag.js';
import { Toggle } from '../../src/components/ui/primitives.jsx';
import Paywall from '../../src/components/Paywall.jsx';
import { SlideLogoPanel } from '../../src/components/panels/SlideLogoPanel.jsx';

const token = (name) => new RegExp(`--${name}:\\s*([^;]+);`).exec(GLOBAL_STYLE)?.[1].trim();

// Cascata mínima: entre regras de mesma especificidade vale a última. Devolve o
// `outline` que sobra num elemento focado por teclado (:focus e :focus-visible).
function keyboardFocusOutline(tag) {
  let outline = null;
  const css = GLOBAL_STYLE.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const applies = selectors.split(',').map((s) => s.trim()).some((s) => s === `${tag}:focus` || s === `${tag}:focus-visible`);
    const value = /(?:^|;)\s*outline:\s*([^;]+);/.exec(body)?.[1].trim();
    if (applies && value) outline = value;
  }
  return outline;
}

describe('UX-08 — foco e estado dos controles', () => {
  it('o interruptor é um switch com aria-checked e não apaga o próprio anel de foco', () => {
    const on = renderToStaticMarkup(React.createElement(Toggle, { label: 'Mostrar grade', value: true, onChange() {} }));
    const off = renderToStaticMarkup(React.createElement(Toggle, { label: 'Mostrar grade', value: false, onChange() {} }));
    expect(on).toMatch(/^<button type="button" role="switch" aria-checked="true"/);
    expect(off).toMatch(/^<button type="button" role="switch" aria-checked="false"/);
    expect(on).not.toMatch(/outline:\s*none/);
    expect(renderToStaticMarkup(React.createElement(Toggle, { label: 'Sem valor', onChange() {} }))).toContain('aria-checked="false"');
  });

  it('o anel de foco global dos botões tem 2 px na cor de acento', () => {
    expect(GLOBAL_STYLE).toMatch(/button:focus-visible,[^{]*\{\s*outline: 2px solid var\(--accent\);/);
  });

  it('textarea e select focados por teclado ficam com contorno de 2 px', () => {
    expect(keyboardFocusOutline('textarea')).toBe('2px solid var(--accent)');
    expect(keyboardFocusOutline('select')).toBe('2px solid var(--accent)');
  });

  it('o anel de foco passa de 3:1 contra os fundos, no carrossel e na apresentação', () => {
    const lime = /'--accent':\s*'([^']+)'/.exec(readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8'))?.[1];
    expect([token('accent-primary'), lime]).toEqual(['#5b53e8', '#d7ff5a']);
    for (const ring of [token('accent-primary'), lime]) {
      for (const bg of [token('bg-primary'), token('bg-secondary'), token('bg-tertiary')]) {
        expect(wcagContrast(ring, bg)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('a tela de planos anuncia qual plano está escolhido', () => {
    const html = renderToStaticMarkup(React.createElement(Paywall, {}));
    const plans = [...html.matchAll(/<button type="button" aria-pressed="(true|false)"[^>]*><strong[^>]*>([^<]+)<\/strong>/g)].map((m) => [m[2], m[1]]);
    expect(plans).toHaveLength(4);
    expect(plans.filter(([, pressed]) => pressed === 'true')).toEqual([['Plano Criador', 'true']]);
  });

  it('as posições da logo têm nome por extenso', () => {
    const html = renderToStaticMarkup(React.createElement(SlideLogoPanel, {
      slide: { id: 's1' }, updateSlide() {}, brand: { logo: 'data:image/png;base64,AAAA', logoPosition: 'tl' }, setBrand() {}, styleKit: {}, setStyleKit() {},
    }));
    for (const name of ['Superior esquerda', 'Superior direita', 'Centro', 'Inferior esquerda', 'Inferior direita']) {
      expect(html).toContain(`aria-label="${name}"`);
    }
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Superior esquerda"|aria-label="Superior esquerda"[^>]*aria-pressed="true"/);
  });
});
