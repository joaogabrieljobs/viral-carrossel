import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EditorialReviewNotice from '../../src/components/EditorialReviewNotice.jsx';
import * as renderReview from '../../src/utils/presentation-render-review.js';

// Auditoria 23/11 (FE-12): quando o slide renderizado não cabe e o reparo por
// IA não resolve, o corpo inteiro do slide vai para as notas. A conferência
// passava, nenhum aviso aparecia e o PDF saía sem aquele texto. Ninguém lia
// `presentationQuality.renderRepairStatus`.
const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
const slides = [
  { id: 's1', title: 'Capa', bodyAfterImage: 'Oferta válida até 30/11, só para novos clientes.', caption: '' },
  { id: 's2', title: 'Plano', bodyAfterImage: '', caption: '' },
  { id: 's3', title: 'Preço', bodyAfterImage: 'Parcelas sem juros no cartão; boleto à vista.', caption: 'Nota do autor.' },
];
const overflow = ids => ids.map(slideId => ({ code: 'render-overflow', slideId }));

describe('auditoria 23/11 FE-12: texto que sai do slide para as notas é avisado', () => {
  it('com overflowFallbackPatches não vazio, sai um aviso citando os slides', () => {
    const patches = renderReview.overflowFallbackPatches(slides, overflow(['s1', 's3']), 0);
    expect(patches.map(item => item.slideId)).toEqual(['s1', 's3']);
    // Nada é apagado: o corpo vai inteiro para as notas, antes do que já havia.
    expect(patches[1].patch.caption).toBe('Parcelas sem juros no cartão; boleto à vista.\n\nNota do autor.');
    const notice = renderReview.movedToNotesNotice({ movedToNotesSlideIds: patches.map(item => item.slideId) }, slides);
    expect(notice.slideNumbers).toEqual([1, 3]);
    expect(notice.message).toContain('slides 1 e 3');
    expect(notice.message).toContain('notas');
    expect(notice.message).toMatch(/não entram no PDF/);
  });

  it('usa a posição atual do slide e some quando não há o que avisar', () => {
    const reordered = [slides[2], slides[0], slides[1]];
    expect(renderReview.movedToNotesNotice({ movedToNotesSlideIds: ['s3'] }, reordered).message).toContain('No slide 1,');
    expect(renderReview.movedToNotesNotice({ movedToNotesSlideIds: ['s1', 's2', 's3'] }, slides).message).toContain('slides 1, 2 e 3');
    expect(renderReview.movedToNotesNotice({ renderRepairStatus: 'repaired', movedToNotesSlideIds: [] }, slides)).toBeNull();
    expect(renderReview.movedToNotesNotice({ movedToNotesSlideIds: ['apagado'] }, slides)).toBeNull();
    expect(renderReview.movedToNotesNotice({ movedToNotesSlideIds: ['s1'], movedToNotesReviewed: true }, slides)).toBeNull();
    expect(renderReview.movedToNotesNotice(null, slides)).toBeNull();
  });

  it('projeto gerado antes desta correção também avisa, sem a lista', () => {
    const notice = renderReview.movedToNotesNotice({ renderRepairStatus: 'moved_to_notes' }, slides);
    expect(notice.slideNumbers).toEqual([]);
    expect(notice.message).toContain('notas');
  });

  it('um componente do editor lê presentationQuality.renderRepairStatus e mostra o aviso', () => {
    const html = renderToStaticMarkup(React.createElement(EditorialReviewNotice, {
      status: 'reviewed', isPresentation: true, slides, onDismissMovedToNotes: () => {},
      presentationQuality: { renderRepairStatus: 'moved_to_notes', movedToNotesSlideIds: ['s3'] },
    }));
    expect(html).toContain('aria-label="Texto movido para as notas"');
    expect(html).toContain('No slide 3,');
    expect(html).toContain('Conferi as notas');
    const quiet = renderToStaticMarkup(React.createElement(EditorialReviewNotice, {
      status: 'reviewed', isPresentation: true, slides, presentationQuality: { renderRepairStatus: 'not_needed' },
    }));
    expect(quiet).toBe('');
    expect(app).toContain('presentationQuality={doc.presentationQuality}');
  });

  it('a geração registra os slides alterados e avisa na hora', () => {
    const start = app.indexOf('for (let step = 0; step < 2 && rendered.issues.some');
    const end = app.indexOf('} catch (renderError) {', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const block = app.slice(start, end);
    expect(block).toContain('movedToNotesIds.add(current.id);');
    expect(block).toContain('movedToNotesSlideIds: [...movedToNotesIds]');
    const notice = block.indexOf('movedToNotesNotice(');
    expect(notice).toBeGreaterThanOrEqual(0);
    expect(block.slice(notice, notice + 260)).toContain("toast(");
  });
});
