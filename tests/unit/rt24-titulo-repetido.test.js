import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { generateReviewedCarousel, repeatedTitleIndexes } from '../../src/utils/editorial-review.js';

// Reteste real de 24/11 (RT24 texto 2), e6085f3: o carrossel "Ensinar passo a
// passo" abriu como rascunho com "Card 6: o título repete o de outro card".
// O card 6 é "Send us your link"; a regra o comparou com o card 2, "Step 1 ·
// Send your link or fill the brief": três palavras em comum (send, your, link)
// divididas pelo título MENOR davam 100%. Título curto contido num título
// longo não é o mesmo título; a conta passa a usar a média dos dois tamanhos
// (60%). No corpus de 85 textos, 10 das 51 marcações caem, todas de título
// contido em outro; os pares quase iguais continuam marcados.
const { brief, projects } = JSON.parse(readFileSync(new URL('../fixtures/rt24-projetos.json', import.meta.url), 'utf8'));
const project = name => projects.find(item => item.name === name);
const titles = (...list) => list.map(title => ({ title }));

describe('RT24 texto 2: título curto contido em título longo não é repetição', () => {
  it('Ensinar real: nenhum título repetido', () => {
    const slides = project('C1 Ensinar').slides;
    expect([slides[1].title, slides[5].title]).toEqual(['Step 1 · Send your link or fill the brief', 'Send us your link']);
    expect(repeatedTitleIndexes(slides)).toEqual([]);
  });

  it.each([
    ['If you don\'t like the site, you don\'t pay', 'You see the new site before you pay anything'],
    ['Peça seu pão pelo WhatsApp', 'Pão de 36 horas, três opções e encomenda pelo WhatsApp'],
    ['A oferta inclui uma landing page', 'Uma landing page, com segunda língua grátis'],
  ])('par real que não é o mesmo título: %s × %s', (a, b) => {
    expect(repeatedTitleIndexes(titles(b, a))).toEqual([]);
  });

  it.each([
    ['Peça seu pão pelo WhatsApp', 'Encomende pão pelo WhatsApp'],
    ['Modelos para três tipos de negócio', 'Modelos prontos para três negócios'],
    ['41.200 pães vendidos em 2025', '41.200 pães vendidos em 2025'],
    ['Tempo é ingrediente, não detalhe', 'Tempo é ingrediente, não detalhe'],
    ['Três pães, preços definidos, retirada na padaria', 'Três pães, preços definidos, pedido pelo WhatsApp'],
  ])('par real que continua repetido: %s × %s', (a, b) => {
    expect(repeatedTitleIndexes(titles(b, a))).toEqual([1]);
  });

  it('a geração do Ensinar real não vira rascunho por título repetido', async () => {
    const draft = { caption: 'Legenda.', slides: project('C1 Ensinar').slides.map(slide => ({ ...slide, imageQuery: '' })) };
    const ai = vi.fn().mockResolvedValueOnce(draft).mockResolvedValue({ edits: [] });
    const output = await generateReviewedCarousel({ prompt: 'Material.', config: { count: 6, presetId: 'livre', densityId: '1_1', narrativeMode: 'how_to', factualSource: brief } }, ai);
    expect((output.violations || []).filter(item => item.kind === 'repeated_title')).toEqual([]);
    expect(output.reviewStatus).toBe('unchanged');
    expect(ai).toHaveBeenCalledTimes(2);
  });
});
