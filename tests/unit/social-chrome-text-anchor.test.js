import { describe, expect, it } from 'vitest';
import { socialChromeElements } from '../../src/utils/social-chrome.js';

// MF-05 (QA 19/11, corrigido em c013e45 sem teste): barra, fio e numeral
// ancorados ao texto alinhado à esquerda andam com o recuo interno da caixa do
// título; sem isso começam fora da margem (Tabloid, Bold Promo, Sports).
const frame = { w: 1080, h: 1350 };
const brand = { bg: '#101010', text: '#ffffff', accent: '#ff3355' };
const art = { ground: 'bg', chrome: [
  { t: 'rule', x: 8, y: 40, w: 12, h: 0.6, color: 'accent', anchor: 'text' },
  { t: 'rule', x: 8, y: 10, w: 12, h: 0.6, color: 'accent' },
] };

describe('MF-05 — dispositivo ancorado ao texto segue a margem do título', () => {
  it('barra com anchor text recebe o recuo interno da caixa do título', () => {
    const [anchored] = socialChromeElements(art, { frame, brand, fonts: { titleInsetPx: 24 } });
    expect(anchored.style.left).toBe('calc(8% + 24px)');
  });

  it('dispositivo sem âncora no texto fica na posição do layout', () => {
    const [, free] = socialChromeElements(art, { frame, brand, fonts: { titleInsetPx: 24 } });
    expect(free.style.left).toBe('8%');
  });

  it('sem recuo, a barra ancorada fica na posição do layout', () => {
    const [anchored] = socialChromeElements(art, { frame, brand, fonts: {} });
    expect(anchored.style.left).toBe('8%');
  });
});
