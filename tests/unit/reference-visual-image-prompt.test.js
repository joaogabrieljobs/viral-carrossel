import { describe, expect, it } from 'vitest';
import { composeImageDirection } from '../../src/utils/image-direction.js';
import { composeDeckArtImageDirection } from '../../src/utils/deck-art.js';
import { planImageRequest } from '../../shared/image-prompt.js';
import { presentationSceneQuery } from '../../src/utils/presentation-plan.js';
import fixture from '../fixtures/apoteose-teste8.json';

const analysis = {
  schemaVersion: 1,
  evidence: { medium: 'Photographic editorial portrait.', light: 'Warm orange key and magenta rim.',
    finish: 'Fine visible grain and detailed skin texture.', graphics: 'Sparse cyan organic printed accents.' },
  interpretation: { atmosphere: 'Expressive and warm.' },
  direction: { invariants: ['Photographic detail leads; graphics support it.'], variables: ['Casting and framing.'], restrictions: ['No baked text.'], composition: 'Follow the actual photo panel.',
    background: { finish: 'Fine printed grain on a uniform color field.', graphics: 'Sparse cyan organic printed accents.' } },
  synthesis: 'Photographic detail leads: expressive faces, skin texture and fabric. Fine visible grain, warm orange key light and magenta rim. Cyan organic print accents support the photo and leave the face clear.',
};
const slide = fixture.doc.slides.find(item => item.presentationPlan.index === 5);
const input = { slide, fmt: 'apresentacao', styleKit: fixture.doc.styleKit, baseReferenceCount: 1,
  deckSlides: fixture.doc.slides, slideIndex: fixture.doc.slides.indexOf(slide) };

