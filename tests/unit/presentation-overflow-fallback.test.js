import { describe, expect, it } from 'vitest';
import { overflowFallbackPatches } from '../../src/utils/presentation-render-review.js';

// Lote B (21/11): capas do C07 Palestra e do C06 Caso barravam o PDF; o reparo
// por IA não respondeu. O passo final move texto para as notas, sem apagar.
const cover = { id: 'c07', title: 'Pão de 36 horas, a um dia da sua mesa',
  subtitle: 'Fermento Lento: fermentação natural feita no Rio Vermelho. Encomendada pelo WhatsApp.',
  bodyAfterImage: 'Rio Vermelho, Salvador', caption: 'Nota original.' };
const overflow = [{ code: 'render-overflow', slideId: 'c07', severity: 'error' }];

describe('passo final quando o slide renderizado não cabe', () => {
  it('primeiro move a linha de apoio para as notas', () => {
    const [p] = overflowFallbackPatches([cover], overflow, 0);
    expect(p.patch).toEqual({ bodyAfterImage: '', caption: 'Rio Vermelho, Salvador\n\nNota original.' });
    expect(p.before).toEqual({ bodyAfterImage: 'Rio Vermelho, Salvador', caption: 'Nota original.' });
  });
  it('depois move a última frase do subtítulo, sem tocar no título', () => {
    const [p] = overflowFallbackPatches([{ ...cover, bodyAfterImage: '' }], overflow, 1);
    expect(p.patch.subtitle).toBe('Fermento Lento: fermentação natural feita no Rio Vermelho.');
    expect(p.patch.caption).toBe('Encomendada pelo WhatsApp.\n\nNota original.');
    expect(p.patch.title).toBeUndefined();
  });
  it('não mexe em slide sem excesso nem em subtítulo de frase única', () => {
    expect(overflowFallbackPatches([cover], [], 0)).toEqual([]);
    expect(overflowFallbackPatches([{ ...cover, bodyAfterImage: '', subtitle: 'Uma frase só.' }], overflow, 1)).toEqual([]);
  });
});
