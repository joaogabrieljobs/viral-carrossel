import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as operationTarget from '../../src/utils/operation-target.js';

// Auditoria 23/11 (FE-13): em apresentação, "Regerar" em "Resumo e notas deste
// slide" gera o resumo do deck e gravava por cima das notas do slide ativo,
// pelo índice do clique. As notas podem ser do autor ou o texto que o reparo
// de espaço tirou do slide (FE-12).
const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');

/** Fim do "Regerar" como no editor: o resumo vale para o deck; o slide só muda se puder. */
function finishRegenerate(doc, { targetSlideId, previousSummary, summary }) {
  const slide = doc.slides.find(item => item.id === targetSlideId);
  const patch = operationTarget.summaryNotesPatchForSlide({ slide, summary, previousSummary });
  return {
    ...doc, caption: summary,
    slides: patch ? doc.slides.map(item => item.id === targetSlideId ? { ...item, ...patch } : item) : doc.slides,
  };
}

describe('auditoria 23/11 FE-13: "Regerar" não apaga as notas do slide', () => {
  const doc = () => ({
    caption: 'Resumo antigo do deck.',
    slides: [
      { id: 's1', caption: 'Resumo antigo do deck.' },
      { id: 's2', caption: '' },
      { id: 's3', caption: 'Oferta válida até 30/11, só para novos clientes.' },
    ],
  });

  it('o slides[i].caption anterior é preservado', () => {
    const before = doc();
    const after = finishRegenerate(before, { targetSlideId: 's3', previousSummary: before.caption, summary: 'Resumo novo do deck.' });
    expect(after.slides[2].caption).toBe('Oferta válida até 30/11, só para novos clientes.');
    expect(after.caption).toBe('Resumo novo do deck.');
  });

  it('slide sem notas, ou com o resumo anterior intacto, recebe o resumo novo', () => {
    const before = doc();
    expect(finishRegenerate(before, { targetSlideId: 's2', previousSummary: before.caption, summary: 'Novo.' }).slides[1].caption).toBe('Novo.');
    expect(finishRegenerate(before, { targetSlideId: 's1', previousSummary: before.caption, summary: 'Novo.' }).slides[0].caption).toBe('Novo.');
  });

  it('reordenar durante a chamada não leva o resumo para outro slide', () => {
    const before = doc();
    // O clique foi no slide 2 (sem notas); enquanto a IA responde, ele vai para o fim.
    const reordered = { ...before, slides: [before.slides[0], before.slides[2], before.slides[1]] };
    const after = finishRegenerate(reordered, { targetSlideId: 's2', previousSummary: before.caption, summary: 'Novo.' });
    expect(after.slides.map(slide => slide.caption)).toEqual(['Resumo antigo do deck.', 'Oferta válida até 30/11, só para novos clientes.', 'Novo.']);
  });

  it('slide apagado durante a chamada não recebe nada', () => {
    expect(operationTarget.summaryNotesPatchForSlide({ slide: undefined, summary: 'Novo.', previousSummary: '' })).toBeNull();
  });

  it('o editor endereça pelo id do slide e não grava pelo índice do clique', () => {
    const start = app.indexOf('const generateCaption = async () => {');
    const end = app.indexOf('const { handleCopyCaption, handleExportPackage } = useCaptionDelivery(', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const fn = app.slice(start, end);
    expect(fn).not.toContain('updateSlideAt(activeIdx, { caption: finalCaption })');
    expect(fn).toContain('summaryNotesPatchForSlide({');
    expect(fn).toContain('const notesSlideId = slides[activeIdx]?.id;');
    expect(fn).toContain('As notas deste slide foram mantidas');
  });
});
