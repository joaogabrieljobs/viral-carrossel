// Catálogo final de prompts de imagem (22/11/2026).
// Os 19 cenários A–G vêm do fixture versionado; os dados de exemplo (padeira,
// colagem de papel, @mood) existem só aqui e nunca entram em pedidos reais.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  AI_SYSTEM_PT,
  GPT_IMAGE_ART_DIRECTION,
  buildGptImageFullPrompt,
  planImagePrompt,
  generateDALLE,
  generateZaiImage,
  setAIRuntimeSettings,
} from '../../src/utils/ai-client.js';
import { composeImageDirection } from '../../src/utils/image-direction.js';
import {
  PERSON_IDENTITY_DIRECTION,
  buildVisualBiblePromptRules,
  composeSubjectsDirection,
  composeFamilyTreatment,
  planPersonAnchor,
} from '../../src/utils/visual-bible.js';
import { buildGenerationTaskBlock, buildStyleKitTextHint, composeImgExtraPrompt } from '../../src/utils/style-kit.js';
import { composeReferenceMap } from '../../src/utils/slide-reference.js';
import { socialPhotoDirection, SOCIAL_COMPOSERS } from '../../src/utils/social-families.js';
import { presentationPhotoDirection, familySpec } from '../../src/utils/presentation-families.js';
import { imageFramingDirection } from '../../shared/image-aspect.js';
import {
  IMAGE_PROMPT_TEXT,
  IMAGE_REFERENCE_BLOCKED_LABEL,
  SJINN_PROMPT_LIMIT,
  AGENT_RESERVED_LIMIT,
  assertImagePromptWithinLimit,
  buildImagePrompt,
  imageRouteCapabilities,
  isAestheticDirection,
} from '../../shared/image-prompt.js';
import { agentImagePrompt, agentImageContext } from '../../api/lib/agent-image-generation.js';
import { createGptImage2Task } from '../../api/lib/sjinn.js';

const catalogo = JSON.parse(readFileSync(new URL('../fixtures/image-prompt-catalogo-final.json', import.meta.url), 'utf8'));
const B = catalogo.blocos;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  setAIRuntimeSettings({});
});

// ---------- Entradas de exemplo dos cenários (as mesmas do export, revisadas) ----------
const Q = 'baker shaping sourdough loaf on floured wooden table, morning window light';
const FICHA = { entities: [
  { id: 'marta', en: 'Marta Sales, the baker, wearing a plain apron over everyday clothes', never: 'a chef hat' },
  { id: 'pao-campones', en: 'round rustic sourdough loaf with a dark crackled crust and flour dusting', never: 'sliced sandwich bread' },
] };
const KIT_ESTILO = { stylePrompt: 'Use paper collage with uncoated paper textures and muted warm colours.', contextMd: '' };
const KIT_MOODBOARD = { stylePrompt: '', contextMd: '', refImages: [{ id: 'm1', imageId: 'm1', name: 'mood.png', mention: 'mood' }] };
const ANCORA = 'data:image/png;base64,YQ==';
const SLIDE_REVISTA = { socialCompositionVersion: 4, socialFamily: 'revista' };

function entradaDoCenario(letra) {
  if (letra === 'A') return { direction: composeImageDirection({ slide: {}, fmt: 'carrossel' }), ratio: '4:5', refs: 0 };
  if (letra === 'B') return { direction: composeImageDirection({ visualBible: FICHA, slide: SLIDE_REVISTA, fmt: 'carrossel' }), ratio: '4:5', refs: 0 };
  if (letra === 'C') return { direction: composeImageDirection({ styleKit: KIT_ESTILO, slide: {}, fmt: 'carrossel' }), ratio: '4:5', refs: 0 };
  if (letra === 'D') return { direction: composeImageDirection({ styleKit: KIT_MOODBOARD, slide: {}, fmt: 'carrossel', baseReferenceCount: 1 }), ratio: '4:5', refs: 1 };
  if (letra === 'E') {
    const anchorPlan = planPersonAnchor({ visualBible: FICHA, imageQuery: Q, anchorUrl: ANCORA, refCount: 0 });
    return {
      direction: composeImageDirection({ visualBible: FICHA, slide: SLIDE_REVISTA, fmt: 'carrossel', anchorPlan, baseReferenceCount: 0 }),
      ratio: '4:5', refs: anchorPlan.refImages.length,
    };
  }
  if (letra === 'F') {
    return {
      direction: composeImageDirection({ slide: { presentationPresetId: 'pds.editorial-magazine' }, fmt: 'apresentacao', presentationPanel: true }),
      ratio: '16:9', refs: 0,
    };
  }
  throw new Error(`cenário desconhecido: ${letra}`);
}

