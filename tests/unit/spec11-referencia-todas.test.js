import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PRESENTATION_PLAN_PROMPT_VERSION, PRESENTATION_PLAN_SCHEMA_VERSION, attachPresentationPlan,
} from '../../src/utils/presentation-plan.js';
import * as imageDirection from '../../src/utils/image-direction.js';
import { buildImagePrompt, IMAGE_PROMPT_TEXT } from '../../shared/image-prompt.js';
import { imagePromptCutMessage } from '../../src/utils/image-prompt-budget.js';
import { resolveImageReferences } from '../../src/utils/style-kit-storage.js';

const { composeImageDirection, presentationOtherScenes } = imageDirection;

// Spec 1.1, referência (pedido do dono, 25/11, tarde): a imagem de referência
// do kit deriva TODAS as imagens da apresentação, com o mesmo padrão visual e
// cenas variadas. Desfaz a regra "só capa e fecho" (5999378).
//
// Causa da repetição antiga (Apoteose, mesma mulher de máscara em 7 de 10):
// com estilo escrito, o pedido só levava REFERENCE ROLES, que mandava usar o
// moodboard para "medium, palette, lighting and composition". O aviso de tirar
// só o visual (moodboardOnly) só entrava sem estilo escrito. Agora, na
// apresentação, todo pedido com referência de estilo diz que dela sai só o
// visual, e cada slide lista as cenas dos outros para não repetir.
const apoteose = JSON.parse(readFileSync(new URL('../fixtures/apoteose.json', import.meta.url), 'utf8'));
const estrutura = JSON.parse(readFileSync(new URL('../fixtures/apoteose-estrutura.json', import.meta.url), 'utf8'));
const kit = { ...apoteose.styleKit, refImages: [{ id: 'img_ref', name: 'referencia.jpeg', dataUrl: 'data:image/png;base64,AAAA' }] };
const deckV1 = attachPresentationPlan({ slides: apoteose.slides.map(({ presentationComposition, ...slide }) => slide) }, structuredClone(apoteose.presentationPlan)).slides;

const subjects = ['city skyline at night', 'friends toasting', 'dance floor under violet light', 'street musicians', 'vinyl records on a mixer', 'stylish crowd in line', 'graphic tropical prints', 'rooftop garden', 'empty table', 'guests leaving at sunrise'];
const planV2 = () => {
  const plan = structuredClone(apoteose.presentationPlan);
  plan.schemaVersion = PRESENTATION_PLAN_SCHEMA_VERSION;
  plan.promptVersion = PRESENTATION_PLAN_PROMPT_VERSION;
  plan.rules = [{ id: 'r1', level: 'avoid', target: 'image', instruction: 'clichês visuais do Carnaval: fantasias, plumas e confetes literais' }];
  plan.slides = plan.slides.map(({ imageBrief, ...slide }, index) => ({
    ...slide,
    scene: index === 8 ? null : { subject: subjects[index], action: 'celebrating', setting: 'São Paulo party venue', shot: index % 2 ? 'medium' : 'wide' },
    avoid: '',
  }));
  return plan;
};
const deckV2 = attachPresentationPlan({ slides: apoteose.slides.map(({ presentationComposition, ...slide }) => slide) }, planV2()).slides;

const promptFor = (deck, index, styleKit = kit, extra = {}) => {
  const direction = composeImageDirection({
    styleKit, slide: deck[index], fmt: 'apresentacao', baseReferenceCount: styleKit.refImages.length,
    presentationPanel: true, presentationFamily: 'presentation_cinematic', deckSlides: deck, slideIndex: index, ...extra,
  });
  const plan = buildImagePrompt({ scene: deck[index].imageQuery, ...direction }, { route: 'sjinn' });
  return { direction, ...plan };
};

