import { describe, expect, it } from 'vitest';
import { visualBibleHasPerson, sceneShowsPerson, PERSON_IDENTITY_DIRECTION } from '../../src/utils/visual-bible.js';

// MF-03: cards 1 e 2 do B04 (Editorial Magazine) mostravam mulheres diferentes.
const bible = { entities: [
  { id: 'marta', en: 'Woman baker, founder of the bakery, flour-dusted apron in a small artisan bakery', never: '' },
  { id: 'sourdough', en: 'Artisan sourdough loaves with rustic golden crust on wooden boards', never: '' },
] };

describe('âncora de identidade da pessoa entre os cards', () => {
  it('reconhece ficha com pessoa e sem pessoa', () => {
    expect(visualBibleHasPerson(bible)).toBe(true);
    expect(visualBibleHasPerson({ entities: [bible.entities[1]] })).toBe(false);
    expect(visualBibleHasPerson(null)).toBe(false);
  });
  it('só cenas com a pessoa recebem a referência', () => {
    expect(sceneShowsPerson('woman baker kneading dough at dawn', bible)).toBe(true);
    expect(sceneShowsPerson('Marta smiling behind the counter', bible)).toBe(true);
    expect(sceneShowsPerson('three sourdough loaves on a wooden board', bible)).toBe(false);
    // Outra pessoa (cliente) não herda o rosto da padeira.
    expect(sceneShowsPerson('person holding smartphone with bread order chat', bible)).toBe(false);
  });
  it('o pedido de identidade é explícito: a âncora é o último anexo e vale só para a identidade', () => {
    expect(PERSON_IDENTITY_DIRECTION).toMatch(/^IDENTITY ANCHOR: The last attached image is the identity reference/);
    expect(PERSON_IDENTITY_DIRECTION).toMatch(/facial features, hair, skin tone and build/);
  });
});

// Reteste 21/11, T04 (bpal8vs): a ficha com a padeira vai em todo pedido de
// imagem, então o modelo a desenha também em "storefront", "team" e
// "customer at counter". A âncora só ia quando a cena citava "baker" (card 1);
// cards 2 e 6 saíram com outra padeira.
describe('âncora em todas as imagens do projeto com pessoa na ficha', () => {
  const t04 = { entities: [
    { id: 'sourdough-bread', en: 'Artisan sourdough bread loaves with golden crust, rustic round shape, dusted with flour, displayed on wooden shelves', never: '' },
    { id: 'marta', en: 'Female baker wearing flour-dusted apron, working with bread dough on wooden table in warm-lit bakery environment', never: '' },
  ] };
  const anchor = 'data:image/png;base64,AAAA';

  it('cena com outras pessoas, sem citar a padeira, recebe a âncora condicional', async () => {
    const { planPersonAnchor } = await import('../../src/utils/visual-bible.js');
    // Reteste 0b1cb62 (E04): cena sem pessoa nenhuma (fachada) não recebe mais
    // a âncora; ela fazia a padeira aparecer em toda foto.
    expect(planPersonAnchor({ visualBible: t04, imageQuery: 'small neighborhood bakery storefront morning light Salvador Brazil', anchorUrl: anchor, refCount: 0 }).refImages).toEqual([]);
    for (const q of ['small bakery team working together flour dusted aprons morning', 'customer picking up bread order from bakery counter warm tone']) {
      const plan = planPersonAnchor({ visualBible: t04, imageQuery: q, anchorUrl: anchor, refCount: 0 });
      expect(plan.refImages).toEqual([anchor]);
      expect(plan.direction).toMatch(/marta/);
      expect(plan.direction).toMatch(/Only if .*marta.* appears/i);
      expect(plan.direction).toMatch(/do not add/i);
    }
  });

  it('cena que cita a pessoa recebe o pedido direto e pode virar âncora', async () => {
    const { planPersonAnchor } = await import('../../src/utils/visual-bible.js');
    const first = planPersonAnchor({ visualBible: t04, imageQuery: 'artisan baker hands kneading sourdough dough', anchorUrl: null, refCount: 0 });
    expect(first.refImages).toEqual([]);
    expect(first.canBecomeAnchor).toBe(true);
    const next = planPersonAnchor({ visualBible: t04, imageQuery: 'Marta smiling behind the counter', anchorUrl: anchor, refCount: 1 });
    expect(next.refImages).toEqual([anchor]);
    expect(next.direction).toBe(PERSON_IDENTITY_DIRECTION);
    // O id da pessoa segue no mapa de referências (@marta = image N (identity)).
    expect(next.entityId).toBe('marta');
  });

  it('outras pessoas da cena não herdam o rosto', async () => {
    const { planPersonAnchor } = await import('../../src/utils/visual-bible.js');
    const plan = planPersonAnchor({ visualBible: t04, imageQuery: 'customer picking up bread order', anchorUrl: anchor, refCount: 0 });
    expect(plan.direction).toMatch(/other people .*different/i);
  });

  it('sem pessoa na ficha, sem âncora ou com 4 referências, nada muda', async () => {
    const { planPersonAnchor } = await import('../../src/utils/visual-bible.js');
    expect(planPersonAnchor({ visualBible: { entities: [t04.entities[0]] }, imageQuery: 'bread', anchorUrl: anchor, refCount: 0 })).toMatchObject({ refImages: [], direction: '', canBecomeAnchor: false });
    expect(planPersonAnchor({ visualBible: t04, imageQuery: 'bakery team at work', anchorUrl: anchor, refCount: 4 })).toMatchObject({ refImages: [], direction: '' });
    expect(planPersonAnchor({ visualBible: t04, imageQuery: 'bakery team at work', anchorUrl: null, refCount: 0 })).toMatchObject({ refImages: [], direction: '', canBecomeAnchor: false });
  });
});