describe('cenários A–G do catálogo final', () => {
  it('o fixture traz os 19 cenários', () => {
    expect(catalogo.cenarios).toHaveLength(19);
  });

  for (const [indice, cenario] of catalogo.cenarios.entries()) {
    const letra = cenario.cenario.slice(0, 1);
    it(`#${indice + 1} ${cenario.cenario} · ${cenario.rota} (${cenario.modelo})`, () => {
      if (cenario.rota === 'mcp') {
        const prompt = agentImagePrompt(Q);
        expect(prompt).toBe(cenario.prompt);
        expect(prompt.length).toBe(Number(cenario.caracteres));
        expect(prompt).not.toContain('DEFAULT ART DIRECTION');
        return;
      }
      const entrada = entradaDoCenario(letra);
      const plano = planImagePrompt(Q, null, entrada.direction, {
        route: cenario.rota, model: cenario.modelo, aspectRatio: entrada.ratio, referenceCount: entrada.refs,
      });
      if (cenario.resultado !== 'Pronto') {
        expect(cenario.resultado).toBe(IMAGE_REFERENCE_BLOCKED_LABEL);
        expect(plano).toMatchObject({ status: 'blocked', code: 'reference_unsupported', label: IMAGE_REFERENCE_BLOCKED_LABEL });
        expect(plano.prompt).toBe('');
        expect(plano.chars).toBe(0);
        return;
      }
      expect(plano.status).toBe('ready');
      expect(plano.prompt).toBe(cenario.prompt);
      expect(plano.chars).toBe(Number(cenario.caracteres));
      expect(plano.prompt.length).toBe(Number(cenario.caracteres));
      expect(plano.defaultAesthetic).toBe(cenario.esteticaPadrao === 'Sim');
      expect(plano.dropped).toEqual([]);
      // A função histórica devolve o mesmo texto.
      expect(buildGptImageFullPrompt(Q, null, entrada.direction, {
        route: cenario.rota, model: cenario.modelo, aspectRatio: entrada.ratio, referenceCount: entrada.refs,
      })).toBe(cenario.prompt);
    });
  }

  it('nenhum cenário usa os eixos de imagem (I04–I11 são de outra sessão)', () => {
    const eixos = ['I04', 'I05', 'I06', 'I07', 'I08', 'I09', 'I10', 'I11'].map((chave) => B[chave]);
    for (const cenario of catalogo.cenarios) {
      for (const eixo of eixos) expect(cenario.prompt).not.toContain(eixo);
      expect(cenario.prompt).not.toContain('user adjusted');
    }
  });

  it('o texto que os eixos devolverem acompanha a cena, sem ser reescrito aqui', () => {
    const eixo = '\nAdditional art direction (user adjusted): qualquer texto devolvido.';
    const montado = buildImagePrompt({ scene: Q, axisTags: eixo }, { route: 'sjinn' });
    expect(montado.prompt.startsWith(`SCENE: ${Q}\nAdditional art direction (user adjusted): qualquer texto devolvido.\n\nHARD RULES:`)).toBe(true);
  });
});

