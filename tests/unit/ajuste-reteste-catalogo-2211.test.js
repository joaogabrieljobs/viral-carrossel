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
import { planPersonAnchor, composeSubjectsDirection } from '../../src/utils/visual-bible.js';
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
  const CURTA = IMAGE_PROMPT_TEXT.defaultArtDirectionShort;
  const FICHA = { entities: [
    { id: 'marta', en: 'Adult woman baker, founder of a natural fermentation bakery in Salvador Brazil, working with bread dough.', never: '' },
    { id: 'bread', en: 'Three types of artisan bread loaves: rustic country bread, whole wheat bread, and brioche, golden crust, natural fermentation.', never: '' },
    { id: 'bakery', en: 'Small neighborhood bakery storefront in Rio Vermelho Salvador Brazil, warm morning light, wooden counter, flour-dusted surfaces.', never: '' },
  ] };
  const SLIDE = { socialCompositionVersion: 4, socialFamily: 'revista' };

  it('a versão longa traz as seções que seguravam o padrão do ar', () => {
    expect(GPT_IMAGE_ART_DIRECTION).toBe(IMAGE_PROMPT_TEXT.defaultArtDirection);
    expect(GPT_IMAGE_ART_DIRECTION.startsWith('DEFAULT ART DIRECTION (follow as far as it fits the scene; specific project, family and panel directions take priority):\n')).toBe(true);
    for (const trecho of [
      'GENERAL DIRECTION\nGenerate realistic, natural and sophisticated images that look like real photographs',
      'AESTHETIC\nRealistic, clean, contemporary, natural.',
      'Subtle film grain. Slightly desaturated muted tones.',
      'COMPOSITION\n',
      'one clear focal element, few objects',
      'PEOPLE (only when the scene calls for them)\nReal, natural, spontaneous',
      'no advertising smile',
      'VISUAL QUALITY\nPhotorealistic, shot like 35mm film photograph',
      'evident AI aesthetic',
      'low saturation, moderate contrast, clean composition',
    ]) expect(GPT_IMAGE_ART_DIRECTION).toContain(trecho);
    // A seção que mandava tratar o tema de forma indireta fica de fora: o catálogo pede a cena do material.
    expect(GPT_IMAGE_ART_DIRECTION).not.toContain('RELATION TO THEME');
    expect(GPT_IMAGE_ART_DIRECTION).not.toContain('carousel');
  });

  it('a versão curta existe para quando a longa não cabe', () => {
    expect(CURTA.startsWith('DEFAULT ART DIRECTION: ')).toBe(true);
    for (const trecho of ['looks like a real photograph', 'slightly desaturated muted tones', 'one clear focal element, few objects', 'People, only when the scene calls for them', 'no advertising smile', 'evident AI aesthetic']) expect(CURTA).toContain(trecho);
    expect(CURTA.length).toBeLessThan(GPT_IMAGE_ART_DIRECTION.length - 500);
  });

  it('ficha visual: a cena decide quais elementos aparecem', () => {
    const texto = composeSubjectsDirection(FICHA);
    const [cabecalho, ...linhas] = texto.split('\n');
    expect(cabecalho).toContain('PROJECT SUBJECTS — whenever one of these appears in the scene it must match this description exactly, and look the same in every image of this project.');
    expect(cabecalho).toContain('These descriptions fix appearance only (face, hair, clothing, color, material, shape).');
    expect(cabecalho).toContain('the SCENE decides action, pose, setting and which subjects appear. Do not add a subject the scene does not call for.');
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toMatch(/^- marta: /);
  });

  it('carrossel com ficha e família, sem âncora: a direção longa cabe inteira no plano', () => {
    const direction = composeImageDirection({ visualBible: FICHA, slide: SLIDE, fmt: 'carrossel' });
    const plano = planImagePrompt('three types of rustic bread loaves on wooden board dark crust golden crumb', null, direction, { route: 'sjinn', model: 'gpt-image-2-api', aspectRatio: '4:5', referenceCount: 0 });
    expect(plano.status).toBe('ready');
    expect(plano.dropped).toEqual([]);
    expect(plano.trimmed).toEqual([]);
    expect(plano.prompt).toContain(GPT_IMAGE_ART_DIRECTION);
    expect(plano.chars).toBeLessThanOrEqual(SJINN_PROMPT_LIMIT);
  });

  it('com âncora de identidade a direção longa não cabe: entra a curta, nunca um corte no meio', () => {
    const cena = 'woman baker handing paper bags with fresh bread to customers at the bakery counter';
    const anchorPlan = planPersonAnchor({ visualBible: FICHA, imageQuery: cena, anchorUrl: 'data:image/png;base64,YQ==', refCount: 0 });
    const direction = composeImageDirection({ visualBible: FICHA, slide: SLIDE, fmt: 'carrossel', anchorPlan, baseReferenceCount: 0 });
    const plano = planImagePrompt(cena, null, direction, { route: 'sjinn', model: 'gpt-image-2-api', aspectRatio: '4:5', referenceCount: anchorPlan.refImages.length });
    expect(plano.status).toBe('ready');
    expect(plano.defaultAesthetic).toBe(true);
    expect(plano.prompt).toContain(CURTA);
    expect(plano.prompt).not.toContain('GENERAL DIRECTION');
    expect(plano.trimmed).toContain('defaultArtDirection');
    expect(plano.dropped).not.toContain('defaultArtDirection');
    expect(plano.prompt).toContain('IDENTITY ANCHOR');
    expect(plano.prompt).toContain('PROJECT SUBJECTS');
    expect(plano.chars).toBeLessThanOrEqual(SJINN_PROMPT_LIMIT);
  });

  it('rota com limite largo (chave própria OpenAI) sempre leva a direção longa', () => {
    const cena = 'woman baker handing paper bags with fresh bread to customers at the bakery counter';
    const anchorPlan = planPersonAnchor({ visualBible: FICHA, imageQuery: cena, anchorUrl: 'data:image/png;base64,YQ==', refCount: 0 });
    const direction = composeImageDirection({ visualBible: FICHA, slide: SLIDE, fmt: 'carrossel', anchorPlan, baseReferenceCount: 0 });
    const plano = planImagePrompt(cena, null, direction, { route: 'openai', model: 'gpt-image-2', aspectRatio: '4:5', referenceCount: anchorPlan.refImages.length });
    expect(plano.prompt).toContain(GPT_IMAGE_ART_DIRECTION);
    expect(plano.trimmed).toEqual([]);
  });
});
