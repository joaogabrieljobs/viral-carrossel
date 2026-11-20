// MF-02 (reteste 19/11): lista de preços saía com "- " cru no carrossel.
import { describe, expect, it } from 'vitest';
import { displayListMarkers } from '../../src/utils/list-markers.js';

describe('marcador de lista na exibição', () => {
  it('troca "- " por "• " no começo da linha, mantendo o tamanho do texto', () => {
    const t = '- Francês R$ 1,20\n- Integral R$ 9,00\n  * Camponês R$ 14,00';
    const shown = displayListMarkers(t);
    expect(shown).toBe('• Francês R$ 1,20\n• Integral R$ 9,00\n  • Camponês R$ 14,00');
    expect(shown.length).toBe(t.length);
  });
  it('não mexe em hífen dentro do texto nem em número negativo', () => {
    expect(displayListMarkers('Pão-de-ló sai às 7h')).toBe('Pão-de-ló sai às 7h');
    expect(displayListMarkers('-10% no sábado')).toBe('-10% no sábado');
  });
});