describe('blocos I02–I31 nos destinos do catálogo', () => {
  it('textos fixos', () => {
    expect(GPT_IMAGE_ART_DIRECTION).toBe(B.I02);
    expect(IMAGE_PROMPT_TEXT.defaultArtDirection).toBe(B.I02);
    expect(IMAGE_PROMPT_TEXT.mediumCarousel).toBe(B.I12);
    expect(IMAGE_PROMPT_TEXT.mediumPresentation).toBe(B.I13);
    expect(IMAGE_PROMPT_TEXT.canvasSocial).toBe(B.I14);
    expect(IMAGE_PROMPT_TEXT.canvasPresentation).toBe(B.I15);
    expect(IMAGE_PROMPT_TEXT.hardRules).toBe(B.I16);
    expect(IMAGE_PROMPT_TEXT.referenceRoles).toBe(B.I17);
    expect(IMAGE_PROMPT_TEXT.moodboardOnly).toBe(B.I18);
    expect(IMAGE_PROMPT_TEXT.presentationPanel).toBe(B.I23);
    expect(PERSON_IDENTITY_DIRECTION).toBe(B.I24);
    expect(IMAGE_PROMPT_TEXT.agentRules).toBe(B.I31);
  });

  it('I03 cena e I19–I21 estilo do projeto e do slide', () => {
    const corpo = composeImgExtraPrompt({ stylePrompt: 'ESTILO', contextMd: '' }, 'SLIDE');
    expect(corpo).toBe(`${B.I20.replace('{{projectStyle}}', 'ESTILO')}\n\n${B.I21.replace('{{slideDirection}}', 'SLIDE')}`);
    const { prompt } = buildImagePrompt({ scene: 'CENA', styleBody: corpo, format: 'carousel' }, { route: 'openai', model: 'gpt-image-2' });
    expect(prompt.startsWith(`${B.I03.replace('{{scene}}', 'CENA')}\n\n${B.I16}`)).toBe(true);
    expect(prompt).toContain(B.I19.replace('{{styleBody}}', corpo).replace('{{canvas}}', B.I14));
    const deck = buildImagePrompt({ scene: 'CENA', styleBody: corpo, format: 'presentation' }, { route: 'openai', model: 'gpt-image-2' });
    expect(deck.prompt).toContain(B.I19.replace('{{styleBody}}', corpo).replace('{{canvas}}', B.I15));
  });

  it('I22 mapa das referências na ordem real de envio', () => {
    const mapa = composeReferenceMap([{ label: 'produto', role: 'subject' }, { role: 'moodboard' }, { label: 'marta', role: 'identity' }], 'show @produto on the counter');
    expect(mapa).toBe(B.I22
      .replace('{{referenceMap}}', '@produto = image 1 (subject)\n@marta = image 3 (identity)')
      .replace('{{resolvedDirection}}', 'show @produto on the counter'));
    expect(composeReferenceMap([{ role: 'moodboard' }], 'x')).toBe('');
  });

  it('I25 ficha visual e I26 tratamento da família', () => {
    expect(composeSubjectsDirection(FICHA)).toBe(B.I25.replace('{{subjects}}',
      '- marta: Marta Sales, the baker, wearing a plain apron over everyday clothes. Exclude: a chef hat.\n'
      + '- pao-campones: round rustic sourdough loaf with a dark crackled crust and flour dusting. Exclude: sliced sandwich bread.'));
    expect(composeFamilyTreatment('TRATAMENTO')).toBe(B.I26.replace('{{familyEnglish}}', 'TRATAMENTO'));
    expect(composeFamilyTreatment('')).toBe('');
  });

  it('I27–I30 enquadramento', () => {
    const zona = (photo, title) => ({ canvas: { enabled: true, zones: { photo, ...(title ? { title } : {}) } } });
    expect(`FRAMING: ${imageFramingDirection({}, 'carrossel')}`).toBe(B.I27);
    expect(`FRAMING: ${imageFramingDirection(zona({ x: 0, y: 0, w: 46, h: 100 }), 'carrossel')}`).toBe(B.I28);
    expect(`FRAMING: ${imageFramingDirection(zona({ x: 0, y: 0, w: 100, h: 30 }), 'carrossel')}`).toBe(B.I29);
    expect(`FRAMING: ${imageFramingDirection(zona({ x: 0, y: 0, w: 100, h: 100 }, { x: 5, y: 60, w: 90, h: 20 }), 'carrossel')}`).toBe(B.I30);
  });

  it('famílias: português para o modelo de texto, inglês para o gerador, filtro intacto', () => {
    expect(catalogo.familias).toHaveLength(31);
    for (const familia of catalogo.familias) {
      const deck = familia.tipo.startsWith('Apresentação');
      const pt = deck ? presentationPhotoDirection(familia.id, 'pt') : socialPhotoDirection(familia.id, 'pt');
      const en = deck ? presentationPhotoDirection(familia.id, 'en') : socialPhotoDirection(familia.id, 'en');
      const filtro = deck ? familySpec(familia.id).photo.filter : SOCIAL_COMPOSERS[familia.id].photo.filter;
      expect(pt, `${familia.id} pt`).toBe(familia.pt);
      expect(en, `${familia.id} en`).toBe(familia.en);
      expect(filtro, `${familia.id} filtro`).toBe(familia.filtro);
    }
  });

  it('regras do modelo de texto: subjects, projectStyle, C01 e C03', () => {
    expect(buildVisualBiblePromptRules()).toBe(catalogo.imageQuery.subjects);
    expect(buildStyleKitTextHint({ stylePrompt: 'DIREÇÃO', contextMd: '' }).trim())
      .toBe(catalogo.imageQuery.projectStyle.replace('{{projectStyle}}', 'DIREÇÃO'));
    expect(AI_SYSTEM_PT).toBe(catalogo.comum.C01);
    expect(buildGenerationTaskBlock('vender o curso').trim())
      .toBe(catalogo.comum.C03.replace('"{{request}}"', JSON.stringify('vender o curso')));
  });
});

