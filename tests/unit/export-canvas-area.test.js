import { describe, expect, it } from 'vitest';
import { canvasScaleWithinArea } from '../../src/hooks/useExport.js';

// MOO-02 (auditoria 20/11): Stories e Apresentação a 3× davam canvas de
// 3240×5760 (18,66 Mpx), acima do teto de 16.777.216 px do Safari no iPhone e
// no iPad; o export saía como "PNG vazio".
const IOS_CANVAS_MAX_AREA = 16_777_216;
const FORMATS = { feed: [1080, 1350], quadrado: [1080, 1080], stories: [1080, 1920], apresentacao: [1920, 1080] };

describe('MOO-02 — escala do export cabe no canvas do iOS', () => {
  it.each(Object.entries(FORMATS))('%s a 3× não passa do teto de área', (_name, [w, h]) => {
    const scale = canvasScaleWithinArea(w, h, 3);
    expect(Math.ceil(w * scale) * Math.ceil(h * scale)).toBeLessThanOrEqual(IOS_CANVAS_MAX_AREA);
  });

  it('Feed e Quadrado continuam na escala pedida', () => {
    expect(canvasScaleWithinArea(1080, 1350, 3)).toBe(3);
    expect(canvasScaleWithinArea(1080, 1080, 3)).toBe(3);
  });

  it('Stories e Apresentação ficam com a maior escala que cabe, acima de 2,7×', () => {
    expect(canvasScaleWithinArea(1080, 1920, 3)).toBeGreaterThan(2.7);
    expect(canvasScaleWithinArea(1920, 1080, 3)).toBeLessThan(3);
  });

  it('escala menor pedida (PDF no celular) é respeitada', () => {
    expect(canvasScaleWithinArea(1080, 1920, 2)).toBe(2);
  });
});