describe('Spec 1.1 referência: a referência do kit vai em todas as imagens da apresentação', () => {
  it('a regra "só capa e fecho" saiu do módulo', () => {
    expect(imageDirection).not.toHaveProperty('presentationStyleKitForSlide');
    expect(imageDirection).not.toHaveProperty('presentationStyleReferenceAllowed');
  });

  it('os 10 slides da Apoteose anexam a referência e o pedido diz que dela sai só o visual', async () => {
    for (const deck of [deckV1, deckV2]) {
      expect(await Promise.all(deck.map(slide => resolveImageReferences(kit, slide.refImage, slide.refImageId, slide.imageReferences)))).toEqual(deck.map(() => ['data:image/png;base64,AAAA']));
      const result = deck.map((_, index) => promptFor(deck, index));
      expect(result.map(item => item.direction.referenceCount)).toEqual(deck.map(() => 1));
      expect(result.every(item => item.prompt.includes(IMAGE_PROMPT_TEXT.styleReferenceLook))).toBe(true);
      expect(result.every(item => item.prompt.includes(IMAGE_PROMPT_TEXT.referenceRolesPresentation))).toBe(true);
    }
  });

  it('geração do deck e "Regenerar imagem" (também no lote) mandam o kit inteiro e o deck para as cenas', () => {
    const source = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
    expect(source).not.toContain('presentationStyleKitForSlide');
    expect(source).not.toContain('imageKit');
    expect(source).toContain('const baseRefs = await runAIJob(() => resolveImageReferences(styleKit, generationSnap.refImage,');
    expect(source).toContain('const baseRefs = await resolveImageReferences(styleKit, newSlides[i]?.refImage,');
    expect(source).toContain("deckSlides: fmt === 'apresentacao' || isFreeSocialSlide(generationSnap) ? liveSlides : null,");
    expect(source).toContain('deckSlides: isPresentationGeneration || isSocialFreeGeneration ? newSlides : null,');
  });
});

describe('Spec 1.1 referência: só o visual, nunca o assunto nem a composição', () => {
  const NUNCA = ['people', 'faces', 'clothing', 'objects', 'framing', 'composition', 'scene'];

  it('com estilo escrito + referência (caso Apoteose): bloco de referência obrigatório, sem "composition" para o moodboard', () => {
    const { prompt } = promptFor(deckV1, 2);
    expect(prompt).toContain('PROJECT OR SLIDE STYLE:');
    expect(prompt).toContain(apoteose.styleKit.stylePrompt);
    expect(prompt).toContain(IMAGE_PROMPT_TEXT.styleReferenceLook);
    for (const word of NUNCA) expect(IMAGE_PROMPT_TEXT.styleReferenceLook).toMatch(new RegExp(`Never copy[^.]*\\b${word}\\b`));
    // O texto antigo mandava copiar a composição do moodboard.
    expect(prompt).not.toContain(IMAGE_PROMPT_TEXT.referenceRoles);
    expect(prompt).not.toMatch(/moodboard images (?:only )?for (?:(?!never)[^.])*composition/i);
    expect(IMAGE_PROMPT_TEXT.referenceRolesPresentation).toMatch(/never for [^.]*composition/);
    // Com a referência, a luz da família não disputa com ela.
    expect(prompt).not.toContain('VISUAL TREATMENT');
  });

  it('sem estilo escrito: o mesmo bloco, e o visual da referência manda sobre cor e luz citadas no resto', () => {
    const { prompt } = promptFor(deckV1, 4, { refImages: kit.refImages });
    expect(prompt).not.toContain('PROJECT OR SLIDE STYLE:');
    expect(prompt).toContain(IMAGE_PROMPT_TEXT.styleReferenceLook);
    expect(prompt).toContain(IMAGE_PROMPT_TEXT.styleReferenceOverride);
    expect(prompt).not.toContain(IMAGE_PROMPT_TEXT.moodboardOnly);
  });

  it('o bloco é obrigatório: num pedido apertado, cede o resto antes dele', () => {
    const direction = composeImageDirection({ styleKit: kit, slide: deckV2[2], fmt: 'apresentacao', baseReferenceCount: 1, presentationPanel: true, deckSlides: deckV2, slideIndex: 2 });
    const plan = buildImagePrompt({ scene: deckV2[2].imageQuery, ...direction, avoid: Array.from({ length: 8 }, (_, i) => `${'x'.repeat(230)} ${i}`) }, { route: 'sjinn', limit: 2200 });
    expect(plan.chars).toBeLessThanOrEqual(2200);
    expect(plan.prompt).toContain(IMAGE_PROMPT_TEXT.styleReferenceLook);
    expect(plan.dropped).not.toContain('styleReference');
  });
});