describe('seleção: quando a direção de arte padrão fica e quando sai', () => {
  const planejar = (direction, extra = {}) => planImagePrompt(Q, null, direction, { route: 'openai', model: 'gpt-image-2', aspectRatio: '4:5', ...extra });

  it('painel de apresentação mantém a estética padrão', () => {
    const plano = planejar(composeImageDirection({ slide: {}, fmt: 'apresentacao', presentationPanel: true }), { aspectRatio: '16:9' });
    expect(plano.defaultAesthetic).toBe(true);
    expect(plano.prompt).toContain(B.I23);
    expect(plano.prompt).toContain(B.I13);
    expect(plano.prompt).toContain(B.I02);
  });

  it('âncora de identidade mantém a estética padrão', () => {
    const anchorPlan = planPersonAnchor({ visualBible: FICHA, imageQuery: Q, anchorUrl: ANCORA, refCount: 0 });
    const plano = planejar(composeImageDirection({ visualBible: FICHA, slide: {}, fmt: 'carrossel', anchorPlan, baseReferenceCount: 0 }), { referenceCount: 1 });
    expect(plano.defaultAesthetic).toBe(true);
    expect(plano.prompt).toContain(B.I24);
    expect(plano.prompt).toContain('@marta = image 1 (identity)');
    expect(plano.prompt).not.toContain(B.I18);
  });

  it('referência de produto do card mantém a estética padrão e a direção de ação fica junto do mapa', () => {
    const slide = { imageReferences: [{ id: 'p1', imageId: 'p1', name: 'produto.png', mention: 'produto' }] };
    const direction = composeImageDirection({ slide, fmt: 'carrossel', slideDirection: 'place @produto on the counter, held by one hand', baseReferenceCount: 1 });
    const plano = planejar(direction, { referenceCount: 1 });
    expect(plano.defaultAesthetic).toBe(true);
    expect(plano.prompt).toContain(B.I17);
    expect(plano.prompt).toContain('@produto = image 1 (subject)');
    expect(plano.prompt).toContain('these labels.\nplace @produto on the counter, held by one hand');
    expect(plano.prompt).toContain(B.I12);
    expect(plano.prompt).toContain(B.I02);
    expect(plano.prompt).not.toContain(B.I18);
    expect(plano.prompt).not.toContain('PROJECT OR SLIDE STYLE');
  });

  it('direção de ação escrita no card (sem estética) não desliga a estética padrão', () => {
    const direction = composeImageDirection({ slide: {}, fmt: 'carrossel', slideDirection: 'close das mãos, pessoa de costas para a câmera' });
    const plano = planejar(direction);
    expect(isAestheticDirection('close das mãos, pessoa de costas para a câmera')).toBe(false);
    expect(plano.defaultAesthetic).toBe(true);
    expect(plano.prompt).toContain('THIS SLIDE DIRECTION:\nclose das mãos, pessoa de costas para a câmera');
    expect(plano.prompt).not.toContain('PROJECT OR SLIDE STYLE');
  });

  it('estilo explícito do projeto desliga a estética padrão', () => {
    const plano = planejar(composeImageDirection({ styleKit: KIT_ESTILO, slide: SLIDE_REVISTA, fmt: 'carrossel' }));
    expect(plano.defaultAesthetic).toBe(false);
    expect(plano.prompt).not.toContain('DEFAULT ART DIRECTION');
    expect(plano.prompt).not.toContain(B.I12);
    expect(plano.prompt).toContain('PROJECT OR SLIDE STYLE');
    // A família continua disponível; o texto dela já diz que o estilo explícito prevalece.
    expect(plano.prompt).toContain('VISUAL TREATMENT: ');
  });

  it('direção estética escrita no card desliga a estética padrão', () => {
    expect(isAestheticDirection('ilustração em aquarela, paleta pastel')).toBe(true);
    const plano = planejar(composeImageDirection({ slide: {}, fmt: 'carrossel', slideDirection: 'ilustração em aquarela, paleta pastel' }));
    expect(plano.defaultAesthetic).toBe(false);
    expect(plano.prompt).toContain(`${B.I19.split('\n')[0]}\nTHIS SLIDE DIRECTION:\nilustração em aquarela, paleta pastel\n${B.I14}`);
    expect(plano.prompt).not.toContain('DEFAULT ART DIRECTION');
  });

  it('moodboard de estilo desliga a estética padrão', () => {
    const plano = planejar(composeImageDirection({ styleKit: KIT_MOODBOARD, slide: {}, fmt: 'carrossel', baseReferenceCount: 1 }), { referenceCount: 1 });
    expect(plano.defaultAesthetic).toBe(false);
    expect(plano.prompt).toContain(B.I18);
    expect(plano.prompt).not.toContain('DEFAULT ART DIRECTION');
  });

  it('chamada antiga: anexos sem papel declarado valem como moodboard; texto solto vale como estilo', () => {
    const comAnexo = buildGptImageFullPrompt('world', null, '', { withReference: true });
    expect(comAnexo).toContain(B.I17);
    expect(comAnexo).toContain(B.I18);
    expect(comAnexo).not.toContain('DEFAULT ART DIRECTION');
    const comTexto = buildGptImageFullPrompt('world', null, 'expressive 3D, orange graphic accents', {});
    expect(comTexto).toContain('PROJECT OR SLIDE STYLE');
    expect(comTexto).toContain('expressive 3D, orange graphic accents');
    expect(comTexto).not.toContain('DEFAULT ART DIRECTION');
  });
});

