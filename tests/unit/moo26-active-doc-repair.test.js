import { describe, expect, it } from 'vitest';
import { repairedActiveDocId } from '../../src/utils/library-helpers.js';

// MOO-26 (causa provável do MF-14): `activeEntry` caía em silêncio em
// library[0] quando o id ativo não existia na lista; nome e barra lateral
// mostravam um projeto, o editor outro, e o autosave não gravava em lugar nenhum.
describe('MOO-26 — projeto ativo inexistente na lista é corrigido de verdade', () => {
  const library = [{ id: 'a' }, { id: 'b' }];
  it('id que não está na lista vira o primeiro projeto', () => {
    expect(repairedActiveDocId('sumiu', library)).toBe('a');
  });
  it('não mexe quando o id existe, quando não há id ou quando a lista está vazia', () => {
    expect(repairedActiveDocId('b', library)).toBe(null);
    expect(repairedActiveDocId(null, library)).toBe(null);
    expect(repairedActiveDocId('sumiu', [])).toBe(null);
  });
});
