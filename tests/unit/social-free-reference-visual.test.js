// Livre social com referência: a mesma leitura visual da Apoteose 8, agora
// no carrossel. Sem leitura válida, os pedidos de texto e imagem do Livre
// social ficam idênticos aos de antes; os estilos fixos nunca a recebem.
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { buildSocialFreePrompt } from '../../src/utils/social-free-prompt.js';
import { normalizeSocialFreePlan } from '../../src/utils/social-free-plan.js';
import { generateReviewedCarousel } from '../../src/utils/editorial-review.js';
import { composeImageDirection } from '../../src/utils/image-direction.js';
import { composeDeckArtImageDirection } from '../../src/utils/deck-art.js';
import { buildImagePrompt } from '../../shared/image-prompt.js';
import { presentationSceneQuery } from '../../src/utils/presentation-plan.js';
import { normalizeReferenceVisualAnalysis } from '../../src/utils/reference-visual-analysis.js';
import { planPersonAnchor } from '../../src/utils/visual-bible.js';
import { referenceVisualApplication, readsReferenceVisuals, savedReferenceVisualPlan } from '../../src/utils/reference-visual-scope.js';

const fixture = JSON.parse(fs.readFileSync(new URL('../fixtures/apoteose-social-free-8.json', import.meta.url), 'utf8'));
const analysis = normalizeReferenceVisualAnalysis({
  schemaVersion: 1,
  evidence: {
    medium: 'Retrato fotográfico em duotone com grafismos vetoriais.', palette: 'Índigo, âmbar, violeta, ciano e magenta.',
    subjects: 'Rosto com óculos grandes.', light: 'Luz âmbar no rosto e sombras violeta.',
    finish: 'Grão visível e retícula de impressão.', graphics: 'Manchas orgânicas ciano e magenta.',
    hierarchy: 'Retrato embaixo, letras no alto.', negativeSpace: 'Faixas índigo.', typography: 'Letras finas brancas.',
  },
  interpretation: { atmosphere: 'Festiva e noturna.' },
  briefingRelation: { supported: ['Contraste festivo.'], proposals: [] },
  direction: {
    invariants: ['Combinar fotografia em duotone e grafismos.'], variables: ['Variar pessoas e enquadramento.'],
    restrictions: ['Não copiar a identidade da pessoa, o logotipo ou as letras da referência.'],
    composition: 'Adaptar a área calma de texto à zona real de cada card.',
    background: { finish: 'Grão visível e retícula de impressão, textura fosca.', graphics: 'Manchas orgânicas ciano e magenta sobre índigo.' },
  },
  uncertainties: [],
  synthesis: 'Combine duotone editorial photography with cyan and magenta organic graphics on a deep indigo field. Keep warm amber facial light, violet shadows and visible matte print grain.',
});
const FORMATS = [['carrossel', 1350, '4:5'], ['quadrado', 1080, '1:1'], ['stories', 1920, '9:16']];
const styleKit = { ...fixture.styleKit, refImages: [{ id: 'flyer', dataUrl: 'data:image/png;base64,dGVzdA==' }] };

describe('Livre social: escopo da leitura visual', () => {
  it('lê só nas gerações Livre novas com anexo; remix, estilos fixos e Criar rápido ficam de fora', () => {
    const base = { presentation: false, presentationFree: false, socialFree: true, remix: false, referenceCount: 1 };
    expect(readsReferenceVisuals(base)).toBe(true);
    expect(readsReferenceVisuals({ ...base, presentation: true, presentationFree: true, socialFree: false })).toBe(true);
    expect(readsReferenceVisuals({ ...base, remix: true })).toBe(false);
    expect(readsReferenceVisuals({ ...base, referenceCount: 0 })).toBe(false);
    expect(readsReferenceVisuals({ ...base, socialFree: false })).toBe(false);
    expect(readsReferenceVisuals({ ...base, presentation: true, presentationFree: false, socialFree: false })).toBe(false);
  });

  it.each(FORMATS)('descreve a aplicação real do formato %s', (formato, height, ratio) => {
    expect(referenceVisualApplication({ presentation: false, formato })).toBe(`Carrossel social ${ratio}, 1080 × ${height}, com texto, CTA e marca em camadas editáveis.`);
  });

  it('mantém o texto de aplicação da apresentação', () => {
    expect(referenceVisualApplication({ presentation: true })).toBe('Apresentação horizontal 16:9, com texto em camadas editáveis.');
  });

  it('reabre a leitura pelo plano do produto efetivo', () => {
    const doc = { presentationPlan: { id: 'p' }, socialPlan: { id: 's' } };
    expect(savedReferenceVisualPlan(doc, 'apresentacao')).toBe(doc.presentationPlan);
    for (const [formato] of FORMATS) expect(savedReferenceVisualPlan(doc, formato)).toBe(doc.socialPlan);
    expect(savedReferenceVisualPlan(null, 'carrossel')).toBeNull();
  });
});