describe('orçamento por rota e modelo', () => {
  const fichaLonga = { entities: ['um', 'dois', 'tres', 'quatro'].map((id, i) => ({
    id, en: `subject number ${i + 1} ${'with a long but complete visible trait '.repeat(9)}end`.slice(0, 380), never: 'anything else on the table',
  })) };
  // Ficha no teto + instrução de ação longa (sem estética): passa de 4.000 com a estética padrão.
  const acaoLonga = 'pessoa de costas para a câmera, mãos em primeiro plano sobre a bancada. '.repeat(16).trim();
  const direcaoCheia = () => composeImageDirection({ visualBible: fichaLonga, slide: SLIDE_REVISTA, fmt: 'carrossel', slideDirection: acaoLonga });
  const semPedaco = (prompt, bloco) => prompt.includes(bloco) || !prompt.includes(bloco.slice(0, 24));

  it('capacidades: provedor e modelo efetivo decidem limite e anexos', () => {
    expect(imageRouteCapabilities('sjinn')).toMatchObject({ promptLimit: 4000, maxReferences: 4 });
    expect(imageRouteCapabilities('openai', 'gpt-image-2')).toMatchObject({ promptLimit: 32000, maxReferences: 4 });
    expect(imageRouteCapabilities('openai', 'gpt-image-1.5')).toMatchObject({ promptLimit: 32000, maxReferences: 4 });
    expect(imageRouteCapabilities('openai', 'dall-e-3')).toMatchObject({ promptLimit: 4000, maxReferences: 0 });
    expect(imageRouteCapabilities('zai', 'cogview-4-250304')).toMatchObject({ promptLimit: 32000, maxReferences: 0 });
    expect(imageRouteCapabilities('mcp')).toMatchObject({ promptLimit: 4000, reservedLimit: 3600, maxReferences: 0 });
    expect(SJINN_PROMPT_LIMIT).toBe(4000);
    expect(AGENT_RESERVED_LIMIT).toBe(3600);
  });

  it('no plano (4.000) descarta só blocos opcionais inteiros; cena, regras fixas, recorte e ficha ficam íntegros', () => {
    const direction = direcaoCheia();
    const cheio = planImagePrompt(Q, null, direction, { route: 'openai', model: 'gpt-image-2', aspectRatio: '4:5' });
    expect(cheio.chars).toBeGreaterThan(4000);
    expect(cheio.dropped).toEqual([]);
    expect(cheio.prompt).toContain(B.I02);

    const plano = planImagePrompt(Q, null, direction, { route: 'sjinn', aspectRatio: '4:5' });
    expect(plano.status).toBe('ready');
    expect(plano.chars).toBeLessThanOrEqual(4000);
    expect(plano.prompt.startsWith(`SCENE: ${Q}\n\n${B.I16}\n\n${B.I27}\n\n`)).toBe(true);
    expect(plano.prompt).toContain(direction.subjects);
    expect(plano.dropped.length).toBeGreaterThan(0);
    expect(plano.dropped).toContain('defaultArtDirection');
    for (const bloco of [B.I02, B.I12, composeFamilyTreatment(socialPhotoDirection('revista', 'en'))]) {
      expect(semPedaco(plano.prompt, bloco), bloco.slice(0, 30)).toBe(true);
    }
    // Não é o prompt completo fatiado: termina num bloco inteiro.
    expect(plano.prompt).not.toBe(cheio.prompt.slice(0, 4000));
    expect(cheio.prompt.split('\n\n')).toContain(plano.prompt.split('\n\n').at(-1));
  });

  it('a ordem de descarte começa pela estética padrão e a família é a última opcional a sair', () => {
    const base = { scene: Q, format: 'carousel', framing: B.I27, familyEnglish: 'FAMILY' };
    const fixos = buildImagePrompt({ scene: Q, framing: B.I27 }, { route: 'openai', model: 'gpt-image-2' });
    const tudo = buildImagePrompt(base, { route: 'openai', model: 'gpt-image-2' });
    expect(tudo.dropped).toEqual([]);
    const semPadrao = buildImagePrompt(base, { route: 'openai', model: 'gpt-image-2', limit: tudo.chars - 1 });
    expect(semPadrao.dropped).toEqual(['defaultArtDirection']);
    expect(semPadrao.defaultAesthetic).toBe(false);
    const soFamilia = buildImagePrompt(base, { route: 'openai', model: 'gpt-image-2', limit: semPadrao.chars - 1 });
    expect(soFamilia.dropped).toEqual(['defaultArtDirection', 'medium']);
    expect(soFamilia.prompt).toContain('VISUAL TREATMENT: FAMILY');
    const nenhumOpcional = buildImagePrompt(base, { route: 'openai', model: 'gpt-image-2', limit: soFamilia.chars - 1 });
    expect(nenhumOpcional.dropped).toEqual(['defaultArtDirection', 'medium', 'treatment']);
    expect(nenhumOpcional.prompt).toBe(fixos.prompt.split(`\n\n${B.I12}`)[0]);
  });

  it('estilo do projeto, direção do slide e ficha no teto: nada passa de 4.000 e as regras fixas não são cortadas', () => {
    const kit = { stylePrompt: `${'Use layered paper collage with visible fibres. '.repeat(60)}`.slice(0, 2400), contextMd: '' };
    const direction = composeImageDirection({ styleKit: kit, visualBible: fichaLonga, slide: SLIDE_REVISTA, fmt: 'carrossel',
      slideDirection: `${'ilustração em aquarela com paleta pastel. '.repeat(40)}`.slice(0, 1200) });
    const plano = planImagePrompt(Q, null, direction, { route: 'sjinn', aspectRatio: '4:5' });
    expect(plano.chars).toBeLessThanOrEqual(4000);
    expect(plano.prompt.startsWith(`SCENE: ${Q}\n\n${B.I16}\n\n${B.I27}\n\n`)).toBe(true);
    expect(plano.prompt).toContain(B.I25.split('\n')[0]);
    expect(plano.prompt).toContain(B.I19.split('\n')[0]);
    expect(plano.prompt).toContain(B.I14);
    expect(plano.trimmed.length).toBeGreaterThan(0);
    // O que foi reduzido termina em frase ou linha inteira, nunca no meio de uma palavra.
    expect(plano.prompt).not.toMatch(/Use layered paper collage with visible fib(?!res)/);
    expect(assertImagePromptWithinLimit(plano.prompt, SJINN_PROMPT_LIMIT)).toBe(plano.prompt);
  });

  it('cena longa do usuário é preservada inteira dentro do orçamento', () => {
    const cena = `${'A long but legitimate scene description written by the user. '.repeat(30)}`.trim();
    expect(cena.length).toBeGreaterThan(280);
    const plano = planImagePrompt(cena, null, direcaoCheia(), { route: 'sjinn', aspectRatio: '4:5' });
    expect(plano.chars).toBeLessThanOrEqual(4000);
    expect(plano.prompt.startsWith(`SCENE: ${cena}\n\n${B.I16}`)).toBe(true);
  });

  it('o pedido enviado ao plano já sai dentro do limite que o servidor valida', async () => {
    setAIRuntimeSettings({ useOwnImageKey: false });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ b64_json: 'resultado' }) });
    vi.stubGlobal('fetch', fetchMock);
    await generateDALLE(Q, '', null, { imageDirection: direcaoCheia(), aspectRatio: '4:5' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.prompt.length).toBeLessThanOrEqual(SJINN_PROMPT_LIMIT);
    expect(body.prompt).toBe(planImagePrompt(Q, null, direcaoCheia(), { route: 'sjinn', aspectRatio: '4:5' }).prompt);
    expect(body.prompt).toContain(B.I16);
  });

  it('fallback até o DALL·E 3 recalcula o orçamento em vez de fatiar o prompt', async () => {
    vi.resetModules();
    const ai = await import('../../src/utils/ai-client.js');
    ai.setAIRuntimeSettings({ useOwnImageKey: true, imageProvider: 'openai', imageModels: { openai: 'gpt-image-2' }, keys: { openai: 'test-fake' } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: { message: 'organization must be verified' } }) })
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: { message: 'model not found' } }) })
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: { message: 'model not found' } }) })
      .mockResolvedValue({ ok: true, json: async () => ({ data: [{ b64_json: 'resultado' }] }) });
    vi.stubGlobal('fetch', fetchMock);
    await ai.generateDALLE(Q, 'test-fake', null, { imageDirection: direcaoCheia(), aspectRatio: '4:5' });
    const corpos = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(corpos.map((corpo) => corpo.model)).toEqual(['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'dall-e-3']);
    expect(corpos[0].prompt.length).toBeGreaterThan(4000);
    expect(corpos[0].prompt).toContain(B.I02);
    expect(corpos[3].prompt.length).toBeLessThanOrEqual(4000);
    expect(corpos[3].prompt).not.toBe(corpos[0].prompt.slice(0, 4000));
    expect(corpos[3].prompt.startsWith(`SCENE: ${Q}\n\n${B.I16}\n\n${B.I27}\n\n`)).toBe(true);
    expect(corpos[3].prompt).toBe(ai.planImagePrompt(Q, null, direcaoCheia(), { route: 'openai', model: 'dall-e-3', aspectRatio: '4:5' }).prompt);
    ai.setAIRuntimeSettings({});
  });

  it('DALL·E 3 não recebe anexos: com referência exigida, o pedido não cai para ele', async () => {
    expect(planImagePrompt(Q, null, composeImageDirection({ styleKit: KIT_MOODBOARD, slide: {}, fmt: 'carrossel', baseReferenceCount: 1 }),
      { route: 'openai', model: 'dall-e-3', referenceCount: 1 })).toMatchObject({ status: 'blocked', code: 'reference_unsupported' });
    vi.resetModules();
    const ai = await import('../../src/utils/ai-client.js');
    ai.setAIRuntimeSettings({ useOwnImageKey: true, imageProvider: 'openai', imageModels: { openai: 'gpt-image-2' }, keys: { openai: 'test-fake' } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: { message: 'model not found' } }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(ai.generateDALLE(Q, 'test-fake', null, { refImages: [ANCORA] })).rejects.toThrow();
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('/images/edits'))).toBe(true);
    expect(fetchMock.mock.calls.map(([, init]) => init.body.get('model'))).not.toContain('dall-e-3');
    ai.setAIRuntimeSettings({});
  });
});

