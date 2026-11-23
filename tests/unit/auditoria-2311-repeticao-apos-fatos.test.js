import { describe, expect, it, vi } from 'vitest';
import { generateReviewedCarousel } from '../../src/utils/editorial-review.js';
import { PRESENTATION_PLAN_PROMPT_VERSION } from '../../src/utils/presentation-plan.js';

// Auditoria 23/11 (B1): quando a revisão deixava um dado sem fonte, o reparo de
// fatos encerrava a geração e o reparo de repetição nunca rodava. No teste real
// (Pitch BLK FROGDAY) os slides 8 e 9 saíram idênticos com status "repaired".
const sources = [{ id: 'brief', text: 'O software está construído. A assinatura ainda está em estudo. O piloto pago será a próxima validação.' }];
const plan = () => ({
  schemaVersion: 1, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
  objective: 'Avaliar a primeira oferta', audience: 'Parceiros', thesis: 'Validar a continuidade em uma primeira oferta paga.',
  evidence: [
    { id: 'e1', status: 'fact', sourceId: 'brief', quote: 'O software está construído.', claim: 'Software construído.' },
    { id: 'e2', status: 'proposal', sourceId: 'brief', quote: 'A assinatura ainda está em estudo.', claim: 'Assinatura em estudo.' },
  ],
  gaps: [],
  slides: [
    { index: 1, visualRole: 'cover', purpose: 'introduction', question: 'Qual é a proposta?', keyMessage: 'Acompanhar com continuidade.', evidenceIds: ['e1'], imageBrief: '' },
    { index: 2, visualRole: 'data', purpose: 'business_model', question: 'Como a oferta poderá gerar receita?', keyMessage: 'Validar a assinatura antes de escalar.', evidenceIds: ['e2'], imageBrief: '' },
    { index: 3, visualRole: 'closing', purpose: 'decision', question: 'Qual é o próximo passo?', keyMessage: 'Definir o piloto pago.', evidenceIds: [], imageBrief: '' },
  ],
});
const draft = () => ({
  slides: [
    { title: 'Validar a assinatura do piloto', subtitle: 'Software construído.', bodyAfterImage: '', imageQuery: '', speakerNotes: '' },
    { title: 'Retenção de 90%', subtitle: 'Uma oferta em estudo.', bodyAfterImage: '', imageQuery: '', speakerNotes: '' },
    { title: 'Validar a assinatura do piloto', subtitle: 'A próxima validação é o piloto pago.', bodyAfterImage: '', imageQuery: '', speakerNotes: '' },
  ], caption: 'Primeira oferta.',
});
const config = () => ({
  count: 3, presetId: 'apresentacao', presentationPath: 'pitch', presentationPlanning: true,
  planningContext: { brief: 'Criar apresentação para parceiros.', sources },
});

describe('auditoria 23/11 B1: reparo de repetição depois do reparo de fatos', () => {
  it('título repetido ainda ganha reparo quando houve dado sem fonte', async () => {
    const fatos = { edits: [{ slideIndex: 1, reason: 'Dado sem fonte', title: 'Assinatura em estudo' }] };
    const repeticao = { edits: [{ slideIndex: 2, reason: 'Título repetido', title: 'Definir o piloto pago' }] };
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(draft()).mockResolvedValueOnce({ edits: [] })
      .mockResolvedValueOnce(fatos).mockResolvedValueOnce(repeticao);
    const output = await generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(ai.mock.calls[3][0]).toContain('REPARO DE FATOS');
    expect(ai).toHaveBeenCalledTimes(5);
    expect(ai.mock.calls[4][0]).toContain('REPARO DE REPETIÇÃO');
    expect(output.result.slides.map(slide => slide.title)).toEqual(['Validar a assinatura do piloto', 'Assinatura em estudo', 'Definir o piloto pago']);
  });
});
