import { describe, it, expect } from 'vitest';
import {
  enableCanvasLayoutSlides,
  disableCanvasLayoutSlides,
  removeCanvasLayoutSlides,
} from '../../src/utils/canvas-zones.js';

const base = { id: 's1', title: 'T', subtitle: 'S', bgImage: null, canvas: null };

describe('composição (canvas) — activar/desactivar preserva o que o utilizador ajustou', () => {
  it('activar pela primeira vez infere variante e zonas', () => {
    const [s] = enableCanvasLayoutSlides([base], 'livre');
    expect(s.canvas.enabled).toBe(true);
    expect(s.canvas.variant).toBe('classic');
    expect(s.canvas.zones.photo).toBeTruthy();
  });

  it('desactivar guarda as zonas; reactivar reutiliza-as em vez de repor os defaults', () => {
    const [on] = enableCanvasLayoutSlides([base], 'livre');
    const moved = { ...on, canvas: { ...on.canvas, zones: { ...on.canvas.zones, photo: { x: 10, y: 55, w: 80, h: 40 } } } };
    const [off] = disableCanvasLayoutSlides([moved]);
    expect(off.canvas.enabled).toBe(false);
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
});