describe('rota Z.ai: referência exigida bloqueia antes da chamada', () => {
  // O provedor está escondido da tela e `normalizeAISettings` devolve quem o
  // tinha ao OpenAI; por isso a rota é exercitada pela função dela.
  it('recusa anexos com incompatibilidade e não chama o provedor', async () => {
    setAIRuntimeSettings({ useOwnImageKey: true, keys: { zai: 'test-fake' } });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(generateZaiImage(Q, null, '', undefined, { refImages: [ANCORA] }))
      .rejects.toMatchObject({ code: 'reference_unsupported', label: IMAGE_REFERENCE_BLOCKED_LABEL });
    await expect(generateZaiImage(Q, null, '', undefined, { refImage: ANCORA })).rejects.toMatchObject({ code: 'reference_unsupported' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sem referência a rota gera normalmente com o prompt do catálogo', async () => {
    setAIRuntimeSettings({ useOwnImageKey: true, imageModels: { zai: 'cogview-4-250304' }, keys: { zai: 'test-fake' } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ url: 'https://cdn.exemplo/a.png' }] }) });
    vi.stubGlobal('fetch', fetchMock);
    await generateZaiImage(Q, null, composeImageDirection({ slide: {}, fmt: 'carrossel' }), undefined, { aspectRatio: '4:5' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.payload.model).toBe('cogview-4-250304');
    expect(body.payload.prompt).toBe(catalogo.cenarios[2].prompt);
  });
});

