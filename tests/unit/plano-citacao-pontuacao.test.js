import { describe, expect, it } from 'vitest';
import { PRESENTATION_PLAN_PROMPT_VERSION, validatePresentationPlan } from '../../src/utils/presentation-plan.js';

// Apoteose 10 (27/11, 18:40): o roteiro parou em "uma citação do roteiro não foi
// localizada literalmente no material". O material usa travessão, aspas curvas
// e marcação **negrito**; o modelo costuma copiar o trecho com hífen, aspas retas
// e sem asteriscos. Isso é formatação, não outro texto: a citação vale.
const material = 'APOTEOSE — Conceito e posicionamento\n\n**Conceito**\n\nO nome remete ao “ápice” da festa — e ao Carnaval… antes do Carnaval.\n\n**Como se o Carnaval não fosse suficiente.**';
const sources = [{ id: 'material', text: material }];
const plan = quote => ({
  schemaVersion: 1, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
  objective: 'Apresentar a festa', audience: 'Parceiros', thesis: 'Uma festa com identidade própria.',
  evidence: [{ id: 'e1', status: 'fact', sourceId: 'material', quote, claim: 'O nome remete ao ápice.' }],
  gaps: [],
  slides: [
    { index: 1, visualRole: 'cover', purpose: 'introduction', question: 'O que é?', keyMessage: 'A festa.', evidenceIds: ['e1'], imageBrief: '' },
    { index: 2, visualRole: 'closing', purpose: 'decision', question: 'E agora?', keyMessage: 'Encerramento.', evidenceIds: [], imageBrief: '' },
  ],
});
const check = quote => validatePresentationPlan(plan(quote), { count: 2, sources });

describe('citação do roteiro: pontuação tipográfica não reprova', () => {
  it.each([
    ['travessão virou hífen', 'APOTEOSE - Conceito e posicionamento'],
    ['aspas curvas viraram retas', 'O nome remete ao "ápice" da festa'],
    ['reticências viraram três pontos', 'e ao Carnaval... antes do Carnaval.'],
    ['sem os asteriscos do negrito', 'Como se o Carnaval não fosse suficiente.'],
    ['espaço não separável', 'O nome remete ao “ápice” da festa'],
  ])('%s', (_label, quote) => {
    expect(check(quote).issues).not.toContainEqual(expect.objectContaining({ code: 'quote_not_found' }));
  });

  it('paráfrase continua reprovada', () => {
    expect(check('O nome faz referência ao auge da festa').issues).toContainEqual({ code: 'quote_not_found', path: 'evidence[0].quote' });
  });

  it('palavra trocada continua reprovada', () => {
    expect(check('Como se o Carnaval não fosse bastante.').issues).toContainEqual({ code: 'quote_not_found', path: 'evidence[0].quote' });
  });
});
