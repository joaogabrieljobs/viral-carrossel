import { describe, expect, it } from 'vitest';
import {
  ELEMENT_CATALOG,
  addOverlayToSlide,
  normalizeOverlay,
  normalizeOverlays,
  overlayMoveKey,
  removeOverlayFromSlide,
  updateOverlayOnSlide,
} from '../../src/utils/card-overlays.js';

describe('card-overlays', () => {
  it('catálogo tem CTAs variados + linhas (sem bloco de texto solto)', () => {
    const ids = ELEMENT_CATALOG.map((e) => e.id);
    expect(ids).toContain('cta_filled');
    expect(ids).toContain('cta_outline');
    expect(ids).toContain('cta_glass');
    expect(ids).toContain('cta_gold_edge');
    expect(ids).toContain('rule_thin');
    expect(ids).not.toContain('text_soft');
    expect(ELEMENT_CATALOG.every((e) => e.group !== 'Texto')).toBe(true);
    for (const item of ELEMENT_CATALOG) {
      const ov = item.factory();
      expect(normalizeOverlay(ov)).toBeTruthy();
    }
  });

  it('normalizeOverlay rejeita tipos inválidos e limita lista', () => {
    expect(normalizeOverlay({ type: 'bomb' })).toBeNull();
    const many = Array.from({ length: 20 }, () => ({ type: 'rule', x: 10, y: 10, w: 20 }));
    expect(normalizeOverlays(many)).toHaveLength(12);
  });

  it('add/remove/update no slide', () => {
    const base = { id: 's1', overlays: [], elementsUnlocked: false };
    const cta = ELEMENT_CATALOG.find((e) => e.id === 'cta_filled').factory();
    const withCta = addOverlayToSlide(base, cta);
    expect(withCta.overlays).toHaveLength(1);
    expect(withCta.elementsUnlocked).toBe(true);
    expect(overlayMoveKey(withCta.overlays[0].id)).toMatch(/^ov_/);

    const patched = updateOverlayOnSlide(withCta, withCta.overlays[0].id, { text: 'NOVO CTA' });
    expect(patched.overlays[0].text).toBe('NOVO CTA');

    const cleared = removeOverlayFromSlide(patched, patched.overlays[0].id);
    expect(cleared.overlays).toHaveLength(0);
  });
});
