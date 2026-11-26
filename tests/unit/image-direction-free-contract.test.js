import { describe, expect, it } from 'vitest';
import { composeImageDirection } from '../../src/utils/image-direction.js';
import { composeDeckArtImageDirection, DECK_ART_SCENE } from '../../src/utils/deck-art.js';
import { presentationSceneQuery } from '../../src/utils/presentation-plan.js';
import { resolveSlideVisualDirection, reservedAreaColour } from '../../src/utils/visual-direction.js';
import { composeSocialFreeComposition } from '../../src/utils/social-free-prompt.js';
import { planImagePrompt } from '../../src/utils/ai-client.js';

const visual = {
  palette: [{ role: 'base', hex: '#2B2158' }, { role: 'subject_light', hex: '#F8701E' }, { role: 'shadow', hex: '#0E0E0F' }, { role: 'graphic', hex: '#28B2D4' }, { role: 'accent', hex: '#F8701E' }],
  finish: 'Matte editorial photography; natural fabric texture.', atmosphere: 'A quiet working studio.', graphics: 'none', avoid: 'No crowds or signs.',
};
const scene = { subject: 'A ceramic artist', wardrobe: 'Linen apron', action: 'Turning a wet bowl between both palms', expression: 'Looking down at the rim', setting: 'A workbench in front of a softly blurred shelf', light: 'Soft daylight from the right, warm reflection under the hands', graphics: 'none', shot: 'Close view from table height' };
const zones = { photo: { x: 0, y: 0, w: 100, h: 100 }, title: { x: 7.5, y: 34, w: 85, h: 37.75 }, subtitle: { x: 7.5, y: 73.53, w: 79, h: 11.17 } };
const deck = { palette: { bg: '#17364B', accent: '#E6BC65', accent2: '#75BED0', ink: '#FFFFFF' } };
const presentation = () => ({ id: 'one', presentationPresetId: 'presentation_free', presentationCompositionVersion: 3,
  presentationFreeDesign: { photo: 'full', ground: 'photo' }, presentationDeckDesign: deck, presentationPaletteOverrides: deck.palette,
  presentationPlan: { scene, visualDirection: visual }, imageQuery: presentationSceneQuery(scene), canvas: { zones }, titleColor: '#FFFFFF' });
const social = () => ({ id: 'one', socialPresetId: 'social_free', socialFreeDesign: { photo: 'full', ground: 'photo' },
  socialDeckDesign: deck, socialPlan: { kind: 'social_free', scene, visualDirection: visual }, imageQuery: presentationSceneQuery(scene), canvas: { zones }, titleColor: '#FFFFFF' });

