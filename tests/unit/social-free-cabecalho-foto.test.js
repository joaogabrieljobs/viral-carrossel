// Defeito visto na captura do card 3 (Stories, e também Feed e Quadrado, e
// nos cards 1 e 6): a foto começava atrás do cabeçalho da marca e o renderer
// punha uma placa da cor do fundo só sob o texto, como um adesivo na foto. A
// foto do Livre agora começa abaixo do cabeçalho; o cabeçalho fica no fundo.
import { describe, expect, it } from 'vitest';
import { FORMATOS, apoteoseLivre, fixture, headerRect, overlaps } from '../helpers/apoteose-livre.js';
import { photoBehindChromeRect } from '../../src/utils/card-chrome.js';

describe('Livre social: cabeçalho da marca fora da foto (cards 1, 3 e 6)', () => {
  it.each(FORMATOS)('%s: nenhuma foto passa por trás do cabeçalho, então ele não ganha placa', formato => {
    const slides = apoteoseLivre(formato);
    for (const index of fixture.expected.photoCards.map(card => card - 1)) {
      const slide = slides[index];
      const header = headerRect(slide, formato);
      expect(slide.canvas.zones.photo.w, `${formato}, card ${index + 1}: a foto continua`).toBeGreaterThan(20);
      expect(photoBehindChromeRect(slide, header, { element: 'headerBar' }), `${formato}, card ${index + 1}`).toBe(false);
      expect(overlaps(slide.canvas.zones.photo, header)).toBe(false);
    }
  });
});
