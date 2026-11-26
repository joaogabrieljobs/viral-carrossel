import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { freePresentationCompositionOverrides } from '../../src/utils/free-design.js';
import { personalityComparison } from '../../src/utils/free-draft.js';
import { auditPresentationLayout } from '../../src/utils/presentation-quality.js';
import { FAMILY_KEYS } from '../../src/utils/presentation-families.js';

const T7 = JSON.parse(readFileSync(new URL('../fixtures/apoteose-teste7.json', import.meta.url), 'utf8'));

function personalityPage(ground, family = 'swiss', title = T7.slides[7].title) {
  const raw = T7.slides[7];
  const slide = personalityComparison({
    id: 'teste7-swiss-pares', title, subtitle: raw.subtitle, eyebrow: 'A PERSONALIDADE',
    presentationPlan: { visualRole: raw.visualRole, purpose: raw.purpose, design: { ...raw.design, ground, family } },
  });
  const composed = freePresentationCompositionOverrides({}, { slide, index: 7, count: 10, deckDesign: T7.deckDesign });
  return { ...slide, ...composed, canvas: { ...composed.canvas, applied: true } };
}

describe('Teste 7: comparação Suíça legível sobre a arte', () => {
  it('os sete pares e o título ocupam áreas separadas, sem invadir o lado da arte', () => {
    const slide = personalityPage('art');
    expect(slide.presentationFreeDesign).toMatchObject({ family: 'swiss', ground: 'art', photo: 'none', block: 'comparison' });
    expect(slide.presentationBlocks[0].rows).toHaveLength(7);
    expect(auditPresentationLayout(slide).issues).toEqual([]);
    const { title, evidence } = slide.canvas.zones;
    expect(evidence.w).toBeGreaterThanOrEqual(50);
    expect(evidence.h).toBeGreaterThanOrEqual(25);
    expect(evidence.x + evidence.w).toBeLessThanOrEqual(72);
    const intersects = rect => Math.min(rect.x + rect.w, evidence.x + evidence.w) > Math.max(rect.x, evidence.x)
      && Math.min(rect.y + rect.h, evidence.y + evidence.h) > Math.max(rect.y, evidence.y);
    expect(intersects(title)).toBe(false);
    expect(slide.presentationChrome.chrome.filter(d => ['rule', 'block'].includes(d.t) && d.w > 0 && d.h > 0).some(intersects)).toBe(false);
  });

  it('a mesma comparação em fundo sólido conserva a geometria Suíça válida', () => {
    const slide = personalityPage('bg');
    expect(slide.presentationFreeDesign.family).toBe('swiss');
    expect(slide.presentationFreeDesign.ground).toBe('bg');
    expect(slide.presentationBlocks[0].rows).toHaveLength(7);
    expect(auditPresentationLayout(slide).issues).toEqual([]);
  });

  it.each(FAMILY_KEYS)('%s mantém os sete pares sem colisão, inclusive com palavra longa no título', family => {
    const title = 'Contemporaneidade brasileira';
    const slide = personalityPage('art', family, title);
    expect(slide.title).toBe(title);
    expect(slide.presentationFreeDesign.family).toBe(family);
    expect(slide.presentationBlocks[0].rows).toHaveLength(7);
    expect(auditPresentationLayout(slide).issues).toEqual([]);
    expect(slide.canvas.zones.evidence.x + slide.canvas.zones.evidence.w).toBeLessThanOrEqual(72);
  });
});
