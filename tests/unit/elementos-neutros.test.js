// Elementos do painel (CTAs e linhas) em preto, branco e cinza (João, 27/11):
// "PADRÃO NAS MINIATURAS. SEM ESSA COR BEGE. DEPOIS ESCOLHE QUALQUER COR."
// As miniaturas ficam sobre cinza neutro e o elemento entra neutro no card;
// a cor continua livre na edição.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ELEMENT_CATALOG, normalizeOverlay, updateOverlayOnSlide, addOverlayToSlide } from '../../src/utils/card-overlays.js';
import { ElementsPanel } from '../../src/components/panels/ElementsPanel.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';

/** Cinza: r = g = b (hex de 3 ou 6 dígitos, rgb/rgba) ou transparente. */
function neutral(value) {
  const v = String(value).trim().toLowerCase();
  if (v === 'transparent' || v === 'none') return true;
  let m = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (m) return m[1] === m[2] && m[2] === m[3];
  m = v.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
  if (m) return m[1] === m[2] && m[2] === m[3];
  m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return m[1] === m[2] && m[2] === m[3];
  return false;
}
const COLORS = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)/g;

describe('Elementos neutros', () => {
  it('cada CTA e linha entra no card em preto, branco ou cinza', () => {
    for (const item of ELEMENT_CATALOG) {
      const overlay = normalizeOverlay(item.factory());
      const colors = overlay.type === 'cta' ? [overlay.bg, overlay.fg, overlay.border] : [overlay.color];
      for (const color of colors) expect(neutral(color), `${item.label}: ${color}`).toBe(true);
    }
  });

  it('nomes e dicas não falam de cor que o elemento não tem', () => {
    for (const item of ELEMENT_CATALOG) {
      expect(`${item.label} ${item.hint}`, item.id).not.toMatch(/mocha|cream|ouro|dourad|bege|accent|marca/i);
    }
    const labels = ELEMENT_CATALOG.map((item) => item.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('as miniaturas do painel ficam sobre cinza neutro, sem o degradê bege', () => {
    const html = renderToStaticMarkup(React.createElement(ElementsPanel, { slide: mkSlide(1, DEFAULT_BRAND), brand: {} }));
    expect(html).not.toMatch(/gradient/i);
    const previews = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1]);
    expect(previews.length).toBe(ELEMENT_CATALOG.length);
    for (const preview of previews) {
      for (const color of preview.match(COLORS) || []) expect(neutral(color), color).toBe(true);
    }
  });

  it('depois de inserir, qualquer cor continua valendo', () => {
    const cta = ELEMENT_CATALOG.find((item) => item.id === 'cta_filled').factory();
    const slide = addOverlayToSlide(mkSlide(1, DEFAULT_BRAND), cta);
    const edited = updateOverlayOnSlide(slide, cta.id, { bg: '#B4235A', fg: '#FFE27A', border: '#0F7B6C' });
    expect(normalizeOverlay(edited.overlays[0])).toMatchObject({ bg: '#B4235A', fg: '#FFE27A', border: '#0F7B6C' });
    const rule = ELEMENT_CATALOG.find((item) => item.group === 'Linhas').factory();
    const withRule = updateOverlayOnSlide(addOverlayToSlide(mkSlide(1, DEFAULT_BRAND), rule), rule.id, { color: '#C4A574' });
    expect(normalizeOverlay(withRule.overlays[0]).color).toBe('#C4A574');
  });
});
