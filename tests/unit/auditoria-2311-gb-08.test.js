import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as readiness from '../../src/utils/image-generation-readiness.js';
import * as quick from '../../src/components/panels/CriarRapidoHome.jsx';

// Auditoria 23/11 (GB-08): o seletor "Quais cards terão imagem?" deixava marcar
// card que já tem foto e prometia "gerar 6 imagens · 6 créditos"; a geração
// pula quem tem foto e fazia só 2.
const slides = [
  { id: 'a', imageQuery: 'vitrine', bgImage: 'blob:a' },
  { id: 'b', imageQuery: 'equipe', bgImage: 'blob:b' },
  { id: 'c', imageQuery: 'produto', bgImage: null },
  { id: 'd', imageQuery: 'fachada', bgImageAssetId: 'asset-d', bgImage: null },
  { id: 'e', imageQuery: 'detalhe', bgImage: null },
  { id: 'f', imageQuery: '', bgImage: null },
];

describe('auditoria 23/11 GB-08: o seletor de imagens promete o que a geração faz', () => {
  it('só lista cards que o lote vai gerar e conta só os marcados entre eles', () => {
    const all = readiness.imageBatchSelection(slides, ['a', 'b', 'c', 'd', 'e', 'f']);
    expect(all.eligible.map(item => item.slide.id)).toEqual(['c', 'e']);
    expect(all.selectedIds).toEqual(['c', 'e']);
    // A contagem do botão é a mesma lista que a geração percorre.
    expect(all.selectedIds).toEqual(readiness.slidesPendingImageGeneration(slides, all.selectedIds).map(item => item.slide.id));
    expect(readiness.imageBatchSelection(slides, ['a', 'b']).selectedIds).toEqual([]);
    expect(readiness.imageBatchSelection(slides, []).selectedIds).toEqual([]);
    expect(readiness.imageBatchSelection(null, ['a']).eligible).toEqual([]);
  });

  it('com seis marcados e quatro com foto, o botão diz 2 imagens e 2 créditos', () => {
    const html = renderToStaticMarkup(React.createElement(quick.ImageBatchPicker, {
      slides, selectedIds: ['a', 'b', 'c', 'd', 'e', 'f'], setSelectedIds: () => {}, busy: false, onClose: () => {}, onGenerate: () => {},
    }));
    expect(html).toContain('Confirmar: gerar 2 imagens · 2 créditos');
    expect(html).not.toContain('6 créditos');
    expect(html.match(/aria-pressed=/g)).toHaveLength(2);
    // Mantém o número do card no projeto, não a posição na lista.
    expect(html).toMatch(/>3<\/span>/);
    expect(html).toMatch(/>5<\/span>/);
  });

  it('quando todos já têm foto, explica em vez de mostrar seleção vazia', () => {
    const html = renderToStaticMarkup(React.createElement(quick.ImageBatchPicker, {
      slides: slides.slice(0, 2), selectedIds: [], setSelectedIds: () => {}, busy: false, onClose: () => {}, onGenerate: () => {},
    }));
    expect(html).toMatch(/já têm foto/);
  });
});
