// Defeito visto na captura do card 5 (Feed): as linhas da grade suíça
// atravessavam o cabeçalho, o chapéu e o título. A grade do Livre segue a
// regra da grade dos estilos fixos: só nas margens, nunca atrás do texto.
import { describe, expect, it } from 'vitest';
import { FORMATOS, apoteoseLivre, overlapsY, textRects } from '../helpers/apoteose-livre.js';

describe('Livre social: grade de fundo fora do texto (card 5)', () => {
  it.each(FORMATOS)('%s: nenhuma faixa de linhas da grade cruza título, chapéu, tabela, cabeçalho ou selo', formato => {
    const slide = apoteoseLivre(formato)[4];
    const grids = slide.socialArt.chrome.filter(d => d.t === 'grid');
    expect(grids.length, 'a família suíça continua com a sua grade').toBeGreaterThan(0);
    for (const grid of grids) {
      const bands = Array.isArray(grid.bands) && grid.bands.length ? grid.bands : [[0, 100]];
      for (const [y0, y1] of bands) for (const rect of textRects(slide, formato)) {
        expect(overlapsY(y0, y1, rect.y, rect.y + rect.h), `${formato}: faixa ${y0}–${y1} × texto em ${rect.y.toFixed(1)}%`).toBe(false);
      }
    }
  });
});
