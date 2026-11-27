import { describe, expect, it, vi } from 'vitest';
import { generateReviewedCarousel } from '../../src/utils/editorial-review.js';

// Caso Apoteose (27/11): o material não traz chamada para ação; o fecho Livre
// termina na assinatura. Isso é estilo, não erro de fato nem de tamanho, e não
// pode segurar as imagens (needs_attention).
const signature = 'Como se o Carnaval não fosse suficiente.';
const texts = [
  ['A festa antes da festa', 'Um esquenta com identidade própria.'],
  ['Brasileira e sofisticada', 'Irreverência e sensualidade sem depender de tendência.'],
  ['Comportamento urbano', 'A atmosfera das festas mais desejadas da cidade.'],
  ['O esquenta mais badalado', 'Expectativa antes mesmo de acontecer.'],
];
const makeDraft = () => ({
  signature, caption: 'Apoteose, o esquenta de Carnaval.',
  slides: texts.map(([title, subtitle], index) => ({
    title, subtitle, bodyAfterImage: index === 0 || index === 3 ? signature : '', imageQuery: `query ${index}`,
    scene: { subject: `Party scene ${index}`, setting: 'Urban rooftop', light: 'Warm dusk', graphics: 'none', shot: 'wide' },
    avoid: ['Lettering'], eyebrow: '',
    design: { family: 'editorial', ground: 'photo', photo: 'full', block: 'none', emphasis: [], icons: [] },
  })),
});
const source = [...texts.flat(), signature].join('\n');
const config = { count: 4, presetId: 'livre', densityId: '1_1', narrativeMode: 'storytelling', factualSource: source };

describe('Livre social: fecho sem chamada para ação', () => {
  it('sem CTA no material, o reparo é tentado e o carrossel não vira rascunho; o aviso vai para o editor', async () => {
    const ai = vi.fn()
      .mockResolvedValueOnce(makeDraft())
      .mockResolvedValueOnce({ edits: [] })
      .mockResolvedValueOnce({ edits: [] });
    const output = await generateReviewedCarousel({ prompt: source, config, socialFree: { formato: 'carrossel' } }, ai);
    expect(ai).toHaveBeenCalledTimes(3);
    expect(ai.mock.calls[2][0]).toContain('social_free_closing_cta');
    expect(output.reviewStatus).not.toBe('needs_attention');
    expect(output.violations || []).not.toContainEqual(expect.objectContaining({ code: 'social_free_closing_cta' }));
    expect(output.closingCtaNotice).toMatch(/chamada para ação/);
  });

  it('fecho com ação não gera aviso', async () => {
    const draft = makeDraft();
    draft.slides[3].subtitle = 'Garanta seu lugar no esquenta.';
    const ai = vi.fn().mockResolvedValueOnce(draft).mockResolvedValueOnce({ edits: [] });
    const output = await generateReviewedCarousel({ prompt: `${source}\nGaranta seu lugar no esquenta.`, config: { ...config, factualSource: `${source}\nGaranta seu lugar no esquenta.` }, socialFree: { formato: 'carrossel' } }, ai);
    expect(output.reviewStatus).not.toBe('needs_attention');
    expect(output.closingCtaNotice).toBeUndefined();
  });

  it('erro de fato continua segurando as imagens', async () => {
    const draft = makeDraft();
    draft.slides[2].subtitle = 'Mais de 5.000 pessoas por noite desde 2019.';
    const ai = vi.fn().mockResolvedValueOnce(draft).mockResolvedValue({ edits: [] });
    const output = await generateReviewedCarousel({ prompt: source, config, socialFree: { formato: 'carrossel' } }, ai);
    expect(output.reviewStatus).toBe('needs_attention');
    expect(output.violations).toContainEqual(expect.objectContaining({ kind: 'factual' }));
  });
});
