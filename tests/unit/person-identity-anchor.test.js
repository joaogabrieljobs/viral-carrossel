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
  it('o pedido de identidade é explícito, porque o prompt com referência proíbe copiar rostos por padrão', () => {
    expect(PERSON_IDENTITY_DIRECTION).toMatch(/explicitly requested/);
    expect(PERSON_IDENTITY_DIRECTION).toMatch(/same face, hair, skin tone/);
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

  it('cena sem palavra de pessoa recebe a âncora condicional', async () => {
    const { planPersonAnchor } = await import('../../src/utils/visual-bible.js');
    for (const q of ['small neighborhood bakery storefront morning light Salvador Brazil', 'small bakery team working together flour dusted aprons morning', 'customer picking up bread order from bakery counter warm tone']) {
      const plan = planPersonAnchor({ visualBible: t04, imageQuery: q, anchorUrl: anchor, refCount: 0 });
      expect(plan.refImages).toEqual([anchor]);
      expect(plan.direction).toMatch(/marta/);
      expect(plan.direction).toMatch(/If .*marta.* appears/i);
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
    expect(next.direction).toMatch(/same face, hair, skin tone/);
    expect(next.direction).toMatch(/marta/);
  });

  it('outras pessoas da cena não herdam o rosto', async () => {
    const { planPersonAnchor } = await import('../../src/utils/visual-bible.js');
    const plan = planPersonAnchor({ visualBible: t04, imageQuery: 'customer picking up bread order', anchorUrl: anchor, refCount: 0 });
    expect(plan.direction).toMatch(/other people .*different/i);
  });

  it('sem pessoa na ficha, sem âncora ou com 4 referências, nada muda', async () => {
    const { planPersonAnchor } = await import('../../src/utils/visual-bible.js');
    expect(planPersonAnchor({ visualBible: { entities: [t04.entities[0]] }, imageQuery: 'bread', anchorUrl: anchor, refCount: 0 })).toMatchObject({ refImages: [], direction: '', canBecomeAnchor: false });
    expect(planPersonAnchor({ visualBible: t04, imageQuery: 'storefront', anchorUrl: anchor, refCount: 4 })).toMatchObject({ refImages: [], direction: '' });
    expect(planPersonAnchor({ visualBible: t04, imageQuery: 'storefront', anchorUrl: null, refCount: 0 })).toMatchObject({ refImages: [], direction: '', canBecomeAnchor: false });
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