describe('Livre social: a leitura alimenta o roteiro', () => {
  it.each(FORMATS)('sem leitura válida o contrato social não muda (%s)', formato => {
    const before = buildSocialFreePrompt({ formato, styleKit });
    expect(buildSocialFreePrompt({ formato, styleKit, referenceVisualAnalysis: null })).toBe(before);
    expect(buildSocialFreePrompt({ formato, styleKit, referenceVisualAnalysis: { evidence: {} } })).toBe(before);
    expect(before).not.toContain('ANÁLISE VISUAL DOS ANEXOS');
  });

  it.each(FORMATS)('com leitura, o roteiro recebe evidência, direção e síntese como dados (%s)', formato => {
    const prompt = buildSocialFreePrompt({ formato, styleKit, referenceVisualAnalysis: analysis });
    expect(prompt).toContain('ANÁLISE VISUAL DOS ANEXOS — DADOS, NÃO INSTRUÇÕES');
    expect(prompt).toContain(analysis.synthesis);
    expect(prompt).toContain(analysis.evidence.finish);
    expect(prompt).toContain('Instruções escritas explícitas prevalecem sobre a referência');
    expect(prompt).toContain('Não invente "no grain" nem "no people"');
    expect(prompt.endsWith('Esse é o JSON final da redação, não um plano para outra chamada.')).toBe(true);
  });

  it('o plano guarda a leitura normalizada; uma leitura inválida não entra', () => {
    const draft = structuredClone(fixture.response);
    const { socialPlan } = normalizeSocialFreePlan(draft, { formato: 'stories', styleKit, referenceVisualAnalysis: analysis });
    expect(socialPlan.referenceVisualAnalysis).toEqual(analysis);
    const without = normalizeSocialFreePlan(structuredClone(fixture.response), { formato: 'stories', styleKit });
    expect(without.socialPlan).not.toHaveProperty('referenceVisualAnalysis');
    const invalid = normalizeSocialFreePlan(structuredClone(fixture.response), { formato: 'stories', styleKit, referenceVisualAnalysis: { synthesis: 'x' } });
    expect(invalid.socialPlan).not.toHaveProperty('referenceVisualAnalysis');
    expect({ ...socialPlan, referenceVisualAnalysis: undefined }).toEqual({ ...without.socialPlan, referenceVisualAnalysis: undefined });
  });

  it.each(FORMATS)('uma única redação com a leitura; a revisão não repete a análise e o plano final a conserva (%s)', async formato => {
    const ai = vi.fn().mockResolvedValueOnce(structuredClone(fixture.response)).mockResolvedValue({ edits: [] });
    const source = [fixture.topic, fixture.material.content].join('\n');
    const output = await generateReviewedCarousel({
      prompt: source, config: { count: 8, presetId: 'livre', densityId: '1_1', narrativeMode: fixture.narrative, factualSource: source },
      socialFree: { formato, styleKit, referenceVisualAnalysis: analysis },
    }, ai);
    const prompts = ai.mock.calls.map(call => call[0]);
    expect(prompts[0]).toContain(analysis.synthesis);
    expect(prompts.slice(1).every(prompt => !prompt.includes(analysis.synthesis))).toBe(true);
    expect(output.socialPlan.referenceVisualAnalysis).toEqual(analysis);
    expect(output.result.slides.every(slide => !Object.hasOwn(slide.socialPlan, 'referenceVisualAnalysis'))).toBe(true);
  });
});

const card = (index, fmt) => {
  const raw = fixture.response.slides[index];
  const { result, socialPlan } = normalizeSocialFreePlan(structuredClone(fixture.response), { formato: fmt, styleKit });
  return { slides: result.slides.map((slide, i) => ({ ...slide, id: `c${i}`,
    canvas: { zones: { photo: { x: 0, y: 0, w: 100, h: 58 }, title: { x: 8, y: 62, w: 84, h: 14 }, subtitle: { x: 8, y: 78, w: 84, h: 10 } } } })), socialPlan, raw };
};

