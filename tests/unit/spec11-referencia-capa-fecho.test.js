import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { attachPresentationPlan } from '../../src/utils/presentation-plan.js';
import { composeImageDirection, presentationStyleKitForSlide, presentationStyleReferenceAllowed } from '../../src/utils/image-direction.js';
import { buildImagePrompt, IMAGE_PROMPT_TEXT } from '../../shared/image-prompt.js';
import { resolveImageReferences } from '../../src/utils/style-kit-storage.js';

// Spec 1.1, referência (decisão do João, 25/11). Na Apoteose o kit tinha uma
// imagem de referência sem papel declarado; ela ia como moodboard em todos os
// pedidos e a mesma mulher de máscara saiu em 7 de 10 slides. Na apresentação
// ela passa a ir só na capa e no fecho; nos outros slides o pedido leva o
// estilo escrito e a família, e o assunto vem da cena do slide.
const apoteose = JSON.parse(readFileSync(new URL('../fixtures/apoteose.json', import.meta.url), 'utf8'));
const slides = attachPresentationPlan({ slides: apoteose.slides.map(({ presentationComposition, ...slide }) => slide) }, structuredClone(apoteose.presentationPlan)).slides;
const kit = { ...apoteose.styleKit, refImages: [{ id: 'img_ref', name: 'referencia.jpeg', dataUrl: 'data:image/png;base64,AAAA' }] };
const promptFor = (deck, index, styleKit = kit) => {
  const slideKit = presentationStyleKitForSlide(styleKit, deck, index);
  const direction = composeImageDirection({ styleKit: slideKit, slide: deck[index], fmt: 'apresentacao', baseReferenceCount: slideKit.refImages.length, presentationPanel: true, presentationFamily: 'presentation_cinematic' });
  return { refs: slideKit.refImages.length, direction, prompt: buildImagePrompt({ scene: deck[index].imageQuery, ...direction }, { route: 'sjinn' }).prompt };
};

describe('Spec 1.1 referência: Apoteose, referência sem papel só na capa e no fecho', () => {
  it('slides 2 a 9 não anexam a referência; capa e fecho anexam', () => {
    const result = slides.map((_, index) => promptFor(slides, index));
    expect(result.map(item => item.refs)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(result.map(item => item.direction.referenceCount)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(result.map(item => item.prompt.includes(IMAGE_PROMPT_TEXT.referenceRoles))).toEqual([true, false, false, false, false, false, false, false, false, true]);
  });

  it('nos slides do meio o pedido leva o estilo escrito, a família e a cena do slide', () => {
    const { prompt } = promptFor(slides, 3);
    expect(prompt).toContain(`SCENE: ${slides[3].imageQuery}`);
    expect(prompt).toContain('PROJECT OR SLIDE STYLE:');
    expect(prompt).toContain(apoteose.styleKit.stylePrompt);
    expect(prompt).toContain('VISUAL TREATMENT: Use cinematic depth');
    expect(prompt).not.toContain('REFERENCE ROLES');
  });

  it('os anexos resolvidos seguem a mesma regra', async () => {
    expect(await resolveImageReferences(presentationStyleKitForSlide(kit, slides, 0))).toEqual(['data:image/png;base64,AAAA']);
    expect(await resolveImageReferences(presentationStyleKitForSlide(kit, slides, 4))).toEqual([]);
    expect(await resolveImageReferences(presentationStyleKitForSlide(kit, slides, 9))).toEqual(['data:image/png;base64,AAAA']);
  });
});

describe('Spec 1.1 referência: o que não muda', () => {
  it('referência com @rótulo no kit tem papel declarado e vai em todos os slides', () => {
    const labeled = { ...kit, refImages: [...kit.refImages, { id: 'marta', name: 'marta.jpg', mention: 'marta', dataUrl: 'data:image/png;base64,BBBB' }] };
    expect(presentationStyleKitForSlide(labeled, slides, 4).refImages.map(ref => ref.id)).toEqual(['marta']);
    expect(presentationStyleKitForSlide(labeled, slides, 0).refImages.map(ref => ref.id)).toEqual(['img_ref', 'marta']);
  });

  it('referência do próprio slide continua indo', async () => {
    const slideRefs = [{ id: 'r1', mention: 'produto', dataUrl: 'data:image/png;base64,CCCC' }];
    expect(await resolveImageReferences(presentationStyleKitForSlide(kit, slides, 4), null, null, slideRefs)).toEqual(['data:image/png;base64,CCCC']);
  });

  it('a geração e o "Regenerar imagem" da apresentação usam a mesma regra; o carrossel não passa por ela', () => {
    const source = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
    expect(source.match(/presentationStyleKitForSlide\(/g)).toHaveLength(2);
    expect(source).toContain("const imageKit = fmt === 'apresentacao'\n        ? presentationStyleKitForSlide(styleKit, liveSlides, liveSlides.findIndex((slide) => slide.id === slideId))\n        : styleKit;");
    expect(source).toContain('const imageKit = isPresentationGeneration ? presentationStyleKitForSlide(styleKit, newSlides, i) : styleKit;');
    expect(source.match(/resolveImageReferences\(imageKit,/g)).toHaveLength(2);
    expect(source.match(/styleKit: imageKit,/g)).toHaveLength(2);
  });
});

describe('Spec 1.1 referência: deck sem capa ou sem fecho', () => {
  it('deck sem roteiro (etapas sem papel cover/closing) usa a primeira e a última posição', () => {
    const deck = ['context', 'diagram', 'summary', 'decision'].map(role => ({ presentationVisualRole: role }));
    expect(deck.map((_, index) => presentationStyleReferenceAllowed(deck, index))).toEqual([true, false, false, true]);
  });

  it('só falta o fecho: a capa vale pelo papel e a última posição entra no lugar do fecho', () => {
    const deck = ['cover', 'content', 'content'].map(role => ({ presentationVisualRole: role }));
    expect(deck.map((_, index) => presentationStyleReferenceAllowed(deck, index))).toEqual([true, false, true]);
  });

  it('o papel do roteiro manda sobre a posição', () => {
    const deck = [{ presentationPlan: { visualRole: 'content' } }, { presentationPlan: { visualRole: 'cover' } }, { presentationPlan: { visualRole: 'closing' } }, { presentationPlan: { visualRole: 'content' } }];
    expect(deck.map((_, index) => presentationStyleReferenceAllowed(deck, index))).toEqual([false, true, true, false]);
  });
});
