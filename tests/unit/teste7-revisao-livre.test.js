import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { generateReviewedCarousel, buildEditorialReviewPrompt, validateCarouselDraft } from '../../src/utils/editorial-review.js';
import { buildPresentationBlocksPrompt } from '../../src/utils/presentation-quality.js';
import { personalityComparison } from '../../src/utils/free-draft.js';
import { getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { presentationStageAt } from '../../src/utils/presentation-state.js';
import { presentationPlanEntryImageQuery } from '../../src/utils/presentation-plan.js';

const T7 = JSON.parse(readFileSync(new URL('../fixtures/apoteose-teste7.json', import.meta.url), 'utf8'));
const source = [...T7.presentationPlan.evidence.map(item => item.quote), T7.slides[7].subtitle].join('\n\n');
const rawSlides = () => T7.slides.map(slide => ({
  title: slide.title, subtitle: slide.subtitle, bodyAfterImage: slide.bodyAfterImage,
  eyebrow: '', presentationBlocks: structuredClone(slide.presentationBlocks), speakerNotes: '',
  imageQuery: slide.scene ? [slide.scene.subject, slide.scene.action, slide.scene.setting].join('. ') : '',
}));

function limitsForPlan(plan, slides = []) {
  const previous = [];
  return plan.slides.map((entry, index) => {
    const composed = getPresentationCompositionOverrides('presentation_free', {
      slide: { ...slides[index], presentationPlan: entry, imageQuery: presentationPlanEntryImageQuery(entry) },
      stage: { ...presentationStageAt('auto', index, 10), visualRole: entry.visualRole },
      index, count: 10, previous, deckDesign: plan.deckDesign,
    });
    previous.push(composed);
    const limits = composed.presentationTextLimits;
    return { title: limits.title, subtitle: limits.subtitle, bodyAfterImage: limits.body };
  });
}

describe('Teste 7: o revisor recebe o conteúdo Livre que será composto', () => {
  it('a validação da revisão conserva a variante de sete pares apenas no Livre', () => {
    const slide = personalityComparison(rawSlides()[7]);
    const draft = { slides: [slide], caption: '', presentationPlan: {} };
    const config = { presetId: 'apresentacao', count: 1, freeDesign: true };
    expect(validateCarouselDraft(draft, config).slides[0].presentationBlocks[0].rows).toHaveLength(7);
    expect(() => validateCarouselDraft(draft, { ...config, freeDesign: false })).toThrow(expect.objectContaining({ code: 'presentation_blocks_invalid' }));
  });

  it('converte a personalidade antes dos limites e da revisão, sem bloquear fotos pelo parágrafo que já virou tabela', async () => {
    const raw = rawSlides();
    const onDraft = vi.fn();
    const ai = vi.fn(async prompt => {
      if (prompt.startsWith('PLANEJAMENTO ESTRUTURADO')) return structuredClone(T7.presentationPlan);
      if (prompt.startsWith('REVISÃO')) return { edits: [{
        slideIndex: 8, reason: 'O apoio supera o limite; preservar intenção e mover o complemento para as notas.',
        subtitle: 'A Apoteose pretende se consolidar como o esquenta de Carnaval mais badalado de São Paulo.',
        speakerNotes: 'Uma festa com identidade própria, capaz de gerar desejo, conversas e expectativa antes mesmo de acontecer.',
      }] };
      const positions = JSON.parse(prompt.split('\n').find(line => line.startsWith('POSIÇÕES DESTA CHAMADA: ')).slice('POSIÇÕES DESTA CHAMADA: '.length));
      return { slides: positions.map(entry => structuredClone(raw[entry.index - 1])), caption: T7.signature };
    });
    const result = await generateReviewedCarousel({ prompt: source, onDraft, config: {
      count: 10, presetId: 'apresentacao', presentationPath: 'auto', presentationPlanning: true,
      freeDesign: true, nativeBlocks: true, factualSource: source,
      planningContext: { brief: T7.editorialTopic, sources: [{ id: 'source-base', text: source }] },
      presentationLimitsForPlan: limitsForPlan,
    } }, ai);
    const reviewing = onDraft.mock.calls.find(([, meta]) => meta.phase === 'reviewing')[0];
    expect(reviewing.slides[7].subtitle).toBe('');
    expect(reviewing.slides[7].presentationBlocks[0].rows).toHaveLength(7);
    expect(reviewing.slides[7].eyebrow).toBe('A PERSONALIDADE');
    const reviewPrompt = ai.mock.calls.find(([prompt]) => prompt.startsWith('REVISÃO'))[0];
    const sent = JSON.parse(reviewPrompt.match(/<rascunho>\s*([\s\S]*?)\s*<\/rascunho>/)[1]);
    expect(sent.slides[7].subtitle).toBe('');
    expect(sent.slides[7].presentationBlocks[0].rows).toHaveLength(7);
    expect(result.reviewStatus).not.toBe('needs_attention');
    expect(result.violations || []).toEqual([]);
    expect(result.result.slides[7].presentationBlocks[0].rows).toHaveLength(7);
    expect(result.result.slides[7].speakerNotes).toContain('A personalidade vive nos contrastes:');
    expect(result.result.slides[8].subtitle).toContain('pretende se consolidar');
    expect(result.result.slides[8].speakerNotes).toContain('antes mesmo de acontecer');
    const repairTargets = ai.mock.calls.flatMap(([prompt]) => {
      const targets = prompt.match(/REPARO DIRECIONADO: edite somente os slides com slideIndex ([^.]+)\./);
      return targets ? targets[1].split(',').map(Number) : [];
    });
    expect(repairTargets).not.toContain(7);
  });

  it('redação e revisão permitem sete pares somente na variante Livre, preservando o contrato comum', () => {
    const config = { presetId: 'apresentacao', presentationPlan: T7.presentationPlan, freeDesign: true };
    const review = buildEditorialReviewPrompt(source, { slides: rawSlides() }, config);
    expect(review).toMatch(/variant[\s:"`]*pairs[^\n]*7/);
    expect(buildPresentationBlocksPrompt({ free: true })).toMatch(/variant[\s:"`]*pairs[^\n]*7/);
    expect(buildEditorialReviewPrompt(source, { slides: rawSlides() }, { ...config, freeDesign: false })).not.toContain('variant');
    expect(buildPresentationBlocksPrompt()).not.toContain('variant');
  });
});
