import { describe, expect, it } from 'vitest';
import { buildSeriesDraftSeed } from '../../src/utils/series-drafts.js';
import { OBJECTIVE_TEMPLATES } from '../../src/utils/objective-templates.js';
import { ensureDocShape } from '../../src/utils/doc-schema.js';
import { normalizeNarrativeModeId } from '../../src/utils/generation-prompts.js';

// Auditoria 23/11 (GB-12): o rascunho de série gravava o objetivo só em `mode`
// (assistente completo). O Criar rápido lê `quickNarrativeMode` e gerava como
// "Seguir meu pedido".
describe('auditoria 23/11 GB-12: objetivo da série chega ao Criar rápido', () => {
  it('rascunho "Educar" abre no Criar rápido com passo a passo', () => {
    const seed = buildSeriesDraftSeed({ idea: { title: 'Como escolher o pão' }, objectiveId: 'educar' });
    expect(seed.seedDoc.quickNarrativeMode).toBe('how_to');
    expect(ensureDocShape({ ...seed.seedDoc, slides: [] }).quickNarrativeMode).toBe('how_to');
  });

  it.each(OBJECTIVE_TEMPLATES.map(item => [item.id, item.narrativeMode]))('objetivo %s grava o mesmo modo nos dois caminhos', (objectiveId, narrativeMode) => {
    const { seedDoc } = buildSeriesDraftSeed({ idea: { title: 'Tema' }, objectiveId });
    expect(seedDoc.mode).toBe(narrativeMode);
    expect(ensureDocShape({ ...seedDoc, slides: [] }).quickNarrativeMode).toBe(normalizeNarrativeModeId(narrativeMode));
  });
});
