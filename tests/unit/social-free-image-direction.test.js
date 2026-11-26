import { describe, expect, it } from 'vitest';
import { composeImageDirection } from '../../src/utils/image-direction.js';
import { buildImagePrompt, IMAGE_PROMPT_TEXT } from '../../shared/image-prompt.js';
import { presentationSceneQuery } from '../../src/utils/presentation-plan.js';

const visualDirection = {
  palette: [{ role: 'base', hex: '#17364B' }, { role: 'subject_light', hex: '#E6BC65' }, { role: 'graphic', hex: '#75BED0' }],
  finish: 'Smooth matte colour.', atmosphere: 'Quiet workshop.', graphics: 'none', avoid: 'Crowds and lettering.',
};
const scene = { subject: 'An adult ceramic artist', wardrobe: 'Plain cotton jacket', action: 'Shaping clay', expression: 'Concentration', setting: 'Workshop', light: 'Neutral daylight', graphics: 'none', shot: 'medium shot' };
const card = (id = 'a') => ({
  id, socialPresetId: 'social_free', socialFreeDesign: { ground: 'photo', photo: 'full', family: 'editorial', block: 'none' },
  socialPlan: { scene, avoid: ['Festival crowds'], visualDirection },
  socialDeckDesign: { palette: { bg: '#17364B', accent: '#E6BC65', accent2: '#75BED0', ink: '#FFFFFF' }, fonts: { display: 'Inter', text: 'Inter' } },
  titleColor: '#FFFFFF',
  canvas: { zones: { photo: { x: 0, y: 0, w: 100, h: 100 }, title: { x: 8, y: 10, w: 48, h: 20 }, subtitle: { x: 8, y: 35, w: 48, h: 20 } } },
});
const styleKit = { stylePrompt: 'Precise matte editorial photography.', refImages: [{ id: 'style', dataUrl: 'data:image/png;base64,dGVzdA==' }] };

