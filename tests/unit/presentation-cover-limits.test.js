// MF-10 (reteste 19/11): capa do Pitch (Editorial contemporâneo) com
// parágrafo cortado e exportação barrada: pedia 180 caracteres em 6 linhas
// para uma caixa de apoio de 35% × 15% do slide.
import { describe, expect, it } from 'vitest';
import { PRESENTATION_VISUAL_PRESETS, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { fitLimitsToZone } from '../../src/utils/presentation-composition.js';

describe('limite do apoio na capa e no fechamento segue a caixa', () => {
  for (const preset of PRESENTATION_VISUAL_PRESETS) {
    it(preset.id, () => {
      for (const [index, stage] of [[0, {}], [0, { contentMode: 'pitch' }], [9, {}]]) {
        const o = getPresentationCompositionOverrides(preset.id, { slide: {}, stage, index, count: 10 });
        const zone = o.canvas.zones.subtitle;
        const lim = o.presentationTextLimits;
        const fontPx = 1920 * 0.028 * o.subSize / 100;
        const lines = Math.floor((zone.h / 100 * 1080) / (fontPx * (o.subLeading || 140) / 100));
        expect(lim.subtitle.maxLines, `${index}`).toBeLessThanOrEqual(Math.max(1, lines));
        const total = lim.subtitle.maxChars + (lim.body?.maxChars || 0);
        const perLine = (zone.w / 100 * 1920) / (fontPx * 0.5);
        expect(total, `${index}: ${total} caracteres para ${lines} linhas de ~${Math.round(perLine)}`).toBeLessThanOrEqual(Math.ceil(lines * perLine * 1.15));
      }
    });
  }
  it('não amplia limites que já cabem', () => {
    const limits = { subtitle: { maxChars: 60, maxLines: 2 }, body: { maxChars: 20, maxLines: 1 } };
    const out = fitLimitsToZone(limits, { x: 0, y: 0, w: 80, h: 60 }, 100, 140);
    expect(out.subtitle.maxChars).toBe(60);
    expect(out.subtitle.maxLines).toBe(2);
  });
});
