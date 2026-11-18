import { describe, it, expect } from 'vitest';
import { footerChromeReservePx, footerChromeReservePct } from '../../src/utils/card-chrome.js';
import { FORMATS } from '../../src/utils/formats.js';

const feed = FORMATS.carrossel; // 1080 × 1350

describe('reserva do rodapé — selo e barra de três colunas', () => {
  it('sem ornamento não reserva nada', () => {
    expect(footerChromeReservePx({}, feed)).toBe(0);
    expect(footerChromeReservePx({ footerPillText: '   ' }, feed)).toBe(0);
    expect(footerChromeReservePx(null, feed)).toBe(0);
    expect(footerChromeReservePct({}, 'carrossel')).toBe(0);
  });

  it('selo com seta reserva a altura da seta, que é maior que a do texto', () => {
    // 1350×0,058 + (1350×0,024 + 1080×0,05) + 1350×0,018 = 78,3 + 86,4 + 24,3
    expect(footerChromeReservePx({ footerPillText: 'ARRASTA PRO LADO' }, feed)).toBeCloseTo(189, 5);
  });

  it('selo sem seta reserva pela linha de texto', () => {
    // 78,3 + (32,4 + 1080×0,026×1,25) + 24,3
    expect(footerChromeReservePx({ footerPillText: '#tag', footerPillArrow: false }, feed)).toBeCloseTo(170.1, 5);
  });

  it('barra de três colunas com rótulo|valor reserva duas linhas', () => {
    const marca = { footerBarLeft: 'Tema|Growth', footerBarCenter: 'Por|Marca', footerBarRight: 'Salve|↓' };
    // 1350×0,038 + (1080×0,020×1,3 + 1350×0,004 + 1080×0,022×1,3) + 24,3
    expect(footerChromeReservePx(marca, feed)).toBeCloseTo(139.968, 5);
    expect(footerChromeReservePx({ footerBarLeft: 'Tema' }, feed)).toBeCloseTo(103.68, 5);
  });

  it('com selo e barra prevalece a maior reserva', () => {
    const marca = { footerPillText: 'x', footerBarLeft: 'Tema|Growth' };
    expect(footerChromeReservePx(marca, feed)).toBeCloseTo(189, 5);
  });

  it('percentual arredonda para cima em passos de 0,5 e acompanha o formato', () => {
    expect(footerChromeReservePct({ footerPillText: 'x' }, 'carrossel')).toBe(14);
    expect(footerChromeReservePct({ footerPillText: 'x', footerPillArrow: false }, 'carrossel')).toBe(13);
    expect(footerChromeReservePct({ footerBarLeft: 'a|b' }, 'carrossel')).toBe(10.5);
    // Quadrado: a seta pesa mais sobre uma altura menor.
    expect(footerChromeReservePct({ footerPillText: 'x' }, 'quadrado')).toBe(15);
    // Stories: altura maior dilui a largura fixa da seta.
    expect(footerChromeReservePct({ footerPillText: 'x' }, 'stories')).toBe(13);
    expect(footerChromeReservePct({ footerPillText: 'x' }, 'formato-inexistente')).toBe(14);
  });
});