describe('âncora ao refazer uma imagem só', () => {
  const t04 = { entities: [{ id: 'marta', en: 'Female baker wearing flour-dusted apron, working with bread dough on wooden table', never: '' }] };
  const slides = [
    { id: 'a', imageQuery: 'bakery storefront morning', bgImageId: 'img-a' },
    { id: 'b', imageQuery: 'artisan baker hands kneading dough', bgImageId: 'img-b' },
    { id: 'c', imageQuery: 'baker smiling at counter', bgImageId: null },
    { id: 'd', imageQuery: 'customer picking up bread', bgImageId: 'img-d' },
  ];
  it('usa a primeira foto existente de cena que cita a pessoa, sem ser o próprio card', async () => {
    const { pickPersonAnchorSlide } = await import('../../src/utils/visual-bible.js');
    expect(pickPersonAnchorSlide(slides, t04, 'd')?.id).toBe('b');
    expect(pickPersonAnchorSlide(slides, t04, 'b')).toBe(null);
    expect(pickPersonAnchorSlide(slides, { entities: [{ id: 'bread', en: 'Artisan sourdough loaves with rustic golden crust on boards', never: '' }] }, 'd')).toBe(null);
  });
});

// Reteste 0b1cb62 (E04, jvq0rbj): a ficha da padeira trazia ação e lugar
// ("kneading dough on floured wooden table") e seguia em todo pedido com a
// âncora. As 6 fotos repetiram a mesma cena; o card 3, "Três pães saem do
// forno" ("three types of rustic bread loaves on dark wooden bakery counter"),
// mostrou massa crua.
describe('âncora fixa só a identidade, não a cena', () => {
  const e04 = { entities: [
    { id: 'marta', en: 'woman baker wearing apron, kneading dough on floured wooden table in small artisan bakery', never: '' },
    { id: 'bread-loaves', en: 'rustic sourdough bread loaves, golden crust, round and oval shapes, resting on wooden proofing baskets', never: '' },
  ] };
  const anchor = 'data:image/png;base64,AAAA';

  it('cena sem pessoa não recebe âncora e tira a pessoa da ficha', async () => {
    const { planPersonAnchor, composeSceneDirection } = await import('../../src/utils/visual-bible.js');
    for (const q of ['three types of rustic bread loaves on dark wooden bakery counter', 'small bakery storefront morning light open sign wooden door']) {
      const plan = planPersonAnchor({ visualBible: e04, imageQuery: q, anchorUrl: anchor, refCount: 0 });
      expect(plan.refImages).toEqual([]);
      expect(plan.excludeEntityIds).toEqual(['marta']);
      const scene = composeSceneDirection({ visualBible: e04, slide: {}, excludeEntityIds: plan.excludeEntityIds });
      expect(scene).not.toMatch(/kneading|marta/);
      expect(scene).toMatch(/bread-loaves/);
    }
  });

  it('cena com outras pessoas recebe a âncora condicional', async () => {
    const { planPersonAnchor } = await import('../../src/utils/visual-bible.js');
    const plan = planPersonAnchor({ visualBible: e04, imageQuery: 'bakery staff handing bread loaf to customer across counter', anchorUrl: anchor, refCount: 0 });
    expect(plan.refImages).toEqual([anchor]);
    expect(plan.direction).toMatch(/Only if "marta" appears/);
    expect(plan.excludeEntityIds).toEqual([]);
  });

  it('a ficha vale só para a aparência; ação, pose e lugar vêm da cena do card', async () => {
    const { composeSubjectsDirection, PERSON_IDENTITY_DIRECTION, buildVisualBiblePromptRules } = await import('../../src/utils/visual-bible.js');
    expect(composeSubjectsDirection(e04)).toMatch(/These descriptions fix appearance only[^\n]*the SCENE decides action, pose, setting and which subjects appear\./);
    expect(composeSubjectsDirection(e04)).toMatch(/Do not add a subject the scene does not call for/);
    expect(PERSON_IDENTITY_DIRECTION).toMatch(/Use only the requested scene for action, pose, framing, setting and objects/);
    expect(PERSON_IDENTITY_DIRECTION).toMatch(/Match neither the background nor the pose of the anchor/);
    expect(buildVisualBiblePromptRules()).toMatch(/A ação, o lugar momentâneo, a pose e o enquadramento pertencem à imageQuery/);
  });
});
