import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as panel from '../../src/components/panels/ImagesLibraryPanel.jsx';
import { accountAiImageRefs, createLoadQueue, loadAccountImage } from '../../src/utils/account-images.js';

// QA 24/11 (editor 4): a galeria só listava imagem de IA cujos bytes estavam
// neste navegador. Em outro aparelho a conta parecia não ter imagem nenhuma.
const ImagesLibraryPanel = panel.default;

const library = [
  {
    id: 'p1', name: 'Lançamento de maio', updatedAt: 200,
    doc: { slides: [
      { id: 's1', bgImageId: 'local-1', bgImageAssetId: 'orig-aaa', bgImageSource: 'ai' },
      { id: 's2', bgImageAssetId: 'orig-bbb', bgImageSource: 'ai' },
      { id: 's3', bgImageId: 'foto-1', bgImageAssetId: 'orig-ccc', bgImageSource: 'imported' },
      { id: 's4', title: 'sem imagem' },
    ] },
  },
  {
    id: 'p2', name: 'Cópia do lançamento', updatedAt: 100,
    doc: { slides: [{ id: 's9', bgImageAssetId: 'orig-bbb', bgImageSource: 'ai' }] },
  },
];
const blob = (text = 'bytes') => new Blob([text], { type: 'image/png' });

describe('QA 24/11 editor 4 — galeria lista as imagens de IA da conta', () => {
  it('lista imagem que só existe na conta, sem repetir e sem foto enviada', async () => {
    const refs = accountAiImageRefs(library);
    expect(refs.map((ref) => [ref.docId, ref.cardNum, ref.imageId, ref.assetId])).toEqual([
      ['p1', 1, 'local-1', 'orig-aaa'],
      ['p1', 2, null, 'orig-bbb'],
    ]);
    expect(refs[1]).toMatchObject({ key: 'orig-bbb', docName: 'Lançamento de maio', slideId: 's2' });
  });

  it('usa os bytes deste navegador quando existem e não chama a conta', async () => {
    const getLocal = vi.fn(async (id) => (id === 'local-1' ? { blob: blob(), mime: 'image/png' } : null));
    const fetchFromAccount = vi.fn();
    const loaded = await loadAccountImage({ imageId: 'local-1', assetId: 'orig-aaa' }, { getLocal, fetchFromAccount });
    expect(loaded.source).toBe('local');
    expect(fetchFromAccount).not.toHaveBeenCalled();
  });

  it('sem os bytes locais, busca a imagem na conta pelo assetId', async () => {
    const ref = { imageId: 'de-outro-aparelho', assetId: 'orig-bbb', docId: 'p1', slideId: 's2' };
    const getLocal = vi.fn(async () => { throw new Error('IndexedDB bloqueado'); });
    const fetchFromAccount = vi.fn(async () => blob('da conta'));
    const loaded = await loadAccountImage(ref, { getLocal, fetchFromAccount });
    expect(getLocal.mock.calls.map(([id]) => id)).toEqual(['de-outro-aparelho', 'orig-bbb']);
    expect(fetchFromAccount).toHaveBeenCalledWith(ref, expect.anything());
    expect(loaded.source).toBe('account');
    expect(await loaded.blob.text()).toBe('da conta');
  });

  it('falha de download vira erro que dá para tentar de novo', async () => {
    const deps = { getLocal: async () => null, fetchFromAccount: vi.fn(async () => null) };
    await expect(loadAccountImage({ assetId: 'orig-bbb' }, deps)).rejects.toThrow(/Não foi possível carregar/);
    deps.fetchFromAccount.mockResolvedValueOnce(blob());
    await expect(loadAccountImage({ assetId: 'orig-bbb' }, deps)).resolves.toMatchObject({ source: 'account' });
    // Imagem sem cópia na conta e sem bytes locais não tem de onde vir.
    await expect(loadAccountImage({ imageId: 'x' }, deps)).rejects.toMatchObject({ code: 'image_missing' });
  });

  it('a fila baixa poucas imagens por vez', async () => {
    const queue = createLoadQueue(2);
    let running = 0;
    let peak = 0;
    const task = () => queue(async () => {
      running += 1; peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return 'ok';
    });
    const results = await Promise.all([task(), task(), task(), task(), task()]);
    expect(results).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    expect(peak).toBe(2);
    await expect(queue(async () => { throw new Error('falhou'); })).rejects.toThrow('falhou');
    await expect(queue(async () => 'segue')).resolves.toBe('segue');
  });

  it('a galeria já abre com as imagens da conta em estado de carregando', () => {
    const html = renderToStaticMarkup(React.createElement(ImagesLibraryPanel, { library }));
    expect(html).not.toContain('Ainda não há imagens geradas');
    expect(html).toContain('2 imagens salvas');
    expect(html.match(/aria-busy="true"/g) || []).toHaveLength(2);
    expect(html).toContain('Carregando imagem do card 2 de Lançamento de maio');
  });

  it('miniatura com erro mostra o motivo e o botão de tentar de novo', () => {
    expect(typeof panel.AccountImageTile, 'a galeria não tem estado de erro').toBe('function');
    const html = renderToStaticMarkup(React.createElement(panel.AccountImageTile, {
      item: { key: 'orig-bbb', docName: 'Lançamento de maio', cardNum: 2, status: 'error' },
      onRetry: () => {}, onDownload: () => {},
    }));
    expect(html).toContain('role="alert"');
    expect(html).toContain('Não foi possível carregar esta imagem.');
    expect(html).toContain('Tentar de novo</button>');
    expect(html).not.toContain('aria-busy="true"');
  });

  it('sem imagem de IA em nenhum projeto, continua o estado vazio', () => {
    const html = renderToStaticMarkup(React.createElement(ImagesLibraryPanel, { library: [library[0]].map((entry) => ({
      ...entry, doc: { slides: entry.doc.slides.filter((slide) => slide.bgImageSource !== 'ai') },
    })) }));
    expect(html).toContain('Ainda não há imagens geradas');
  });
});
