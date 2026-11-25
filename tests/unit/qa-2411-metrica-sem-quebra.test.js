import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PresentationBlocks, { measureMetricText, metricRowFit } from '../../src/components/PresentationBlocks.jsx';

// QA 24/11 (deck B): em coluna estreita (vista Quadrado, quadro com painel) o
// valor da métrica passava do piso de leitura e era partido em qualquer letra
// (`overflow-wrap: anywhere`): "US$ 1.299,9 / 0", "41.20 / 0". O valor desce de
// tamanho até caber; só quebra entre palavras.
const FONT = 'Inter Tight';
const fits = (text, fontSize, columnPx) => measureMetricText(text, FONT, 600) * fontSize <= columnPx * 0.92 + 0.01;
const row = (values, columnPx, unit = 1) => metricRowFit({ values, columnPx, unit, fontFamily: FONT, weight: 600 });

describe('QA 24/11 deck B: valor da métrica não quebra no meio do número', () => {
  it('número sozinho nunca quebra: a fonte da linha desce até ele caber', () => {
    for (const columnPx of [240, 150, 110]) {
      const values = ['41.200', '+120%', '1.299,90'];
      const out = row(values, columnPx);
      out.forEach((fit, index) => {
        expect(fit.wrap, `${values[index]} em ${columnPx}px`).toBe(false);
        expect(fits(values[index], fit.fontSize, columnPx), `${values[index]} em ${columnPx}px`).toBe(true);
      });
      // Painel: todos os valores da linha continuam do mesmo tamanho.
      expect(new Set(out.map((fit) => fit.fontSize)).size).toBe(1);
    }
    expect(row(['41.200', '+120%', '1.299,90'], 150)[0].fontSize).toBeLessThan(44);
  });

  it('"US$ 1.299,90" e "US$ 399" só quebram depois da moeda, com o número inteiro na coluna', () => {
    const values = ['US$ 399', 'US$ 1.299,90', '41.200', '+120%'];
    const columnPx = 150;
    const out = row(values, columnPx);
    for (const word of ['US$', '399', '1.299,90', '41.200', '+120%']) expect(fits(word, out[0].fontSize, columnPx), word).toBe(true);
    expect(out[2].wrap).toBe(false);
    expect(out[3].wrap).toBe(false);
  });

  it('valor com várias palavras quebra entre palavras, e cada palavra cabe na coluna', () => {
    const values = ['Terça a domingo, 7h–13h', '36 horas'];
    const columnPx = 150;
    const out = row(values, columnPx);
    expect(out[0].wrap).toBe(true);
    expect(out[0].fontSize).toBeLessThan(44);
    for (const word of values[0].split(' ')) expect(fits(word, out[0].fontSize, columnPx), word).toBe(true);
  });

  it('quem já cabia não muda de tamanho', () => {
    expect(row(['38%', '12', '4,8'], 500).map((fit) => fit.fontSize)).toEqual([96, 96, 96]);
    expect(row(['38%', '12', '4,8', '9'], 500).map((fit) => fit.fontSize)).toEqual([72, 72, 72, 72]);
    // Valor longo de várias palavras continua no piso de leitura, quebrando entre palavras.
    expect(row(['Terça a domingo, 7h–13h', '36 horas'], 400)[0]).toEqual({ fontSize: 44, wrap: true });
  });

  it('o card não permite quebra em qualquer letra no valor (prévia e exportação)', () => {
    const blocks = [{ type: 'metrics', items: [
      { value: 'US$ 1.299,90', label: 'Ticket médio' }, { value: '41.200', label: 'Pedidos' },
      { value: '+120%', label: 'Crescimento' }, { value: 'Terça a domingo, 7h–13h', label: 'Horário' },
    ] }];
    for (const forExport of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(PresentationBlocks, {
        blocks, rect: { x: 7, y: 40, w: 86, h: 50 }, frame: { w: 1080, h: 1080 }, family: 'modular',
        accent: '#5733cc', ink: '#111111', background: '#ffffff', fontFamily: 'Inter', forExport,
      }));
      const cells = [...html.matchAll(/<span[^>]*data-vc-evidence-cell="true"[^>]*style="([^"]*)"[^>]*>([^<]*)</g)]
        .filter(([, , text]) => blocks[0].items.some((item) => item.value === text.replace(/&#x27;/g, "'")));
      expect(cells).toHaveLength(4);
      for (const [, style, text] of cells) {
        expect(style, text).not.toContain('overflow-wrap:anywhere');
        expect(style, text).not.toContain('overflow-wrap:break-word');
        expect(style, text).toContain('overflow-wrap:normal');
      }
    }
  });
});
