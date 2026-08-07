// Task 02 — RF-03: dimensões reais de export do Instagram.
import { describe, it, expect } from 'vitest';
import { FORMATS } from '../../src/utils/formats.js';

describe('FORMATS', () => {
  it('feed 4:5 é 1080x1350', () => {
    expect(FORMATS.carrossel.w).toBe(1080);
    expect(FORMATS.carrossel.h).toBe(1350);
  });

  it('quadrado é 1080x1080 e stories 1080x1920', () => {
    expect(FORMATS.quadrado).toMatchObject({ w: 1080, h: 1080 });
    expect(FORMATS.stories).toMatchObject({ w: 1080, h: 1920 });
  });

  it('todo formato define safe zones percentuais', () => {
    for (const f of Object.values(FORMATS)) {
      expect(f.edgePct).toBeGreaterThan(0);
      expect(f.topSafePct).toBeGreaterThan(0);
      expect(f.bottomSafePct).toBeGreaterThan(0);
      expect(typeof f.label).toBe('string');
    }
  });
});
