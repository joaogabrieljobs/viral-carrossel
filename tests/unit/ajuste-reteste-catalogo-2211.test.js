// Ajustes sobre o catálogo final depois do reteste real de 22/11.
// 1) A regra que troca "garantir" por "reservar" tinha sido abrandada e o
//    modelo voltou a escrever "para garantir seu pão" (1 → 11 ocorrências).
// 2) A direção de arte curta do catálogo deixou as fotos claras, saturadas e
//    com cara de banco de imagem. Volta a direção sóbria, em tamanho que cabe
//    no limite do plano junto com ficha, família e âncora.
import { describe, expect, it } from 'vitest';
import * as g from '../../src/utils/generation-prompts.js';
import {
  PRESENTATION_PATHS, buildApresentacaoPackBlock, buildPresentationReviewRules, buildPresentationSummaryRules,
} from '../../src/utils/presentation.js';
import { GPT_IMAGE_ART_DIRECTION, planImagePrompt } from '../../src/utils/ai-client.js';
import { composeImageDirection } from '../../src/utils/image-direction.js';
import { planPersonAnchor } from '../../src/utils/visual-bible.js';
import { IMAGE_PROMPT_TEXT, SJINN_PROMPT_LIMIT } from '../../shared/image-prompt.js';

const REGRA = 'Não use garantir, garante, garantia nem garantido quando o material não usa essa palavra';
const VERBO = 'reserva';
const MODOS = ['none', 'editorial', 'how_to', 'storytelling', 'viral', 'pain', 'deep', 'jornalistico', 'sensacionalista'];

describe('ajuste do reteste — regra de "garantir"', () => {
  it.each(PRESENTATION_PATHS.map(route => route.id))('apresentação %s: pacote, revisão e resumo levam a regra', (pathId) => {
    const route = PRESENTATION_PATHS.find(item => item.id === pathId);
    for (const bloco of [buildApresentacaoPackBlock(route.defaultSlideCount, pathId), buildPresentationReviewRules(pathId), buildPresentationSummaryRules(pathId)]) {
      expect(bloco).toContain(REGRA);
      expect(bloco).toContain(VERBO);
    }
  });

  it.each(MODOS)('carrossel %s: as regras de texto dos cards levam a regra', (modo) => {
    const regras = g.buildGenerationSlideLayoutRules(modo, 'livre', '1_1', 6);
    expect(regras).toContain(REGRA);
    expect(regras).toContain(VERBO);
  });

  it.each(MODOS)('carrossel %s: a legenda leva a regra', (modo) => {
    expect(g.buildCaptionOutlineInstructions(modo, 'livre')).toContain(REGRA);
  });
});

describe('ajuste do reteste — direção de arte padrão', () => {
  it('pede foto sóbria, com um foco e sem pose de anúncio', () => {
    expect(GPT_IMAGE_ART_DIRECTION).toBe(IMAGE_PROMPT_TEXT.defaultArtDirection);
    expect(GPT_IMAGE_ART_DIRECTION.startsWith('DEFAULT ART DIRECTION: ')).toBe(true);
    for (const trecho of [
      'looks like a real photograph',
      'sober balanced colors, slightly desaturated muted tones',
      'moderate contrast',
      'subtle film grain',
      'one clear focal element, few objects',
      'no advertising smile',
      'evident AI aesthetic',
    ]) expect(GPT_IMAGE_ART_DIRECTION).toContain(trecho);
    expect(GPT_IMAGE_ART_DIRECTION.endsWith('Specific project, family and panel directions take priority over these defaults.')).toBe(true);
  });

  it('só fala de pessoas quando a cena pede pessoas', () => {
    expect(GPT_IMAGE_ART_DIRECTION).toContain('People, only when the scene calls for them');
  });

  it('cabe no plano com ficha visual, família e âncora, sem descartar nenhum bloco', () => {
    const ficha = { entities: [
      { id: 'marta', en: 'Adult woman baker, founder of a natural fermentation bakery in Salvador Brazil, working with bread dough.', never: '' },
      { id: 'bread', en: 'Three types of artisan bread loaves: rustic country bread, whole wheat bread, and brioche, golden crust, natural fermentation.', never: '' },
      { id: 'bakery', en: 'Small neighborhood bakery storefront in Rio Vermelho Salvador Brazil, warm morning light, wooden counter, flour-dusted surfaces.', never: '' },
    ] };
    const cena = 'woman baker handing paper bags with fresh bread to customers at the bakery counter';
    const anchorPlan = planPersonAnchor({ visualBible: ficha, imageQuery: cena, anchorUrl: 'data:image/png;base64,YQ==', refCount: 0 });
    const direction = composeImageDirection({
      visualBible: ficha, slide: { socialCompositionVersion: 4, socialFamily: 'revista' }, fmt: 'carrossel', anchorPlan, baseReferenceCount: 0,
    });
    const plano = planImagePrompt(cena, null, direction, { route: 'sjinn', model: 'gpt-image-2-api', aspectRatio: '4:5', referenceCount: anchorPlan.refImages.length });
    expect(plano.status).toBe('ready');
    expect(plano.defaultAesthetic).toBe(true);
    expect(plano.dropped).toEqual([]);
    expect(plano.prompt).toContain(GPT_IMAGE_ART_DIRECTION);
    expect(plano.chars).toBeLessThanOrEqual(SJINN_PROMPT_LIMIT);
  });
});
