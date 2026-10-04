import { describe, it, expect } from 'vitest';
import {
  attachGenerationCanvasLayouts,
  autoAdjustSlides,
  enableCanvasLayoutSlides,
  disableCanvasLayoutSlides,
  removeCanvasLayoutSlides,
} from '../../src/utils/canvas-zones.js';

const base = { id: 's1', title: 'T', subtitle: 'S', bgImage: null, canvas: null };

describe('composição (canvas) — activar/desactivar preserva o que o utilizador ajustou', () => {
  it('activar pela primeira vez infere variante e zonas', () => {
    const [s] = enableCanvasLayoutSlides([base], 'livre');
    expect(s.canvas.enabled).toBe(true);
    expect(s.canvas.applied).toBe(true);
    expect(s.canvas.variant).toBe('classic');
    expect(s.canvas.zones.photo).toBeTruthy();
  });

  it('desactivar guarda as zonas; reactivar reutiliza-as em vez de repor os defaults', () => {
    const [on] = enableCanvasLayoutSlides([base], 'livre');
    const moved = { ...on, canvas: { ...on.canvas, zones: { ...on.canvas.zones, photo: { x: 10, y: 55, w: 80, h: 40 } } } };
    const [off] = disableCanvasLayoutSlides([moved]);
    expect(off.canvas.enabled).toBe(false);
    expect(off.canvas.applied).toBe(true);
    expect(off.canvas.zones.photo).toEqual({ x: 10, y: 55, w: 80, h: 40 });
    const [again] = enableCanvasLayoutSlides([off], 'livre');
    expect(again.canvas.enabled).toBe(true);
    expect(again.canvas.zones.photo).toEqual({ x: 10, y: 55, w: 80, h: 40 });
  });

  it('remover composição volta ao layout padrão (canvas null)', () => {
    const [on] = enableCanvasLayoutSlides([base], 'livre');
    const [gone] = removeCanvasLayoutSlides([on]);
    expect(gone.canvas).toBeNull();
  });

  it('geração guarda zonas sem marcar a composição como ativa', () => {
    const [generated] = attachGenerationCanvasLayouts([
      { ...base, imageQuery: 'retrato editorial', bgImage: 'blob:foto' },
    ], { creativePreset: 'livre', slideTextDensity: '1_1' });
    expect(generated.canvas?.zones).toBeTruthy();
    expect(generated.canvas?.enabled).toBe(false);
    expect(generated.canvas?.applied).toBe(false);
  });

  it('autoajuste global força cover e reduz texto longo', () => {
    const [adjusted] = autoAdjustSlides([{
      ...base,
      bgImage: 'blob:foto',
      bgFit: 'contain',
      bgX: 12,
      bgY: 84,
      bgZoom: 170,
      title: 'Uma manchete muito longa '.repeat(8),
      subtitle: 'Um texto de apoio igualmente longo. '.repeat(20),
      titleSize: 120,
      subSize: 120,
    }]);
    expect(adjusted.bgFit).toBe('cover');
    expect(adjusted.bgX).toBe(50);
    expect(adjusted.bgY).toBe(50);
    expect(adjusted.bgZoom).toBe(100);
    expect(adjusted.titleSize).toBeLessThan(120);
    expect(adjusted.subSize).toBeLessThan(120);
  });
});