describe('Spec 1.1 referência: cenas dos outros slides para não repetir', () => {
  it('cada slide do roteiro v2 recebe as cenas de até 5 outros slides, curtas, sem a própria', () => {
    const { prompt, direction } = promptFor(deckV2, 2);
    expect(prompt).toContain(IMAGE_PROMPT_TEXT.otherScenesHeader);
    expect(direction.otherScenes).toHaveLength(5);
    expect(direction.otherScenes.every(scene => scene.length <= 120)).toBe(true);
    expect(direction.otherScenes.some(scene => scene.startsWith(subjects[2]))).toBe(false);
    // As mais próximas primeiro na escolha; no pedido, na ordem do deck.
    expect(direction.otherScenes.map(scene => subjects.findIndex(subject => scene.startsWith(subject)))).toEqual([0, 1, 3, 4, 5]);
    const bloco = prompt.slice(prompt.indexOf(IMAGE_PROMPT_TEXT.otherScenesHeader)).split('\n\n')[0].split('\n');
    expect(bloco.slice(1)).toEqual(direction.otherScenes.map(scene => `- ${scene}`));
  });

  it('slide sem cena (dados) não entra na lista dos outros; cena igual à do slide também não', () => {
    const deck = structuredClone(deckV2);
    deck[1].presentationPlan.scene = { ...deck[2].presentationPlan.scene };
    const scenes = presentationOtherScenes(deck, 7);
    expect(scenes.some(scene => scene.startsWith(subjects[8]))).toBe(false);
    expect(presentationOtherScenes(deck, 2).some(scene => scene.startsWith(subjects[2]))).toBe(false);
  });

  it('cena longa é resumida em fim de palavra até 120 caracteres', () => {
    const deck = structuredClone(deckV2);
    deck[0].presentationPlan.scene = { subject: 'a '.repeat(70).trim(), action: 'b', setting: 'c', shot: 'wide' };
    const [primeira] = presentationOtherScenes(deck, 1);
    expect(primeira.length).toBeLessThanOrEqual(120);
    expect(primeira.endsWith(' ')).toBe(false);
  });

  it('deck sem roteiro v2 não muda: sem cenas dos outros no pedido', () => {
    expect(deckV1.map((_, index) => presentationOtherScenes(deckV1, index))).toEqual(deckV1.map(() => []));
    expect(deckV1.map((_, index) => promptFor(deckV1, index).prompt.includes('OTHER SLIDES'))).toEqual(deckV1.map(() => false));
  });
});

describe('Spec 1.1 referência: o que não muda', () => {
  it('referência com @rótulo (papel declarado) continua como está', () => {
    const labeled = { refImages: [{ id: 'marta', name: 'marta.jpg', mention: 'marta', dataUrl: 'data:image/png;base64,BBBB' }] };
    const { prompt } = promptFor(deckV2, 3, labeled);
    expect(prompt).toContain('@marta = image 1 (moodboard)');
    expect(prompt).toContain(IMAGE_PROMPT_TEXT.referenceRoles);
    expect(prompt).not.toContain(IMAGE_PROMPT_TEXT.styleReferenceLook);
  });

  it('referência do próprio slide substitui o moodboard: sem bloco de estilo da referência', async () => {
    const slide = { ...deckV2[4], imageReferences: [{ id: 'r1', mention: 'produto', dataUrl: 'data:image/png;base64,CCCC' }] };
    expect(await resolveImageReferences(kit, null, null, slide.imageReferences)).toEqual(['data:image/png;base64,CCCC']);
    const deck = deckV2.map((item, index) => (index === 4 ? slide : item));
    const { prompt } = promptFor(deck, 4);
    expect(prompt).toContain('@produto = image 1 (subject)');
    expect(prompt).not.toContain(IMAGE_PROMPT_TEXT.styleReferenceLook);
  });

  it('carrossel não muda: moodboard e papéis com o texto de antes, sem cenas dos outros', () => {
    const direction = composeImageDirection({ styleKit: { refImages: kit.refImages }, slide: { imageQuery: 'bakery' }, fmt: 'carrossel', baseReferenceCount: 1, deckSlides: deckV2, slideIndex: 0 });
    expect(direction).not.toHaveProperty('otherScenes');
    expect(direction.styleReferenceLook).toBeFalsy();
    const { prompt } = buildImagePrompt({ scene: 'bakery', ...direction }, { route: 'sjinn' });
    expect(prompt).toContain(IMAGE_PROMPT_TEXT.referenceRoles);
    expect(prompt).toContain(IMAGE_PROMPT_TEXT.moodboardOnly);
    expect(prompt).not.toContain(IMAGE_PROMPT_TEXT.styleReferenceLook);
  });
});