describe('rota do agente / MCP', () => {
  it('usa o contexto textual do projeto com os mesmos blocos do editor', () => {
    const doc = { format: 'carrossel', styleKit: KIT_ESTILO, visualBible: FICHA };
    const slide = { id: 's1', imageQuery: Q, ...SLIDE_REVISTA };
    const prompt = agentImagePrompt(Q, agentImageContext(doc, slide));
    expect(prompt.startsWith(`SCENE: ${Q}\n\n${B.I31}\n\n`)).toBe(true);
    expect(prompt).toContain(composeSubjectsDirection(FICHA));
    expect(prompt).toContain(B.I19.replace('{{styleBody}}', composeImgExtraPrompt(KIT_ESTILO, '')).replace('{{canvas}}', B.I14));
    expect(prompt).toContain(composeFamilyTreatment(socialPhotoDirection('revista', 'en')));
    expect(prompt).not.toContain('HARD RULES:');
    expect(prompt).not.toContain('DEFAULT ART DIRECTION');
    expect(prompt.length).toBeLessThanOrEqual(4000);
  });

  it('projeto sem contexto visual devolve só cena e regras', () => {
    expect(agentImagePrompt(Q, agentImageContext({ format: 'carrossel' }, { id: 's1', imageQuery: Q }))).toBe(catalogo.cenarios[18].prompt);
    expect(agentImagePrompt(Q, agentImageContext(null, null))).toBe(catalogo.cenarios[18].prompt);
  });

  it('tema + regras cabem em 3.600 e o pedido em 4.000; as regras fixas nunca saem', () => {
    const tema = `${'a very long scene written by an external agent '.repeat(120)}`.trim();
    const semContexto = agentImagePrompt(tema);
    expect(semContexto.length).toBeLessThanOrEqual(3600);
    expect(semContexto.endsWith(`\n\n${B.I31}`)).toBe(true);
    const doc = { format: 'carrossel', styleKit: KIT_ESTILO, visualBible: FICHA };
    const comContexto = agentImagePrompt(tema, agentImageContext(doc, { id: 's1', imageQuery: tema }));
    expect(comContexto.length).toBeLessThanOrEqual(4000);
    expect(comContexto).toContain(B.I31);
    expect(comContexto.indexOf(B.I31) + B.I31.length).toBeLessThanOrEqual(3600);
  });
});

