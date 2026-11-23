import { describe, expect, it } from 'vitest';
import { applyEditorialReview, buildEditorialReviewPrompt } from '../../src/utils/editorial-review.js';

// Auditoria 23/11 (B7): Caso (BLK FROGDAY) slide 8 "Not liking it costs you
// nothing" saiu com o mesmo apoio do slide 7; Relatório 5 e 6 com o apoio do
// vizinho. A revisão devolve edições por slideIndex contado a partir de zero,
// mas o rascunho ia ao modelo sem índice.
const plan = { slides: [{ index: 1 }, { index: 2 }, { index: 3 }] };
const config = { presetId: 'apresentacao', presentationPlan: plan, presentationPath: 'estudo_de_caso' };
const draft = () => ({
  slides: [
    { title: 'Two ways to start, same outcome', subtitle: 'You can send your current link or fill the brief at blkfrog.com/brief.', bodyAfterImage: '', speakerNotes: '' },
    { title: 'Not liking it costs you nothing', subtitle: 'You review the finished site and decide before paying.', bodyAfterImage: '', speakerNotes: '' },
    { title: 'Offer ends Nov 30', subtitle: 'After Nov 30 the BLK FROGDAY conditions no longer apply.', bodyAfterImage: '', speakerNotes: '' },
  ], caption: '',
});

describe('auditoria 23/11 B7: edição no slide errado', () => {
  // Guarda proposto e NÃO aplicado: quebra o caso do teste "lote B" do repo,
  // que copia o apoio do slide 0 no reparo. Decisão do JG (ver relatório).
  it.fails('recusa apoio copiado de outro slide (decisão pendente)', () => {
    const review = { edits: [{ slideIndex: 1, reason: 'clareza', subtitle: 'You can send your current link or fill the brief at blkfrog.com/brief.' }] };
    expect(() => applyEditorialReview(draft(), review, config, { deferQualityChecks: true })).toThrow('outro slide');
  });
  it('edição legítima continua valendo', () => {
    const review = { edits: [{ slideIndex: 1, reason: 'clareza', subtitle: 'If you do not like the site, you do not pay.' }] };
    expect(applyEditorialReview(draft(), review, config, { deferQualityChecks: true }).slides[1].subtitle).toBe('If you do not like the site, you do not pay.');
  });
  it('o rascunho da revisão leva o slideIndex de cada slide', () => {
    expect(buildEditorialReviewPrompt('briefing', draft(), config)).toContain('"slideIndex":2,"title":"Offer ends Nov 30"');
  });
});