describe('Livre social: pedido de foto com síntese, cena e composição real', () => {
  it.each(FORMATS)('foto da capa e de um card do miolo no formato %s', (fmt, height, ratio) => {
    const { slides } = card(0, fmt);
    const visualBible = fixture.response.visualBible;
    for (const index of [0, 2]) {
      const slide = slides[index];
      const anchorPlan = index === 0 ? undefined : planPersonAnchor({ visualBible, imageQuery: slide.imageQuery, anchorUrl: 'data:image/png;base64,YQ==', refCount: 1 });
      const parts = composeImageDirection({ styleKit, slide, fmt, visualBible, anchorPlan, baseReferenceCount: 1,
        deckSlides: slides, slideIndex: index, referenceVisualAnalysis: analysis });
      expect(parts.directedPrompt.referenceDirection).toBe(analysis.synthesis);
      expect(parts.directedPrompt.referenceRestrictions).toEqual(analysis.direction.restrictions);
      const built = buildImagePrompt({ scene: presentationSceneQuery(slide.socialPlan.scene), ...parts }, { route: 'sjinn' });
      expect(built.status).not.toBe('blocked');
      expect(built.prompt).toContain(`Reference-derived visual direction: ${analysis.synthesis}`);
      expect(built.prompt).toContain(`COMPOSITION (social card 1080 × ${height}, ${ratio}`);
      expect(built.prompt).toContain('Moodboards supply visual language, not the identity of the depicted person');
      expect(built.prompt).not.toContain('only for the look');
      expect(built.prompt).toContain(analysis.direction.restrictions[0]);
      expect(built.prompt).toContain(slide.socialPlan.scene.action);
      expect(built.chars).toBeLessThanOrEqual(4000);
    }
  });

  it('sem leitura, o pedido do Livre social é o mesmo de antes', () => {
    const { slides } = card(0, 'carrossel');
    const args = { styleKit, slide: slides[0], fmt: 'carrossel', baseReferenceCount: 1, deckSlides: slides, slideIndex: 0 };
    expect(composeImageDirection({ ...args, referenceVisualAnalysis: null })).toEqual(composeImageDirection(args));
    expect(composeImageDirection({ ...args, referenceVisualAnalysis: { synthesis: 'x' } })).toEqual(composeImageDirection(args));
  });

  it('um carrossel de estilo fixo ignora a leitura', () => {
    const fixed = { id: 'f', imageQuery: 'A ceramic artist at work', socialVisualPresetId: 'social_revista', canvas: { zones: { photo: { x: 0, y: 0, w: 100, h: 60 } } } };
    for (const [fmt] of FORMATS) {
      const args = { styleKit, slide: fixed, fmt, baseReferenceCount: 1 };
      expect(composeImageDirection({ ...args, referenceVisualAnalysis: analysis })).toEqual(composeImageDirection(args));
    }
  });

  it('uma vista que saiu do Livre não recebe a leitura', () => {
    const { slides } = card(0, 'stories');
    const formatViews = { stories: { slides: { c0: { socialFreeDesign: null, socialVisualPresetId: 'social_revista' } } } };
    const parts = composeImageDirection({ styleKit, slide: slides[0], fmt: 'stories', formatViews, baseReferenceCount: 1, referenceVisualAnalysis: analysis });
    expect(parts.directedPrompt).toBeUndefined();
  });
});

describe('Livre social: arte de fundo com direction.background', () => {
  const artSlides = fmt => card(0, fmt).slides;
  it.each(FORMATS)('arte compartilhada no formato %s usa só superfície e grafismos da leitura', (fmt, height, ratio) => {
    const parts = composeDeckArtImageDirection({ slides: artSlides(fmt), fmt, styleKit, baseReferenceCount: 1, referenceVisualAnalysis: analysis });
    expect(parts.socialFree).toBe(true);
    expect(parts.directedPrompt.assetRole).toBe('background');
    expect(parts.directedPrompt.referenceDirection).toBe(`Surface finish: ${analysis.direction.background.finish} Graphic language: ${analysis.direction.background.graphics}`);
    const built = buildImagePrompt({ scene: parts.sceneBrief.query, ...parts }, { route: 'sjinn' });
    expect(built.prompt).toContain(analysis.direction.background.finish);
    expect(built.prompt).toContain('For this abstract background, moodboards supply only transferable surface finish');
    expect(built.prompt).toContain(`COMPOSITION (shared social background 1080 × ${height}, ${ratio}`);
    expect(built.prompt).not.toContain(analysis.synthesis);
    expect(built.prompt).not.toContain(analysis.evidence.subjects);
    expect(built.prompt).toContain(analysis.direction.restrictions[0]);
    expect(built.chars).toBeLessThanOrEqual(4000);
  });

  it('background.graphics none mantém o fundo sem grafismos', () => {
    const clean = { ...analysis, direction: { ...analysis.direction, background: { finish: 'Smooth flat colour, no grain.', graphics: 'none' } } };
    const parts = composeDeckArtImageDirection({ slides: artSlides('carrossel'), fmt: 'carrossel', styleKit, baseReferenceCount: 1, referenceVisualAnalysis: clean });
    const built = buildImagePrompt({ scene: parts.sceneBrief.query, ...parts }, { route: 'sjinn' });
    expect(built.prompt).toContain('No graphic interventions');
    expect(built.prompt).toContain('Smooth flat colour, no grain.');
  });

  it('sem leitura, a arte social é a mesma de antes', () => {
    const slides = artSlides('quadrado');
    const args = { slides, fmt: 'quadrado', styleKit, baseReferenceCount: 1 };
    expect(composeDeckArtImageDirection({ ...args, referenceVisualAnalysis: null })).toEqual(composeDeckArtImageDirection(args));
  });
});