describe('servidor valida o pedido completo com o mesmo comprimento', () => {
  it('assertImagePromptWithinLimit aceita o limite exato e recusa um caractere a mais', () => {
    expect(assertImagePromptWithinLimit('x'.repeat(4000), 4000)).toHaveLength(4000);
    expect(() => assertImagePromptWithinLimit('x'.repeat(4001), 4000)).toThrow(expect.objectContaining({ code: 'prompt_too_long', status: 400, limit: 4000, length: 4001 }));
    // Conta unidades UTF-16, como o navegador.
    expect(() => assertImagePromptWithinLimit('😀'.repeat(2001), 4000)).toThrow(expect.objectContaining({ code: 'prompt_too_long' }));
  });

  it('createGptImage2Task recusa pedido acima de 4.000 sem chamar o SJinn e não fatia o texto', async () => {
    vi.stubEnv('SJINN_API_KEY', 'test-fake-sjinn-key');
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, json: async () => ({ success: true, data: { task_id: 'task_1' } }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(createGptImage2Task({ prompt: 'x'.repeat(4001) })).rejects.toMatchObject({ code: 'prompt_too_long' });
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(createGptImage2Task({ prompt: 'x'.repeat(4000) })).resolves.toBe('task_1');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).input.prompt).toHaveLength(4000);
  });
});