describe('Contrato dirigido do Livre até o transporte', () => {
  it.each([['apresentacao', presentation, 'presentation_free'], ['carrossel', social, 'social_free']])('ativa contrato versionado somente no Livre de %s', (fmt, factory, kind) => {
    const slide = factory();
    const before = structuredClone(slide);
    const parts = composeImageDirection({ slide, fmt });
    expect(parts.directedPrompt).toMatchObject({ version: 2, kind, scene });
    expect(parts.directedPrompt.visual.palette.find(item => item.role === 'base').hex).toBe(deck.palette.bg);
    const plan = planImagePrompt(slide.imageQuery, {}, parts, { route: 'sjinn' });
    expect(plan.status).toBe('ready');
    expect(plan.diagnostics).toMatchObject({ contractVersion: 2, essentialComplete: true });
    expect(plan.prompt).toContain(scene.light);
    expect(plan.prompt).toContain(scene.shot);
    expect(plan.chars).toBeLessThanOrEqual(4000);
    expect(slide).toEqual(before);
  });

  it('família fixa e carrossel antigo não recebem o opt-in', () => {
    const slide = presentation();
    slide.presentationPresetId = 'presentation_editorial';
    delete slide.presentationFreeDesign;
    expect(composeImageDirection({ slide, fmt: 'apresentacao' }).directedPrompt).toBeUndefined();
    expect(composeImageDirection({ slide: { imageQuery: 'A bowl' }, fmt: 'carrossel' }).directedPrompt).toBeUndefined();
  });

  it('varia ação e ambiente de outras fotos sem incluir páginas planejadas sem foto', () => {
    const first = social();
    const next = { ...social(), id: 'two', socialPlan: { scene: { ...scene, action: 'Placing the finished bowl on a shelf', setting: 'A tall drying rack', shot: 'Wide view' } } };
    const none = { ...social(), id: 'none', socialFreeDesign: { photo: 'none' }, socialPlan: { scene: { ...scene, action: 'Stale scene that must not guide a photo' } } };
    const parts = composeImageDirection({ slide: first, fmt: 'carrossel', deckSlides: [first, next, none], slideIndex: 0 });
    expect(parts.directedPrompt?.variation).toEqual([{ index: 1, action: next.socialPlan.scene.action, setting: next.socialPlan.scene.setting, shot: next.socialPlan.scene.shot }]);
  });

  it('não apresenta uma cópia da própria cena como diferença a evitar', () => {
    const first = social();
    const duplicate = { ...social(), id: 'copy' };
    const parts = composeImageDirection({ slide: first, fmt: 'carrossel', deckSlides: [first, duplicate], slideIndex: 0 });
    expect(parts.directedPrompt.variation).toEqual([]);
  });

  it('transporta os papéis na ordem efetiva dos anexos e mantém direção manual', () => {
    const slide = social();
    const parts = composeImageDirection({ slide, fmt: 'carrossel', styleKit: { refImages: [{ id: 'look', dataUrl: 'data:image/png;base64,dGVzdA==' }] }, baseReferenceCount: 1,
      anchorPlan: { direction: 'Keep the ceramic artist identity.', entityId: 'artist', refImages: [{ id: 'anchor' }] } });
    expect(parts.directedPrompt?.references).toEqual([{ label: '', role: 'moodboard' }, { label: 'artist', role: 'identity' }]);
    const manual = 'An empty shelf, eye-level view, soft evening light.';
    const plan = planImagePrompt(manual, {}, parts, { route: 'sjinn', referenceCount: 2 });
    expect(plan.prompt).toContain(manual);
    expect(plan.prompt).not.toContain(scene.action);
    expect(plan.prompt).not.toContain(scene.light);
    expect(plan.prompt).not.toContain(scene.shot);
  });

  it('arte compartilhada usa o mesmo contrato, sem pessoas ou cena fotográfica antiga', () => {
    const slide = { ...presentation(), presentationFreeDesign: { ground: 'art', photo: 'none' } };
    const parts = composeDeckArtImageDirection({ slides: [slide] });
    expect(parts.directedPrompt?.kind).toBe('presentation_free');
    const plan = planImagePrompt(DECK_ART_SCENE, {}, parts, { route: 'sjinn' });
    expect(plan.status).toBe('ready');
    expect(plan.diagnostics?.essentialComplete).toBe(true);
    expect(plan.prompt).toMatch(/no people/i);
    expect(plan.prompt).not.toContain(scene.action);
    expect(plan.prompt).not.toContain('silkscreen');
  });
});

describe('Paleta efetiva e área de texto no pedido Livre', () => {
  it('cor final do projeto vence uma escolha anterior conflitante do kit', () => {
    const result = resolveSlideVisualDirection({ slide: presentation(), styleKit: { contextMd: 'Fundo: #AA3300\nDestaque: #009944' } });
    expect(result.palette.find(item => item.role === 'base').hex).toBe('#17364B');
    expect(result.palette.find(item => item.role === 'accent').hex).toBe('#E6BC65');
    const fixed = { ...presentation(), presentationPresetId: 'presentation_editorial' };
    expect(resolveSlideVisualDirection({ slide: fixed, styleKit: { contextMd: 'Fundo: #AA3300' } }).palette.find(item => item.role === 'base').hex).toBe('#AA3300');
  });

  it('preferência explícita preserva base cromática legível; caminho antigo permanece igual', () => {
    expect(reservedAreaColour(visual, '#FFFFFF', { preferBase: true })).toBe('#2B2158');
    expect(reservedAreaColour(visual, '#FFFFFF')).toBe('#0E0E0F');
    const bright = { ...visual, palette: [{ role: 'base', hex: '#EEEEEE' }, { role: 'shadow', hex: '#17364B' }] };
    expect(reservedAreaColour(bright, '#FFFFFF', { preferBase: true })).toBe('#17364B');
  });

  it.each(['carrossel', 'quadrado', 'stories'])('área central em %s tem limites numéricos em vez de orientação vaga', fmt => {
    const composition = composeSocialFreeComposition(social(), { fmt, visualDirection: visual });
    expect(composition).toContain('x 7.5–92.5%, y 34–84.7%');
    expect(composition).toContain('#2B2158');
  });

  it('os limites são relativos ao recorte da imagem na vista editada', () => {
    const slide = social();
    const formatViews = { stories: { slides: { one: { canvas: { zones: { photo: { x: 10, y: 10, w: 80, h: 80 }, title: { x: 14, y: 30, w: 72, h: 52 } } } } } } };
    const composition = composeSocialFreeComposition(slide, { fmt: 'stories', formatViews, visualDirection: visual });
    expect(composition).toContain('x 5–95%, y 25–90%');
    expect(slide.canvas.zones).toEqual(zones);
  });
});
