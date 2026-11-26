import { describe, expect, it } from 'vitest';
import { mergeRemixedSlides } from '../../src/utils/carousel-remix.js';
import { preserveSocialFreeRemix } from '../../src/utils/social-free-remix.js';
import { presentationSceneQuery } from '../../src/utils/presentation-plan.js';

const scene = subject => ({ subject, wardrobe: 'Plain cotton clothing', action: 'Working with clay', expression: 'Concentration', setting: 'Quiet workshop', light: 'Neutral daylight', graphics: 'none', shot: 'medium shot' });
const deck = { palette: { bg: '#173E68', ink: '#F6EFE0', accent: '#D3A45B' }, fonts: { display: 'Inter', text: 'Inter' } };
const visualDirection = { palette: [{ role: 'base', hex: '#173E68' }], finish: 'Smooth matte', graphics: 'none' };
const signature = 'Uma oficina aberta para novas ideias.';
const make = () => {
  const sourceSlides = Array.from({ length: 3 }, (_, index) => {
    const design = { family: index === 1 ? 'swiss' : 'editorial', layout: 'opening', ground: index === 1 ? 'art' : 'photo', photo: index === 1 ? 'none' : 'full', block: 'none', emphasis: [], icons: [] };
    const card = { index, role: index === 0 ? 'cover' : index === 2 ? 'closing' : 'content', scene: index === 1 ? null : scene(`Original person ${index}`), avoid: ['Party scenes'], design, eyebrow: index ? 'A OFICINA' : '' };
    return {
      id: `card-${index}`, title: `Título original ${index}`, subtitle: index === 1 ? '' : signature, bodyAfterImage: '',
      imageQuery: index === 1 ? '' : presentationSceneQuery(card.scene), scene: card.scene, avoid: card.avoid,
      eyebrow: card.eyebrow, presentationBlocks: index === 1 ? [{ type: 'steps', items: [{ title: 'Observe', body: 'A forma original.' }] }] : [],
      socialPresetId: 'social_free', socialVisualPresetId: 'social_free', socialFreeDesign: design, socialDeckDesign: deck,
      socialPlan: { ...card, kind: 'social_free', formato: 'stories', visualDirection },
      canvas: { userEdited: index === 2, zones: { title: { x: 10 + index, y: 14, w: 80, h: 20 } } },
      visualPresetId: index === 2 ? 'meu-estilo' : null, customBg: index === 2 ? '#EEE6D8' : '#173E68',
      titleSize: 68 + index, elementOffsets: { title: { x: index, y: 2 } }, bgImageId: `img-${index}`,
    };
  });
  const socialPlan = { version: 1, kind: 'social_free', formato: 'stories', deckDesign: deck, visualDirection, signature,
    cards: sourceSlides.map(slide => { const { kind, formato, visualDirection: vd, ...card } = slide.socialPlan; return card; }) };
  const generatedSlides = sourceSlides.map((slide, index) => ({
    title: `Título novo ${index}`, subtitle: index === 1 ? 'Não deve preencher o vazio.' : signature, bodyAfterImage: 'Não deve preencher o vazio.',
    scene: scene(`New person ${index}`), avoid: ['Old pottery'], imageQuery: `New query ${index}`,
    eyebrow: 'RÓTULO NOVO', presentationBlocks: [], design: { family: 'bold', ground: 'bg', photo: 'none' },
    socialFreeDesign: { family: 'bold', ground: 'bg', photo: 'none' }, socialDeckDesign: { palette: { bg: '#FF00FF' } },
  }));
  return { sourceSlides, generatedSlides, socialPlan, deckDesign: deck, formato: 'stories' };
};
const apply = (input, withImages) => preserveSocialFreeRemix({ ...input, withImages, slides: mergeRemixedSlides(input.sourceSlides, input.generatedSlides, withImages) });

