import { describe, expect, it } from 'vitest';
import { previewScaleUsesZoom } from '../../src/utils/preview-scale.js';

// iPhone (28/11): com o card reduzido por `zoom` de CSS, o Safari do iOS
// aumenta sozinho a letra do texto corrido (subtítulo, tabela). O card na tela
// ficava com o subtítulo maior e cortado, diferente do arquivo, e a célula da
// tabela crescia ainda mais ao entrar em edição. No iPhone e no iPad o card
// usa `transform: scale`, como no Firefox.
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1';
const CHROME_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Safari/605.1.15';
const MAC_SAFARI = IPAD_DESKTOP;
const CHROME_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Mobile Safari/537.36';

describe('escala do card na tela', () => {
  it('iPhone e iPad (Safari ou Chrome) não usam zoom', () => {
    expect(previewScaleUsesZoom({ supportsZoom: true, userAgent: IPHONE, maxTouchPoints: 5 })).toBe(false);
    expect(previewScaleUsesZoom({ supportsZoom: true, userAgent: CHROME_IPHONE, maxTouchPoints: 5 })).toBe(false);
    expect(previewScaleUsesZoom({ supportsZoom: true, userAgent: IPAD_DESKTOP, maxTouchPoints: 5 })).toBe(false);
  });
  it('computador e Android continuam com zoom (logo nítida)', () => {
    expect(previewScaleUsesZoom({ supportsZoom: true, userAgent: MAC_SAFARI, maxTouchPoints: 0 })).toBe(true);
    expect(previewScaleUsesZoom({ supportsZoom: true, userAgent: CHROME_DESKTOP, maxTouchPoints: 0 })).toBe(true);
    expect(previewScaleUsesZoom({ supportsZoom: true, userAgent: ANDROID, maxTouchPoints: 5 })).toBe(true);
  });
  it('sem suporte a zoom, nunca', () => {
    expect(previewScaleUsesZoom({ supportsZoom: false, userAgent: CHROME_DESKTOP, maxTouchPoints: 0 })).toBe(false);
  });
});
