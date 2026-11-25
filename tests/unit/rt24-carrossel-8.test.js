import { describe, expect, it } from 'vitest';
import { PORTRAIT_FOCUS_Y, portraitTopAnchor } from '../../src/utils/photo-framing.js';

// RT24 item 8 (reteste real de 24/11): foto retrato em zona paisagem saía com
// a cabeça cortada (carrossel Ficha técnica, card 1, Feed e Stories). O recorte
// automático escolhia a região de mais detalhe (mãos, tronco). A direção é
// enquadrar pelo topo quando a pessoa não ajustou o recorte à mão.

/** Faixa da foto (0 a 1, de cima para baixo) que aparece na zona com `bgY`. */
function janela(imgW, imgH, zoneW, zoneH, bgY) {
  const visible = (zoneH / zoneW) / (imgH / imgW);
  const top = (bgY / 100) * (1 - visible);
  return [top, top + visible];
}
// Zonas de foto reais (px): capa e miolo da Ficha técnica no Feed e no Stories, Grade suíça no Quadrado.
const ZONAS = { 'Feed capa': [918, 486], 'Feed miolo': [918, 540], 'Stories capa': [918, 538], 'Stories miolo': [918, 634], 'Quadrado miolo': [918, 432] };
// Retratos de teste: [largura, altura, centro do rosto, raio do rosto] (frações da altura).
const RETRATOS = { 'A (3:4, rosto a 15%)': [900, 1200, 0.15, 0.08], 'B (3:4, rosto a 22%)': [900, 1200, 0.22, 0.08], 'C (9:16, rosto a 25%)': [900, 1600, 0.25, 0.08] };

describe('RT24 carrossel 8: foto retrato em zona paisagem enquadra pelo topo', () => {
  for (const [zona, [zw, zh]] of Object.entries(ZONAS)) {
    it.each(Object.entries(RETRATOS))(`${zona}: retrato %s mostra a cabeça inteira`, (_nome, [w, h, centro, raio]) => {
      const anchor = portraitTopAnchor(w, h, zw, zh);
      expect(anchor).not.toBeNull();
      expect(anchor.bgX).toBe(50);
      const [top, bottom] = janela(w, h, zw, zh, anchor.bgY);
      expect(top).toBeLessThanOrEqual(centro - raio + 0.001);
      expect(bottom).toBeGreaterThanOrEqual(centro + raio - 0.001);
    });
  }

  it('o recorte de antes (centro de detalhe, bgY 31%) cortava a cabeça do retrato A na capa do Feed', () => {
    const [top] = janela(900, 1200, 918, 486, 31.03);
    expect(top).toBeGreaterThan(0.15 - 0.08);
  });

  it('a âncora é o ponto a 22% da altura da foto; com janela larga, o topo da foto', () => {
    expect(PORTRAIT_FOCUS_Y).toBe(0.22);
    // 3:4 numa zona 918×540: cabe 44% da altura; o ponto a 22% fica no meio da janela (que começa no topo).
    expect(portraitTopAnchor(900, 1200, 918, 540).bgY).toBe(0);
    // 9:16 na mesma zona: cabe 33%; a janela desce só o que centra o ponto a 22%.
    const [top, bottom] = janela(900, 1600, 918, 540, portraitTopAnchor(900, 1600, 918, 540).bgY);
    expect((top + bottom) / 2).toBeCloseTo(0.22, 2);
  });

  it('não muda foto paisagem, nem retrato em zona retrato, nem foto que cabe inteira', () => {
    expect(portraitTopAnchor(1600, 1000, 918, 540)).toBeNull();
    expect(portraitTopAnchor(1600, 900, 918, 432)).toBeNull();
    expect(portraitTopAnchor(900, 1600, 1080, 1350)).toBeNull();
    expect(portraitTopAnchor(900, 1200, 432, 820)).toBeNull();
    expect(portraitTopAnchor(0, 0, 918, 540)).toBeNull();
  });

  it('zona quadrada conta como paisagem (o corte também é só em altura)', () => {
    expect(portraitTopAnchor(900, 1600, 1080, 1080)).toEqual({ bgX: 50, bgY: 0 });
  });
});