describe('leitura visual chega ao GPT Image 2', () => {
  it('protege a síntese observada em vez do acabamento inventado pelo plano cego', () => {
    const direction = composeImageDirection({ ...input, referenceVisualAnalysis: analysis });
    const request = planImageRequest({ ...direction, scene: slide.imageQuery }, { route: 'sjinn', model: 'gpt-image-2' });
    expect(request.status).toBe('ready');
    expect(request.prompt).toContain(analysis.synthesis);
    expect(request.prompt).not.toContain('Smooth digital finish');
    expect(request.prompt).not.toContain('Finish: Smooth');
    expect(request.prompt).not.toContain('grain texture, sober muted photography');
    expect(request.prompt).toContain('No baked text.');
    expect(request.prompt).toContain(slide.presentationPlan.scene.action);
    expect(request.prompt).toContain('COMPOSITION');
    expect(request.prompt).toContain('identity');
    expect(request.chars).toBeLessThanOrEqual(4000);
    expect(request.diagnostics.essentialComplete).toBe(true);
  });

  it('a mesma leitura não cria pessoas no fundo abstrato, nem texto dentro da imagem', () => {
    const direction = composeDeckArtImageDirection({ slides: fixture.doc.slides, styleKit: fixture.doc.styleKit,
      baseReferenceCount: 1, referenceVisualAnalysis: analysis });
    const request = planImageRequest({ ...direction, scene: direction.sceneBrief.query }, { route: 'sjinn' });
    expect(request.status).toBe('ready');
    expect(request.prompt).toContain(analysis.direction.background.finish);
    expect(request.prompt).toContain(analysis.direction.background.graphics);
    expect(request.prompt).not.toContain('expressive faces');
    expect(request.prompt).not.toContain('skin texture');
    expect(request.prompt).not.toContain('grain texture, sober muted photography');
    expect(request.prompt).toContain('No people, faces, hands or bodies');
    expect(request.prompt).toContain('No lettering, captions, logos or watermarks');
    expect(request.chars).toBeLessThanOrEqual(4000);
  });

  it('a arte analisada mantém as exclusões globais do briefing sem recuperar avoid inferido ou local', () => {
    const localAvoid = 'The scene must not show a crowded dancefloor or a second turntable.';
    const slides = fixture.doc.slides.map(item => ({ ...item,
      presentationPlan: { ...item.presentationPlan, avoid: localAvoid },
    }));
    const direction = composeDeckArtImageDirection({ slides, styleKit: fixture.doc.styleKit,
      baseReferenceCount: 1, referenceVisualAnalysis: analysis });
    const request = planImageRequest({ ...direction, scene: direction.sceneBrief.query }, { route: 'sjinn' });
    const rules = slides.find(item => item.presentationFreeDesign?.ground === 'art').presentationPlan.imageRules;
    expect(rules).toHaveLength(2);
    for (const rule of rules) expect(request.prompt).toContain(rule);
    expect(request.prompt).not.toContain(localAvoid);
    expect(request.prompt).not.toContain('grain texture, sober muted photography');
    expect(request.prompt).toContain(analysis.direction.background.finish);
    expect(request.status).toBe('ready');
    expect(request.diagnostics.essentialComplete).toBe(true);
    expect(request.chars).toBeLessThanOrEqual(4000);
  });

  it('a inclusão das regras globais não altera o pedido de arte sem análise válida', () => {
    const options = { slides: fixture.doc.slides, styleKit: fixture.doc.styleKit, baseReferenceCount: 1 };
    const before = composeDeckArtImageDirection(options);
    expect(composeDeckArtImageDirection({ ...options, referenceVisualAnalysis: null })).toEqual(before);
    expect(composeDeckArtImageDirection({ ...options, referenceVisualAnalysis: { synthesis: analysis.synthesis } })).toEqual(before);
    const withoutRules = fixture.doc.slides.map(item => ({ ...item,
      presentationPlan: { ...item.presentationPlan, imageRules: [] },
    }));
    expect(composeDeckArtImageDirection({ ...options, slides: withoutRules })).toEqual(before);
  });

  it('um pedido de fundo liso sem grafismos prevalece sobre o que se observou no flyer', () => {
    const override = { ...analysis, direction: { ...analysis.direction,
      background: { finish: 'Smooth flat color, no grain or print texture.', graphics: 'none' } } };
    const direction = composeDeckArtImageDirection({ slides: fixture.doc.slides, styleKit: fixture.doc.styleKit,
      baseReferenceCount: 1, referenceVisualAnalysis: override });
    const request = planImageRequest({ ...direction, scene: direction.sceneBrief.query }, { route: 'sjinn' });
    expect(request.status).toBe('ready');
    expect(request.prompt).toContain(override.direction.background.finish);
    expect(request.prompt).toMatch(/no graphic interventions/i);
    expect(request.prompt).not.toContain(analysis.evidence.graphics);
    expect(request.prompt).not.toContain('photo/graphics hierarchy');
  });

  it('direção manual e corte real continuam presentes, sem carregar uma cena antiga', () => {
    const direction = composeImageDirection({ ...input, referenceVisualAnalysis: analysis,
      slideDirection: 'Use monochrome photography on this slide.' });
    const request = planImageRequest({ ...direction, scene: 'A single hand holding a vinyl record, tightly framed.' }, { route: 'sjinn' });
    expect(request.status).toBe('ready');
    expect(request.prompt).toContain('Use monochrome photography on this slide.');
    expect(request.prompt).toContain('A single hand holding a vinyl record');
    expect(request.prompt).not.toContain(slide.presentationPlan.scene.action);
    expect(request.prompt).toContain('COMPOSITION');
  });

  it('a direção escrita pode trocar o meio da referência, sem uma política que force a fotografia de volta', () => {
    const written = 'Create flat vector illustrations instead of photography.';
    const synthesis = 'Follow the explicit written direction: create a flat vector illustration, not photography. Retain only the reference palette.';
    const direction = composeImageDirection({ ...input,
      styleKit: { ...fixture.doc.styleKit, stylePrompt: written },
      referenceVisualAnalysis: { ...analysis, synthesis },
    });
    const request = planImageRequest({ ...direction, scene: slide.imageQuery }, { route: 'sjinn' });
    const policy = request.prompt.split('\n').find(line => line.startsWith('REFERENCE ROLES:'));
    expect(request.status).toBe('ready');
    expect(request.prompt).toContain(synthesis);
    expect(request.prompt).toContain(written);
    expect(policy).toMatch(/explicit written direction overrides[^\n]*medium[^\n]*look/i);
    expect(policy).toMatch(/otherwise preserve medium, detail and photo\/graphics hierarchy/i);
    expect(request.chars).toBeLessThanOrEqual(4000);
    expect(request.diagnostics.essentialComplete).toBe(true);
  });

  it('não aplica a extração nova em carrosséis fixos nem em apresentações fixas', () => {
    for (const candidate of [
      { ...input, fmt: 'carrossel', slide: { imageQuery: 'A portrait.' } },
      { ...input, slide: { ...slide, presentationPresetId: 'presentation_swiss' } },
    ]) {
      expect(composeImageDirection({ ...candidate, referenceVisualAnalysis: analysis })).toEqual(composeImageDirection(candidate));
    }
  });

  it('não acrescenta análise parcial nem altera o contrato sem análise', () => {
    expect(composeImageDirection({ ...input, referenceVisualAnalysis: { synthesis: analysis.synthesis } })).toEqual(composeImageDirection(input));
    const direction = composeImageDirection(input);
    expect(direction.directedPrompt).not.toHaveProperty('referenceDirection');
    expect(presentationSceneQuery(slide.presentationPlan.scene)).toBe(slide.imageQuery);
  });
});
