import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PresentationBlocks from '../../src/components/PresentationBlocks.jsx';
import { wcagContrast } from '../../src/utils/wcag.js';

const blocks = [
  { type: 'comparison', headers: ['Formato', 'Uso'], rows: [['Feed', 'Leitura no perfil.'], ['Stories', 'Leitura na sequência.']] },
  { type: 'comparison', variant: 'pairs', headers: ['Traço', 'Sem ser'], rows: [['Brasileira', 'sem ser caricata.'], ['Atual', 'sem perder identidade.'], ['Próxima', 'sem ser previsível.']] },
  { type: 'metrics', items: [{ value: '8', label: 'Cards', detail: 'Em cada formato.' }, { value: '3', label: 'Formatos', detail: 'Com leitura própria.' }] },
  { type: 'steps', items: [{ title: 'Escolher', body: 'Defina o assunto.' }, { title: 'Revisar', body: 'Confira os detalhes.' }] },
  { type: 'quote', text: 'A festa começa antes.', author: 'Manifesto da marca' },
  { type: 'bignumber', value: '8', label: 'Cards editáveis', detail: 'Um roteiro por projeto.' },
  { type: 'icons', items: [{ icon: 'music', title: 'Música', body: 'Uma curadoria própria.' }, { icon: 'users', title: 'Encontro', body: 'Uma experiência coletiva.' }] },
];
const render = (block, height, optIn = true) => renderToStaticMarkup(React.createElement(PresentationBlocks, {
  blocks: [block], rect: { x: 9, y: 22, w: 82, h: 60 }, frame: { w: 1080, h: height },
  ink: '#111111', strongInk: '#111111', background: '#FFFFFF', accent: '#999999',
  paletteOverrides: { bg: '#FFFFFF', accent: '#999999' }, fontFamily: 'Inter, sans-serif',
  family: 'technical', artDirectionVersion: 2, forExport: true,
  ...(optIn ? { minFontPx: 28, minimumTextContrast: 4.5 } : {}),
}));

describe('Livre social: blocos legíveis no tamanho nativo de 1080 px', () => {
  for (const height of [1080, 1350, 1920]) {
    it.each(blocks.map((block, index) => [index, block]))(`bloco %s mantém todos os textos a pelo menos 28 px em 1080×${height}`, (_index, block) => {
      const html = render(block, height);
      const sizes = [...html.matchAll(/font-size:([\d.]+)px/g)].map(match => Number(match[1]));
      expect(sizes.length).toBeGreaterThan(0);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(28);
    });
  }

  it('o número em destaque também tem contraste de texto 4,5:1', () => {
    const html = render(blocks.find(block => block.type === 'bignumber'), 1350);
    const tag = html.match(/<span[^>]*data-vc-bignumber-value="true"[^>]*>/)?.[0] || '';
    const color = tag.match(/(?:^|[;" ])color:([^;"]+)/)?.[1];
    expect(color).toBeTruthy();
    expect(wcagContrast(color, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });

  it('a numeração das etapas mantém contraste de texto 4,5:1', () => {
    const html = render(blocks.find(block => block.type === 'steps'), 1350);
    const marker = html.match(/<span aria-hidden="true" style="([^"]+)">01\//)?.[1];
    expect(marker).toBeTruthy();
    const color = marker.match(/(?:^|;)color:([^;]+)/)?.[1];
    expect(wcagContrast(color, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });

  it('fora da opção nova conserva os tamanhos anteriores dos blocos', () => {
    const html = render(blocks[0], 1350, false);
    expect(html).toContain('font-size:26px');
    expect(html).toContain('font-size:19px');
  });
});
