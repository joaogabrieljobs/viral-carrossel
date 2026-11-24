import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as imageStore from '../../src/utils/image-store.js';

// Auditoria 23/11 (FE-10): o lote de imagens da geração guardava a identidade
// da foto antes do laço e só conferia o alvo depois de pagar. Gerar a imagem
// avulsa do card 6 durante o lote, enviar foto própria ou apagar o card
// resultava em crédito gasto e imagem descartada sem mensagem.
const source = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const app = source('ViralCarrossel.jsx');
const { slideImageIdentity } = imageStore;

/**
 * Laço do lote como no editor, com o gerador pago simulado. `onCard` roda no
 * início de cada card e faz o papel da pessoa mexendo no editor durante o lote.
 */
async function runBatch({ editor, targets, generate, onCard = () => {} }) {
  for (const { slideId, expectedImageIdentity } of targets) {
    await onCard(slideId);
    if (imageStore.imageBatchSkipReason({ slides: editor.slides, slideId, expectedImageIdentity, generatingIds: editor.generating })) continue;
    editor.generating.add(slideId);
    try {
      const url = await generate(slideId);
      editor.slides = imageStore.applySlidePatchIfImageCurrent(editor.slides, {
        id: slideId, expectedImageIdentity, patch: { bgImage: url, bgImageId: `lote-${slideId}` },
      });
    } finally {
      editor.generating.delete(slideId);
    }
  }
}

const makeEditor = () => ({
  slides: Array.from({ length: 8 }, (_, i) => ({ id: `c${i + 1}`, imageQuery: `cena ${i + 1}` })),
  generating: new Set(),
});
const targetsOf = editor => editor.slides.map(slide => ({ slideId: slide.id, expectedImageIdentity: slideImageIdentity(slide) }));

describe('auditoria 23/11 FE-10: lote de imagens confere o alvo antes de pagar', () => {
  it('imagem avulsa do card 6 durante o lote resulta em uma chamada para o card 6', async () => {
    const editor = makeEditor();
    const paid = vi.fn(async slideId => `data:image/png;base64,${slideId}`);
    await runBatch({
      editor, targets: targetsOf(editor), generate: paid,
      onCard: async (slideId) => {
        if (slideId !== 'c3') return;
        // A pessoa clica "Gerar imagem" no card 6 enquanto o lote está no 3.
        const url = await paid('c6');
        editor.slides = editor.slides.map(slide => slide.id === 'c6' ? { ...slide, bgImage: url, bgImageId: 'avulsa-c6' } : slide);
      },
    });
    expect(paid.mock.calls.filter(([slideId]) => slideId === 'c6')).toHaveLength(1);
    expect(editor.slides.find(slide => slide.id === 'c6').bgImageId).toBe('avulsa-c6');
    expect(paid).toHaveBeenCalledTimes(8);
  });

  it('imagem avulsa ainda em andamento também tira o card do lote', async () => {
    const editor = makeEditor();
    const paid = vi.fn(async slideId => `data:image/png;base64,${slideId}`);
    editor.generating.add('c6');
    await runBatch({ editor, targets: targetsOf(editor), generate: paid });
    expect(paid.mock.calls.filter(([slideId]) => slideId === 'c6')).toHaveLength(0);
  });

  it('apagar um card pendente resulta em zero chamadas para ele', async () => {
    const editor = makeEditor();
    const paid = vi.fn(async slideId => `data:image/png;base64,${slideId}`);
    await runBatch({
      editor, targets: targetsOf(editor), generate: paid,
      onCard: (slideId) => { if (slideId === 'c2') editor.slides = editor.slides.filter(slide => slide.id !== 'c5'); },
    });
    expect(paid.mock.calls.filter(([slideId]) => slideId === 'c5')).toHaveLength(0);
    expect(paid).toHaveBeenCalledTimes(7);
  });

  it('foto própria enviada num card pendente também tira o card do lote', () => {
    const slides = [{ id: 'c1', imageQuery: 'cena', bgImage: 'blob:foto-propria', bgImageId: 'propria' }];
    expect(imageStore.imageBatchSkipReason({ slides, slideId: 'c1', expectedImageIdentity: 'none' })).toBe('image_changed');
    expect(imageStore.imageBatchSkipReason({ slides: [{ id: 'c1' }], slideId: 'c1', expectedImageIdentity: 'none' })).toBeNull();
    expect(imageStore.imageBatchSkipReason({ slides: [], slideId: 'c1', expectedImageIdentity: 'none' })).toBe('slide_missing');
    expect(imageStore.imageBatchSkipReason({
      slides: [{ id: 'c1' }], slideId: 'c1', expectedImageIdentity: 'none', generatingIds: new Set(['c1']),
    })).toBe('already_generating');
  });

  it.each([
    ['geração', 'for (const { slideId, i, q, expectedImageIdentity } of slidesWithImage) {', 'if (imgQuotaStop) {'],
    ['template', 'for (const { index:i, q, slideId, expectedImageIdentity } of targets) {', 'templateJob.finish();'],
  ])('o laço de %s confere o alvo antes de pagar e marca o card como ocupado', (_name, startMarker, endMarker) => {
    const start = app.indexOf(startMarker);
    const end = app.indexOf(endMarker, start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const loop = app.slice(start, end);
    const paid = loop.indexOf('await generateDALLEWithRetry(');
    const skip = loop.indexOf('imageBatchSkipReason({');
    const busy = loop.indexOf('slideImgGenIdsRef.current.add(slideId);');
    expect(skip).toBeGreaterThanOrEqual(0);
    expect(skip).toBeLessThan(busy);
    expect(busy).toBeLessThan(paid);
    // Lido do histórico, que é síncrono: `slidesLiveRef` só muda no render e na
    // primeira volta ainda aponta para os slides de antes da geração.
    expect(loop.slice(skip, skip + 220)).toContain('history.getState()');
    // Segunda conferência colada na chamada paga, depois de resolver as referências.
    const last = loop.lastIndexOf('imageBatchSkipReason({', paid);
    expect(last).toBeGreaterThan(busy);
    expect(loop).toContain('slideImgGenIdsRef.current.delete(slideId);');
  });

  it('o histórico expõe o estado atual sem esperar o render', () => {
    expect(source('src/hooks/useHistory.js')).toMatch(/return \{ state: view\.state, getState,/);
  });
});
