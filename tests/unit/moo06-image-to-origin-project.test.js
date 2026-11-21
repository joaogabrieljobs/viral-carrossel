import { describe, expect, it } from 'vitest';
import { applySlideImageToStoredProject } from '../../src/utils/image-store.js';

// MOO-06: a imagem paga voltava depois que a pessoa trocou de projeto e era
// apagada. Ela vai para o card de origem no projeto de origem, se a foto desse
// card não mudou durante a geração.
describe('MOO-06 — imagem gerada volta ao projeto de origem', () => {
  const library = [
    { id: 'p1', doc: { slides: [{ id: 's1', bgImageId: null }, { id: 's2', bgImageId: 'old' }] } },
    { id: 'p2', doc: { slides: [{ id: 's1' }] } },
  ];
  const patch = { bgImageId: 'novo', bgImageSource: 'ai' };

  it('aplica no card de origem e mantém o resto', () => {
    const { library: next, applied } = applySlideImageToStoredProject(library, 'p1', { id: 's1', expectedImageIdentity: 'none', patch });
    expect(applied).toBe(true);
    expect(next[0].doc.slides[0]).toMatchObject({ id: 's1', bgImageId: 'novo', bgImageSource: 'ai' });
    expect(next[0].doc.slides[1]).toBe(library[0].doc.slides[1]);
    expect(next[1]).toBe(library[1]);
  });

  it('não aplica se a foto do card mudou, se o card ou o projeto sumiram', () => {
    for (const [projectId, id, expectedImageIdentity] of [['p1', 's2', 'none'], ['p1', 'sX', 'none'], ['p9', 's1', 'none']]) {
      const result = applySlideImageToStoredProject(library, projectId, { id, expectedImageIdentity, patch });
      expect(result.applied).toBe(false);
      expect(result.library).toBe(library);
    }
  });
});
