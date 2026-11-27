import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applyEditorialReview, generateReviewedCarousel, validateCarouselDraft } from '../../src/utils/editorial-review.js';
import { finishFreeDraft } from '../../src/utils/free-draft.js';
import { attachPresentationPlan, presentationPlanEntryImageQuery } from '../../src/utils/presentation-plan.js';
import { getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';

const { doc } = JSON.parse(readFileSync(new URL('../fixtures/apoteose-teste8.json', import.meta.url), 'utf8'));
const savedMusic = doc.slides.find(slide => slide.presentationPlan.index === 4);
const musicPlan = doc.presentationPlan.slides[3];
const source = doc.material.content;

function rawSlide(saved) {
  // Use only the writing fields, as in the real batch response. In the saved
  // failure the query is empty; attachPresentationPlan must restore the scene.
  return {
    title: saved.title, subtitle: saved.subtitle, bodyAfterImage: saved.bodyAfterImage,
    eyebrow: saved.eyebrow || '', speakerNotes: '', imageQuery: '',
    presentationBlocks: structuredClone(saved.presentationBlocks || []),
  };
}

function musicDraft(entry = musicPlan) {
  const plan = { ...structuredClone(doc.presentationPlan), slides: [structuredClone(entry)] };
  const attached = attachPresentationPlan({ slides: [rawSlide(savedMusic)], caption: '', presentationPlan: plan }, plan);
  return { plan, attached, config: { count: 1, presetId: 'apresentacao', presentationPath: 'auto',
    nativeBlocks: true, freeDesign: true, presentationPlan: plan, factualSource: source } };
}

function composeMusic(slide, deckDesign = doc.presentationPlan.deckDesign) {
  return { ...slide, ...getPresentationCompositionOverrides('presentation_free', {
    slide, stage: { visualRole: 'content' }, index: 3, count: 10,
    previous: doc.slides.slice(0, 3), deckDesign,
  }) };
}

describe('Teste 8: foto e bloco nativo atravessam a redação e a revisão Livre', () => {
  it('restaura a cena do plano, valida o lote, acaba a redação e compõe música com ícones e foto', () => {
    const { attached, config } = musicDraft();
    const before = JSON.stringify(attached);
    const query = presentationPlanEntryImageQuery(musicPlan);
    expect(savedMusic.imageQuery).toBe('');
    expect(attached.slides[0].imageQuery).toBe(query);

    const validated = validateCarouselDraft(attached, config);
    expect(validated.slides[0].imageQuery).toBe(query);
    const finished = finishFreeDraft(validated);
    const reviewed = applyEditorialReview(finished, { edits: [] }, config);
    expect(reviewed.slides[0].imageQuery).toBe(query);
    const composed = composeMusic(reviewed.slides[0]);
    expect(composed.presentationFreeDesign.photo).toBe('small');
    expect(composed.presentationSuppressPhoto).toBe(false);
    expect(composed.canvas.zones.photo.w * composed.canvas.zones.photo.h / 100).toBeGreaterThan(8);
    expect(composed.presentationBlocks).toEqual(savedMusic.presentationBlocks);
    expect(composed.subtitle).toBe(savedMusic.subtitle);
    expect(JSON.stringify(attached)).toBe(before);
  });

  it('revalidar um patch editorial não apaga a foto nem descarta a explicação movida às notas', () => {
    const { attached, config } = musicDraft();
    const result = applyEditorialReview(attached, { edits: [{
      slideIndex: 0, reason: 'Separar aprofundamento dos ícones.',
      bodyAfterImage: 'A curadoria combina remixes e clássicos nacionais.',
      presentationBlocks: savedMusic.presentationBlocks,
    }] }, config);
    expect(result.slides[0].imageQuery).toBe(presentationPlanEntryImageQuery(musicPlan));
    expect(result.slides[0].bodyAfterImage).toBe('');
    expect(result.slides[0].speakerNotes).toContain('A curadoria combina remixes e clássicos nacionais.');
    expect(result.slides[0].presentationBlocks).toEqual(savedMusic.presentationBlocks);
  });

  it.each([false, undefined])('preserva a supressão dos estilos fixos com freeDesign=%s', freeDesign => {
    const { attached, config } = musicDraft();
    const result = validateCarouselDraft(attached, { ...config, freeDesign });
    expect(attached.slides[0].imageQuery).not.toBe('');
    expect(result.slides[0].imageQuery).toBe('');
    expect(result.slides[0].presentationBlocks).toEqual(savedMusic.presentationBlocks);
  });

  it.each([
    ['photo none', { ...musicPlan, design: { ...musicPlan.design, photo: 'none' } }],
    ['sem cena', { ...musicPlan, scene: null }],
    ['sem intenção de foto', { ...musicPlan, design: null }],
  ])('não transforma uma query solta em foto com bloco: %s', (_, entry) => {
    const { attached, config } = musicDraft(entry);
    attached.slides[0].imageQuery = 'A stray image request outside the validated image intent.';
    const result = validateCarouselDraft(attached, config);
    expect(result.slides[0].imageQuery).toBe('');
    expect(result.slides[0].presentationBlocks).toEqual(savedMusic.presentationBlocks);
  });

  it('generateReviewedCarousel conserva a imagem planejada após o lote e a revisão reais', async () => {
    // Keep the real cover, music and closing in their original order. Three
    // positions are enough to exercise planning, a validated writing batch,
    // finishing, review and the same composition entry point used by the app.
    const originalIndexes = [1, 4, 10];
    const plan = { ...structuredClone(doc.presentationPlan),
      slides: originalIndexes.map((originalIndex, index) => ({
        ...structuredClone(doc.presentationPlan.slides[originalIndex - 1]), index: index + 1,
      })) };
    const raw = originalIndexes.map(index => rawSlide(doc.slides.find(slide => slide.presentationPlan.index === index)));
    const onDraft = vi.fn();
    const ai = vi.fn(async prompt => {
      if (prompt.startsWith('PLANEJAMENTO ESTRUTURADO')) return structuredClone(plan);
      if (prompt.startsWith('REVISÃO') || prompt.includes('REPARO DIRECIONADO:')) return { edits: [] };
      const line = prompt.split('\n').find(value => value.startsWith('POSIÇÕES DESTA CHAMADA: '));
      if (!line) throw new Error('Etapa inesperada no fluxo de redação.');
      const positions = JSON.parse(line.slice('POSIÇÕES DESTA CHAMADA: '.length));
      return { slides: positions.map(entry => structuredClone(raw[entry.index - 1])), caption: '' };
    });
    const output = await generateReviewedCarousel({ prompt: source, onDraft, config: {
      count: 3, presetId: 'apresentacao', presentationPath: 'auto', presentationPlanning: true,
      freeDesign: true, nativeBlocks: true, factualSource: source,
      planningContext: { brief: doc.editorialTopic || 'Apresentação da festa Apoteose.',
        sources: [{ id: 'source-base', text: source }] },
    } }, ai);
    const music = output.result.slides[1];
    expect(onDraft.mock.calls.some(([, meta]) => meta.phase === 'writing')).toBe(true);
    expect(ai.mock.calls.some(([prompt]) => prompt.startsWith('REVISÃO'))).toBe(true);
    expect(music.imageQuery).toBe(presentationPlanEntryImageQuery(output.plan.slides[1]));
    expect(music.imageQuery).not.toBe('');
    expect(music.presentationPlan.design.photo).toBe('small');
    expect(music.presentationBlocks).toEqual(savedMusic.presentationBlocks);
    const composed = composeMusic(music, output.plan.deckDesign);
    expect(composed.presentationFreeDesign.photo).toBe('small');
    expect(composed.presentationSuppressPhoto).toBe(false);
  });
});
