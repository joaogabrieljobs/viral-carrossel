import { describe, expect, it, vi } from 'vitest';
import { generateReviewedCarousel } from '../../src/utils/editorial-review.js';
import { NARRATIVE_CHOICES } from '../../src/utils/create-project-flow.js';

describe('saída estruturada dos modos sociais', () => {
  it.each(NARRATIVE_CHOICES.map(choice => choice.id))('reserva a saída para o JSON, sem raciocínio oculto: %s', async narrativeMode => {
    const ai = vi.fn().mockResolvedValueOnce({ slides: [{ title: 'Uma ideia', subtitle: 'Uma explicação.', imageQuery: '' }], caption: '' }).mockResolvedValueOnce({ edits: [] });
    await generateReviewedCarousel({ prompt: 'Uma ideia.', config: { count: 1, presetId: 'livre', densityId: '1_2', narrativeMode }, aiOptions: { maxTokens: 5632 } }, ai);
    expect(ai).toHaveBeenCalledTimes(2);
    for (const [, options] of ai.mock.calls) expect(options).toMatchObject({ thinking: 'disabled', maxTokens: 5632, json: true });
  });
});
