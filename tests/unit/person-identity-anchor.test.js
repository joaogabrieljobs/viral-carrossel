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