describe('Remix do Livre social conserva o projeto existente', () => {
  it('sem imagens mantém planos, assinatura, blocos, campos vazios e ajustes de cada card', () => {
    const input = make();
    const before = structuredClone(input);
    const result = apply(input, false);
    expect(result.socialPlan).toEqual(input.socialPlan);
    expect(result.socialDeckDesign).toEqual(deck);
    result.slides.forEach((slide, index) => {
      const original = input.sourceSlides[index];
      expect(slide.title).toBe(`Título novo ${index}`);
      for (const field of ['subtitle', 'bodyAfterImage', 'scene', 'avoid', 'imageQuery', 'eyebrow', 'presentationBlocks', 'canvas', 'socialFreeDesign', 'socialDeckDesign', 'socialPlan', 'visualPresetId', 'customBg', 'titleSize', 'elementOffsets', 'bgImageId']) expect(slide[field], field).toEqual(original[field]);
    });
    expect(input).toEqual(before);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('com novas imagens muda somente a cena, as exclusões e a consulta dos cards que já pediam foto', () => {
    const input = make();
    const result = apply(input, true);
    for (const index of [0, 2]) {
      const slide = result.slides[index];
      expect(slide.scene).toEqual(input.generatedSlides[index].scene);
      expect(slide.avoid).toEqual(['Old pottery']);
      expect(slide.imageQuery).toBe(presentationSceneQuery(slide.scene));
      expect(slide.socialPlan.scene).toEqual(slide.scene);
      expect(result.socialPlan.cards[index].scene).toEqual(slide.scene);
      expect(result.socialPlan.cards[index].avoid).toEqual(slide.avoid);
      for (const field of ['canvas', 'socialFreeDesign', 'socialDeckDesign', 'visualPresetId', 'customBg', 'eyebrow', 'presentationBlocks', 'elementOffsets']) expect(slide[field], field).toEqual(input.sourceSlides[index][field]);
      expect(slide.socialPlan.visualDirection).toEqual(visualDirection);
    }
    expect(result.socialPlan.signature).toBe(signature);
    expect(result.socialPlan.visualDirection).toEqual(visualDirection);
    expect(result.socialPlan.deckDesign).toEqual(deck);
    expect(result.slides[1].imageQuery).toBe('');
    expect(result.slides[1].socialPlan).toEqual(input.sourceSlides[1].socialPlan);
  });

  it('photo none nunca herda uma consulta nova nem conserva uma consulta obsoleta', () => {
    const input = make();
    input.sourceSlides[1].imageQuery = 'Stale photo request';
    for (const withImages of [false, true]) {
      const result = apply(input, withImages);
      expect(result.slides[1].imageQuery).toBe('');
      expect(result.slides[1].scene).toBeNull();
      expect(result.slides[1].socialFreeDesign).toEqual(input.sourceSlides[1].socialFreeDesign);
    }
  });

  it('uma consulta nova sem briefing não reaproveita a cena antiga como se descrevesse essa imagem', () => {
    const input = make();
    input.generatedSlides[0].scene = null;
    input.generatedSlides[0].imageQuery = 'A shelf of finished bowls in the same workshop';
    const result = apply(input, true);
    expect(result.slides[0].imageQuery).toBe(input.generatedSlides[0].imageQuery);
    expect(result.slides[0].scene).toBeNull();
    expect(result.slides[0].socialPlan.scene).toBeNull();
    expect(result.socialPlan.cards[0].scene).toBeNull();
  });

  it('sem proposta de imagem válida conserva a consulta e a cena já aprovadas', () => {
    const input = make();
    input.generatedSlides[0].scene = null;
    input.generatedSlides[0].imageQuery = '';
    const result = apply(input, true);
    expect(result.slides[0].imageQuery).toBe(input.sourceSlides[0].imageQuery);
    expect(result.slides[0].socialPlan).toEqual(input.sourceSlides[0].socialPlan);
  });

  it('um card de catálogo ou estilo próprio sem metadados Livre não é convertido', () => {
    const input = make();
    input.sourceSlides[1] = { id: 'catalog', title: 'Original', subtitle: '', bodyAfterImage: '', imageQuery: 'Old still life', socialVisualPresetId: 'social_revista', visualPresetId: 'meu-estilo', canvas: { userEdited: true }, bgImageId: 'user-upload' };
    const merged = mergeRemixedSlides(input.sourceSlides, input.generatedSlides, true);
    const result = preserveSocialFreeRemix({ ...input, slides: merged, withImages: true });
    expect(result.slides[1]).toEqual(merged[1]);
    expect(result.slides[1].socialFreeDesign).toBeUndefined();
    expect(result.slides[1].socialPresetId).toBeUndefined();
    expect(result.slides[1].socialPlan).toBeUndefined();
  });

  it('recusa divergência de quantidade antes de associar uma cena ao card errado', () => {
    const input = make();
    expect(() => preserveSocialFreeRemix({ ...input, slides: input.sourceSlides.slice(0, 2), withImages: true })).toThrow(/quantidade/i);
  });
});
