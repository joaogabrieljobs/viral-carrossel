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

// 3) Com briefing que só traz dados de oferta, os modos saíam como a mesma
//    lista de fatos (reteste de 22/11: "história", "dor" e "atenção" abriam com
//    os mesmos três títulos). Cada modo ganha um ângulo próprio de entrada e de
//    título, usando só os fatos do material.
import { buildNarrativeModeSequence, buildNarrativeModeAngle, NARRATIVE_SEQUENCES } from '../../src/utils/narrative-sequence.js';

describe('ajuste do reteste — ângulo de cada modo de carrossel', () => {
  const COM_ROTEIRO = Object.keys(NARRATIVE_SEQUENCES);

  it.each(COM_ROTEIRO)('%s: o roteiro termina com o ângulo do modo', (modo) => {
    const angulo = buildNarrativeModeAngle(modo);
    expect(angulo.startsWith('ÂNGULO DESTE MODO — os fatos são os mesmos em qualquer modo; muda por onde o texto entra, a ordem e a voz dos títulos. Nenhum fato, cena, sensação ou causa nova:\n- Entrada: ')).toBe(true);
    expect(angulo).toContain('\n- Títulos: ');
    for (const n of [4, 6, 9]) expect(buildNarrativeModeSequence(modo, 'livre', n).endsWith(`\n${angulo}`)).toBe(true);
  });

  it('os ângulos são diferentes entre si', () => {
    const angulos = COM_ROTEIRO.map(modo => buildNarrativeModeAngle(modo));
    expect(new Set(angulos).size).toBe(COM_ROTEIRO.length);
  });

  it('história: ordem de tempo, título com sujeito e verbo, dado no apoio', () => {
    const angulo = buildNarrativeModeAngle('storytelling');
    expect(angulo).toContain('em ordem de tempo');
    expect(angulo).toContain('sujeito + verbo');
    expect(angulo).toContain('Preço, horário e quantidade ficam no apoio');
  });

  it('dor: começa do lado do leitor, em segunda pessoa, sem presumir sentimento; a oferta vem depois', () => {
    const angulo = buildNarrativeModeAngle('pain');
    expect(angulo).toContain('segunda pessoa');
    expect(angulo).toContain('sem afirmar sentimento, hábito ou problema que não foi informado');
    expect(angulo).toContain('a oferta entra só');
  });

  it('atenção: capa é pergunta ou contraste feito de um fato real', () => {
    const angulo = buildNarrativeModeAngle('viral');
    expect(angulo).toContain('uma pergunta ou um contraste montado com um fato real e específico do material');
  });

  it('só "Informar com clareza" pode abrir pelo nome do negócio', () => {
    const marca = 'A capa não abre com o nome da marca seguido da descrição do negócio';
    for (const modo of COM_ROTEIRO) {
      if (modo === 'jornalistico') expect(buildNarrativeModeAngle(modo)).not.toContain(marca);
      else expect(buildNarrativeModeAngle(modo)).toContain(marca);
    }
  });

  it('sem modo, pacote próprio ou poucos cards: nada de ângulo', () => {
    expect(buildNarrativeModeAngle('none')).toBe('');
    expect(buildNarrativeModeSequence('none', 'livre', 6)).toBe('');
    expect(buildNarrativeModeSequence('pain', 'apresentacao', 8)).toBe('');
  });
});

// 4) Rodada 3 de imagem (22/11): com moodboard preto e branco o código novo
//    devolveu fotos claras e quentes (no ar saíam escuras e contrastadas), e em
//    deck sem ficha visual o gerador pôs uma pessoa numa fachada sem pessoa.
import { buildImagePrompt } from '../../shared/image-prompt.js';

describe('ajuste do reteste — moodboard e pessoa fora da cena', () => {
  const GUARDA = 'Do not add people the scene does not call for.';
  const base = { scene: 'bakery storefront in the morning', format: 'carousel', framing: 'FRAMING: x.', familyEnglish: 'Use warm window light, soft shadows and subtle grain.' };

  it('as regras fixas proíbem pessoa que a cena não pede, com ou sem ficha visual', () => {
    expect(IMAGE_PROMPT_TEXT.hardRules).toContain(GUARDA);
    expect(buildImagePrompt(base, { route: 'sjinn' }).prompt).toContain(GUARDA);
    const painel = buildImagePrompt({ ...base, format: 'presentation', presentationPanel: true }, { route: 'sjinn' });
    expect(painel.prompt).toContain(GUARDA);
    expect(painel.prompt).not.toContain('PROJECT SUBJECTS');
  });

  it('com moodboard, a referência manda no visual: paleta, contraste e luz', () => {
    const plano = buildImagePrompt({ ...base, referenceCount: 1, styleMoodboard: true }, { route: 'sjinn' });
    expect(IMAGE_PROMPT_TEXT.moodboardOnly.startsWith('STYLE REFERENCE (moodboard): ')).toBe(true);
    expect(plano.prompt).toContain(IMAGE_PROMPT_TEXT.moodboardOnly);
    for (const trecho of ['palette (including black and white or a limited palette)', 'contrast, lighting and texture', 'overrides any colour, light or mood mentioned elsewhere in this request', 'not their subject']) expect(IMAGE_PROMPT_TEXT.moodboardOnly).toContain(trecho);
  });

  it('com moodboard, o tratamento de luz da família não entra para não disputar com a referência', () => {
    const comMood = buildImagePrompt({ ...base, referenceCount: 1, styleMoodboard: true }, { route: 'sjinn' });
    expect(comMood.prompt).not.toContain('VISUAL TREATMENT');
    expect(comMood.prompt).not.toContain('DEFAULT ART DIRECTION');
    const semMood = buildImagePrompt(base, { route: 'sjinn' });
    expect(semMood.prompt).toContain('VISUAL TREATMENT: Use warm window light');
    const soAncora = buildImagePrompt({ ...base, referenceCount: 1, styleMoodboard: false, identityAnchor: 'IDENTITY ANCHOR: x.' }, { route: 'sjinn' });
    expect(soAncora.prompt).toContain('VISUAL TREATMENT: Use warm window light');
  });
});
