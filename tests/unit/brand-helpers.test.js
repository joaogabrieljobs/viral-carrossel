// Task 02 — RF-03: normalização de marca e resolução de fundo por slide.
import { describe, it, expect } from 'vitest';
import {
  hydrateBrandTextColors,
  vcCustomTitleFace,
  effectiveTitleFontFamily,
  resolveSlideBrandBg,
} from '../../src/utils/brand-helpers.js';

describe('hydrateBrandTextColors', () => {
  it('migra subColor legado para textColor e subtitleColor e remove subColor', () => {
    const out = hydrateBrandTextColors({ subColor: '#123456' });
    expect(out.textColor).toBe('#123456');
    expect(out.subtitleColor).toBe('#123456');
    expect('subColor' in out).toBe(false);
  });

  it('não sobrescreve cores explícitas existentes', () => {
    const out = hydrateBrandTextColors({
      subColor: '#000000',
      textColor: '#111111',
      subtitleColor: '#222222',
    });
    expect(out.textColor).toBe('#111111');
    expect(out.subtitleColor).toBe('#222222');
  });

  it('sem nada, aplica default e subtitleColor herda textColor', () => {
    const out = hydrateBrandTextColors({});
    expect(out.textColor).toBe('#515154');
    expect(out.subtitleColor).toBe(out.textColor);
  });
});

describe('fonte própria', () => {
  it('face CSS é única por perfil', () => {
    expect(vcCustomTitleFace('abc')).toBe('VCBrandTitle-abc');
    expect(vcCustomTitleFace()).toBe('VCBrandTitle-default');
  });

  it('com ficheiro próprio, face custom vem antes da fonte Google', () => {
    const brand = { id: 'b1', titleFont: '"Inter", sans-serif', customTitleFont: { dataUrl: 'data:font/woff2;base64,AA' } };
    expect(effectiveTitleFontFamily(brand)).toBe('VCBrandTitle-b1, "Inter", sans-serif');
    expect(effectiveTitleFontFamily({ titleFont: '"Sora"' })).toBe('"Sora"');
  });
});

describe('resolveSlideBrandBg', () => {
  const brand = { bg: '#ffffff', interleaveBg: true, bgAlternate: '#eeeeee' };

  it('customBg do slide vence tudo', () => {
    expect(resolveSlideBrandBg(brand, 1, { customBg: '#ff0000' })).toBe('#ff0000');
  });

  it('intercala pares/ímpares quando interleaveBg ativo', () => {
    expect(resolveSlideBrandBg(brand, 0, {})).toBe('#ffffff');
    expect(resolveSlideBrandBg(brand, 1, {})).toBe('#eeeeee');
    expect(resolveSlideBrandBg(brand, 2, {})).toBe('#ffffff');
  });

  it('sem intercalar, sempre bg base; sem marca, default', () => {
    expect(resolveSlideBrandBg({ bg: '#101010', interleaveBg: false, bgAlternate: '#fff' }, 1, {})).toBe('#101010');
    expect(resolveSlideBrandBg(undefined, 0, {})).toBe('#fafafc');
  });
});