describe('Spec 1.1 referência: orçamento com o deck Apoteose em todos os slides', () => {
  const palavras = (n, semente) => `${semente} ${'tone '.repeat(Math.ceil(n / 5))}`.slice(0, n).trim();
  const deckDaEstrutura = ({ campo, avoid, regras }) => {
    const plan = {
      schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
      evidence: [],
      rules: Array.from({ length: regras.n }, (_, i) => ({ id: `r${i + 1}`, level: 'avoid', target: 'image', instruction: palavras(regras.chars, `rule${i}`) })),
      slides: estrutura.slides.map((slide, index) => ({
        index: index + 1, visualRole: slide.visualRole, purpose: slide.purpose, question: 'q', keyMessage: 'k', evidenceIds: [],
        scene: slide.foto ? Object.fromEntries(['subject', 'action', 'setting', 'shot'].map(key => [key, palavras(campo, `${key}${index}`)])) : null,
        avoid: palavras(avoid, `avoid${index}`),
      })),
    };
    return attachPresentationPlan({ slides: estrutura.slides.map(() => ({ title: 't' })) }, plan).slides;
  };

  it('cena 4×80 e avoid 120 (teto que o roteiro pede) com 3 rules de imagem de 160: tudo cabe, sem corte nenhum', () => {
    const deck = deckDaEstrutura({ campo: 80, avoid: 120, regras: { n: 3, chars: 160 } });
    deck.forEach((slide, index) => {
      if (!slide.imageQuery) return;
      const plan = promptFor(deck, index);
      expect(plan.chars).toBeLessThanOrEqual(4000);
      expect(imagePromptCutMessage(plan)).toBe('');
      expect(plan.prompt).toContain(IMAGE_PROMPT_TEXT.styleReferenceLook);
      expect(plan.prompt).toContain(IMAGE_PROMPT_TEXT.referenceRolesPresentation);
      expect(plan.prompt).toContain(IMAGE_PROMPT_TEXT.otherScenesHeader);
      expect(plan.dropped).toEqual([]);
      expect(plan.trimmed).toEqual([]);
    });
  });

  it('8 rules de imagem de 160: o AVOID do usuário fica inteiro; as cenas dos outros cedem linhas inteiras ou saem, sem aviso', () => {
    const deck = deckDaEstrutura({ campo: 80, avoid: 120, regras: { n: 8, chars: 160 } });
    deck.forEach((slide, index) => {
      if (!slide.imageQuery) return;
      const plan = promptFor(deck, index);
      expect(plan.chars).toBeLessThanOrEqual(4000);
      expect(imagePromptCutMessage(plan)).toBe('');
      expect(plan.prompt).toContain(IMAGE_PROMPT_TEXT.styleReferenceLook);
      expect([...plan.dropped, ...plan.trimmed].every(key => key === 'otherScenes')).toBe(true);
    });
    const parts = { scene: 'a', format: 'presentation', styleBody: 'flat illustration', otherScenes: ['first scene here', 'second scene here', 'third scene here'] };
    const inteiro = buildImagePrompt(parts, { route: 'sjinn' });
    const apertado = buildImagePrompt(parts, { route: 'sjinn', limit: inteiro.chars - '\n- third scene here'.length });
    expect(apertado.trimmed).toEqual(['otherScenes']);
    expect(apertado.prompt).toContain('- second scene here');
    expect(apertado.prompt).not.toContain('third scene');
  });

  it('no limite do contrato (cena 4×160, avoid 200): a referência nunca sai e o pedido cabe na rota', () => {
    const deck = deckDaEstrutura({ campo: 160, avoid: 200, regras: { n: 8, chars: 240 } });
    deck.forEach((slide, index) => {
      if (!slide.imageQuery) return;
      const plan = promptFor(deck, index);
      expect(plan.chars).toBeLessThanOrEqual(4000);
      expect(plan.prompt).toContain(IMAGE_PROMPT_TEXT.styleReferenceLook);
      expect(plan.prompt).toContain(`SCENE: ${slide.imageQuery}`);
    });
  });
});
