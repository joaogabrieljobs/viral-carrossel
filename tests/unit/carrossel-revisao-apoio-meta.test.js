// Etapa 2, melhoria 12 do plano do carrossel (26/11/2026): as duas regras do
// caminho planejado da apresentação (Teste 4 da Apoteose) também no carrossel
// (reviewSocialDraft):
// - linha de apoio (bodyAfterImage) com 80% ou mais das palavras de conteúdo
//   dentro do parágrafo (subtitle) do mesmo card fica vazia, sem IA;
// - título que dá como fato o que o apoio do mesmo card chama de intenção vai
//   ao reparo, uma chamada dirigida; se o reparo falha, o card fica como estava.
import { describe, expect, it, vi } from 'vitest';
import { generateReviewedCarousel } from '../../src/utils/editorial-review.js';

const SOURCE = 'A Apoteose pretende se consolidar como o esquenta mais badalado de São Paulo. A festa reúne música ao vivo e se mantém atual sem depender de tendências. A pista abre às 22h na Barra Funda. O ingresso sai no site oficial, com lote promocional até sexta.';
const config = (extra = {}) => ({ count: 4, presetId: 'livre', densityId: '1_1', factualSource: SOURCE, ...extra });
const slide = (title, subtitle, bodyAfterImage = '') => ({ title, subtitle, bodyAfterImage, imageQuery: '' });
const draft = (overrides = {}) => ({
  caption: 'Legenda.',
  slides: [
    slide('Apoteose', 'O esquenta de São Paulo.'),
    overrides.goal || slide('A pista abre às 22h', 'A pista abre às 22h na Barra Funda.'),
    // Linha de apoio só existe do terceiro card em diante (densidade 1/1).
    slide('Música ao vivo', 'A festa reúne música ao vivo e se mantém atual sem depender de tendências.', 'Atual sem depender de tendências'),
    slide('Ingresso no site', 'O ingresso sai no site oficial, com lote promocional até sexta.'),
  ],
});
const META = slide('O esquenta mais badalado de São Paulo', 'A Apoteose pretende se consolidar como o esquenta mais badalado de São Paulo.');
const promptWith = (ai, marker) => ai.mock.calls.map((call) => call[0]).find((prompt) => prompt.includes(marker)) || '';

describe('carrossel: apoio que repete o parágrafo fica vazio, sem IA', () => {
  it('com a revisão sem edições, o apoio-eco sai e o resto do card fica', async () => {
    const ai = vi.fn().mockResolvedValueOnce(draft()).mockResolvedValue({ edits: [] });
    const out = await generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(out.result.slides[2].bodyAfterImage).toBe('');
    expect(out.result.slides[2].subtitle).toMatch(/sem depender de tendências/);
    expect(out.result.slides[2].title).toBe('Música ao vivo');
    // Nenhuma chamada a mais por causa do apoio.
    expect(ai).toHaveBeenCalledTimes(2);
    expect(out.reviewStatus).toBe('revised');
  });

  it('também quando a revisão não responde (rascunho segue sem revisão)', async () => {
    const ai = vi.fn().mockResolvedValueOnce(draft()).mockRejectedValue(new Error('fora do ar'));
    const out = await generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(out.result.slides[2].bodyAfterImage).toBe('');
  });

  it('apoio que acrescenta informação fica', async () => {
    const base = draft();
    base.slides[2] = slide('Música ao vivo', 'A festa reúne música ao vivo.', 'Atual sem depender de tendências.');
    const ai = vi.fn().mockResolvedValueOnce(base).mockResolvedValue({ edits: [] });
    const out = await generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(out.result.slides[2].bodyAfterImage).toBe('Atual sem depender de tendências.');
  });
});

describe('carrossel: título que dá a meta como fato vai ao reparo', () => {
  const fix = { edits: [{ slideIndex: 1, reason: 'O título afirma como fato uma intenção do material.', title: 'A meta: o esquenta mais badalado' }] };

  it('o reparo dirigido recebe só o card e a instrução; o título corrigido entra', async () => {
    const ai = vi.fn(async (prompt) => {
      if (prompt.includes('REPARO DE FATOS')) return fix;
      return { edits: [] };
    });
    ai.mockResolvedValueOnce(draft({ goal: META }));
    const out = await generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    const repair = promptWith(ai, 'REPARO DE FATOS');
    expect(repair).toMatch(/slideIndex 1\b/);
    expect(repair).not.toMatch(/slideIndex 0\b|slideIndex 2\b|slideIndex 3\b/);
    expect(repair).toMatch(/intenção/);
    expect(repair).toContain('O esquenta mais badalado de São Paulo');
    expect(out.result.slides[1].title).toBe('A meta: o esquenta mais badalado');
    expect(out.reviewStatus).toBe('repaired');
  });

  it('reparo fora do ar: o card fica como estava, sem virar rascunho preservado', async () => {
    const ai = vi.fn(async (prompt) => {
      if (prompt.includes('REPARO DE FATOS')) throw new Error('fora do ar');
      return { edits: [] };
    });
    ai.mockResolvedValueOnce(draft({ goal: META }));
    const out = await generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(out.result.slides[1].title).toBe(META.title);
    expect(out.reviewStatus).not.toBe('needs_attention');
  });

  it('reparo que mexe em outro card é recusado', async () => {
    const ai = vi.fn(async (prompt) => {
      if (prompt.includes('REPARO DE FATOS')) return { edits: [{ slideIndex: 0, reason: 'x', title: 'Outro' }] };
      return { edits: [] };
    });
    ai.mockResolvedValueOnce(draft({ goal: META }));
    const out = await generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(out.result.slides[0].title).toBe('Apoteose');
    expect(out.result.slides[1].title).toBe(META.title);
  });

  it('sem meta como fato, nenhuma chamada de reparo', async () => {
    const ai = vi.fn().mockResolvedValueOnce(draft()).mockResolvedValue({ edits: [] });
    await generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(promptWith(ai, 'REPARO DE FATOS')).toBe('');
  });
});
