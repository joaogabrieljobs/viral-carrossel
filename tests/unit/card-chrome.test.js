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

import { textZonesAboveFooter, footerGuardApplies } from '../../src/utils/card-chrome.js';

describe('proteção de render — zonas gravadas que entram na faixa do rodapé', () => {
  const z = (x, y, w, h) => ({ x, y, w, h });

  it('sem sobreposição devolve as mesmas zonas', () => {
    const zonas = { title: z(7, 42, 86, 28), subtitle: z(7, 72, 86, 14) };
    const r = textZonesAboveFooter(zonas, 86);
    expect(r.title).toBe(zonas.title);
    expect(r.subtitle).toBe(zonas.subtitle);
    expect(textZonesAboveFooter(zonas, 100)).toEqual(zonas);
  });

  it('capa antiga: o conjunto sobe e conserva o intervalo', () => {
    const r = textZonesAboveFooter({ title: z(7, 47, 86, 28), subtitle: z(7, 77, 86, 14) }, 86);
    expect(r.subtitle).toEqual(z(7, 72, 86, 14));
    expect(r.title).toEqual(z(7, 42, 86, 28));
  });

  it('miolo com foto no topo: título sobe até a base da foto', () => {
    const r = textZonesAboveFooter({ title: z(7, 53, 86, 20), subtitle: z(7, 76, 86, 14) }, 86);
    expect(r.subtitle.y + r.subtitle.h).toBe(86);
    expect(r.title).toEqual(z(7, 49, 86, 20));
  });

  it('zona de apoio alta só encurta; o título não se move', () => {
    const zonas = { title: z(51, 17, 43, 32), subtitle: z(51, 53, 43, 36) };
    const r = textZonesAboveFooter(zonas, 86);
    expect(r.subtitle).toEqual(z(51, 53, 43, 33));
    expect(r.title).toBe(zonas.title);
  });

  it('só vale para composição social gerada e intocada', () => {
    const base = { canvas: { source: 'social-preset', enabled: false, applied: true } };
    expect(footerGuardApplies(base)).toBe(true);
    expect(footerGuardApplies({ canvas: { ...base.canvas, userEdited: true } })).toBe(false);
    expect(footerGuardApplies({ canvas: { ...base.canvas, enabled: true } })).toBe(false);
    expect(footerGuardApplies({ canvas: { source: 'presentation-preset' } })).toBe(false);
    expect(footerGuardApplies({})).toBe(false);
    expect(footerGuardApplies(base, (_, chave) => chave === 'subtitle')).toBe(false);
  });
});