describe('Imagem do Livre social: visual próprio e geometria real', () => {
  it.each([['carrossel', '1080 × 1350'], ['quadrado', '1080 × 1080'], ['stories', '1080 × 1920']])('usa o formato %s sem fingir apresentação', (fmt, dimensions) => {
    const first = card();
    const other = { ...card('b'), socialPlan: { scene: { subject: 'Open sketchbooks', action: 'Resting on a desk', setting: 'Quiet library', shot: 'overhead' }, visualDirection } };
    const parts = composeImageDirection({ slide: first, fmt, styleKit, baseReferenceCount: 1, deckSlides: [first, other], slideIndex: 0 });
    expect(parts.format).toBe('carousel');
    expect(parts.socialFree).toBe(true);
    expect(parts.composition).toContain(dimensions);
    expect(parts.composition).toContain('left 56%');
    expect(parts.sceneBrief.subject).toContain('Plain cotton jacket');
    expect(parts.avoid).toContain('Festival crowds');
    expect(parts.otherScenes.join(' ')).toContain('Open sketchbooks');
    const built = buildImagePrompt({ scene: presentationSceneQuery(scene), ...parts }, { route: 'sjinn' });
    expect(built.prompt).toContain('VISUAL DIRECTION');
    expect(built.prompt).toContain('COMPOSITION');
    expect(built.prompt).toContain('SUBJECT AND CASTING');
    expect(built.prompt).not.toContain('16:9');
    expect(built.prompt).not.toContain('medium, palette, lighting and composition.');
    expect(built.prompt).toContain('never for people, objects, framing or composition');
    expect(built.chars).toBeLessThanOrEqual(4000);
  });

  it('usa a zona editada no formato, sem alterar o card canônico', () => {
    const slide = card();
    const before = structuredClone(slide);
    const formatViews = { stories: { slides: { a: { canvas: { zones: { photo: { x: 0, y: 0, w: 100, h: 100 }, title: { x: 52, y: 14, w: 40, h: 16 }, subtitle: { x: 52, y: 35, w: 40, h: 20 } } } } } } };
    const parts = composeImageDirection({ slide, fmt: 'stories', formatViews });
    expect(parts.composition).toContain('right 48%');
    expect(slide).toEqual(before);
  });

  it('o enquadramento acompanha a foto editada na vista, sem contradizer sua composição', () => {
    const slide = card();
    slide.canvas = { applied: true, zones: { photo: { x: 80, y: 0, w: 20, h: 100 }, title: { x: 8, y: 14, w: 60, h: 20 } } };
    const formatViews = { stories: { slides: { a: { canvas: { applied: true, userEdited: true, zones: {
      photo: { x: 0, y: 65, w: 100, h: 15 }, title: { x: 8, y: 14, w: 84, h: 20 },
    } } } } } };
    const parts = composeImageDirection({ slide, fmt: 'stories', formatViews });
    expect(parts.composition).toContain('covering 100% of the card width and 15% of its height');
    expect(parts.framing).toContain('wide, shallow band');
    expect(parts.framing).not.toContain('tall, narrow column');
  });

  it('preserva âncora e ficha visual sem pedir uma pessoa diferente da referência de identidade', () => {
    const anchorPlan = { direction: 'IDENTITY ANCHOR: keep the attached person identical.', refImages: ['data:image/png;base64,YQ=='], excludeEntityIds: ['person-1'] };
    const visualBible = { entities: [
      { id: 'person-1', en: 'Adult ceramic artist with short black hair and plain cotton clothing.', never: 'Face changes.' },
      { id: 'workshop', en: 'A quiet workshop with wooden benches and neutral natural light.', never: 'Festival decorations.' },
    ] };
    const parts = composeImageDirection({ slide: card(), fmt: 'quadrado', anchorPlan, visualBible, baseReferenceCount: 0 });
    const built = buildImagePrompt({ scene: presentationSceneQuery(scene), ...parts }, { route: 'sjinn' });
    expect(parts.identityAnchor).toBe(anchorPlan.direction);
    expect(built.prompt).toContain(anchorPlan.direction);
    expect(built.prompt).not.toContain('never a real person, a celebrity or anyone from the reference images');
    expect(parts.referenceCount).toBe(1);
    expect(built.prompt).toContain('PROJECT SUBJECTS');
    expect(built.prompt).toContain('A quiet workshop with wooden benches');
    expect(parts.subjects).not.toContain('person-1');
  });

  it.each(['sjinn', 'mcp'])('orçamento mantém composição e regras no opt-in, rota %s', route => {
    const first = card();
    const parts = composeImageDirection({ slide: first, fmt: 'stories', styleKit: { stylePrompt: 'Precise neutral matte material. '.repeat(100) } });
    const built = buildImagePrompt({ scene: presentationSceneQuery(scene), ...parts, otherScenes: Array.from({ length: 5 }, (_, i) => `Different workshop activity ${i} with a distinct camera angle and composition of hands and materials.`) }, { route });
    expect(built.prompt).toContain('COMPOSITION');
    expect(built.prompt).toContain('1080 × 1920');
    expect(built.prompt).toMatch(/No lettering, captions, logos or watermarks/);
    expect(built.prompt).toContain('base colour, the dominant field #17364B');
    expect(built.chars).toBeLessThanOrEqual(4000);
  });

  it('no aperto do orçamento reduz a cena antes de perder a âncora explícita', () => {
    const first = card();
    const long = { ...scene, subject: 'An adult ceramic artist with consistent facial features and clothing. '.repeat(5), wardrobe: 'Neutral cotton clothing with accurate textile details. '.repeat(5), action: 'Slowly shaping natural clay with coherent hands. '.repeat(5), expression: 'Quiet concentration on the task. '.repeat(7), light: 'Soft neutral daylight from a window. '.repeat(7), graphics: 'No decorative interventions. '.repeat(8) };
    first.socialPlan = { ...first.socialPlan, scene: long };
    const anchor = 'IDENTITY ANCHOR: The last image identifies the same ceramic artist. Keep face, hair, skin tone and build consistent; change only action, pose and setting according to this scene. Do not copy the pose or setting from the anchor image.';
    const parts = composeImageDirection({ slide: first, fmt: 'carrossel', styleKit, baseReferenceCount: 1, anchorPlan: { direction: anchor, refImages: ['data:image/png;base64,YQ=='] } });
    const built = buildImagePrompt({ scene: presentationSceneQuery(long), ...parts }, { route: 'sjinn' });
    expect(built.prompt).toContain(anchor);
    expect(built.prompt).toContain('REFERENCE ROLES:');
    expect(built.prompt).toContain('COMPOSITION');
    expect(built.chars).toBeLessThanOrEqual(4000);
  });

  it.each([false, true])('preserva a ficha inteira da personagem sob orçamento, com âncora %s', anchored => {
    const first = card();
    const richVisual = { ...visualDirection,
      finish: 'Fine editorial film grain, subtle printed texture and realistic contemporary campaign treatment. '.repeat(3),
      atmosphere: 'An intense urban night with warm side light and restrained cyan details. '.repeat(3),
      graphics: 'Only the specified geometric colour interventions in the unused margins, no lettering. '.repeat(3),
    };
    first.socialPlan = { ...first.socialPlan, visualDirection: richVisual };
    first.canvas = { applied: true, zones: { photo: { x: 7.5, y: 30.8, w: 85, h: 21.36 }, title: { x: 7.5, y: 14, w: 85, h: 12 } } };
    const entity = { id: 'convidada', en: 'A fictional adult woman with short dark hair, wearing a terracotta shirt and dark trousers, with no branded clothing.', never: 'Celebrity resemblance, costume, branded clothing, hair or outfit changes.' };
    const anchor = 'IDENTITY ANCHOR: The last attached image identifies the recurring woman. Preserve face, hair, skin tone and build. Follow the subject sheet for clothing; this scene determines action, setting and pose.';
    const parts = composeImageDirection({ slide: first, fmt: 'quadrado', styleKit, baseReferenceCount: 1,
      visualBible: { entities: [entity] }, ...(anchored ? { anchorPlan: { direction: anchor, refImages: ['data:image/png;base64,YQ=='] } } : {}) });
    const built = buildImagePrompt({ scene: presentationSceneQuery(scene), ...parts,
      otherScenes: Array.from({ length: 5 }, (_, i) => `Another moment ${i} with the recurring fictional woman, distinct action and framing at the same urban event.`),
    }, { route: 'sjinn' });
    expect(built.prompt).toContain(entity.en);
    expect(built.prompt).toContain(entity.never);
    if (anchored) expect(built.prompt).toContain(anchor);
    expect(built.prompt).toContain('COMPOSITION');
    expect(built.prompt).toContain('#17364B');
    expect(built.chars).toBeLessThanOrEqual(4000);
  });

  it('card do catálogo não recebe campos ou papéis novos', () => {
    const slide = { ...card(), socialPresetId: 'editorial' };
    delete slide.socialFreeDesign;
    delete slide.socialPlan;
    delete slide.socialDeckDesign;
    const parts = composeImageDirection({ slide, fmt: 'carrossel', styleKit, baseReferenceCount: 1 });
    expect(parts.socialFree).toBeUndefined();
    expect(parts.composition).toBeUndefined();
    expect(parts.visualDirection).toBeUndefined();
    expect(parts.sceneBrief).toBeUndefined();
    expect(buildImagePrompt({ scene: 'Workshop', ...parts }).prompt).toContain(IMAGE_PROMPT_TEXT.referenceRoles);
  });
});
