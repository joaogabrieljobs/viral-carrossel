import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  PRESENTATION_PLAN_PROMPT_VERSION, PRESENTATION_PLAN_SCHEMA_VERSION, PRESENTATION_PLAN_V1,
  attachPresentationPlan, auditPresentationPlanScenes, buildPresentationPlanBlock, buildPresentationPlanPrompt,
  coercePresentationPlanShape, negatedPlanElements, presentationPlanEntryImageQuery, presentationPlanSchema, validatePresentationPlan,
} from '../../src/utils/presentation-plan.js';
import { generatePresentationPlan } from '../../src/utils/presentation-planning.js';
import { composeImageDirection, presentationStyleKitForSlide } from '../../src/utils/image-direction.js';
import { buildImagePrompt } from '../../shared/image-prompt.js';
import { imagePromptCutMessage } from '../../src/utils/image-prompt-budget.js';
import { repairRenderedPresentation } from '../../src/utils/presentation-render-review.js';

// Spec 1.1, entrega 1 (roteiro v2). Na Apoteose real o roteiro pedia a imagem
// numa frase solta (imageBrief), sem lugar para o que o briefing proíbe ("não
// como representação literal de fantasias, plumas e confetes", "evitando os
// clichês visuais do Carnaval"), e nada impedia o mesmo sujeito no mesmo plano
// em vários slides: a mesma mulher de máscara saiu em 7 de 10.
const apoteose = JSON.parse(readFileSync(new URL('../fixtures/apoteose.json', import.meta.url), 'utf8'));
const planV1 = () => structuredClone(apoteose.presentationPlan);
const sources = [{ id: 'source-base', text: apoteose.presentationPlan.evidence.map(item => item.quote).join('\n') }];
const sha = text => createHash('sha256').update(text).digest('hex').slice(0, 16);

// A Apoteose escrita no contrato v2, com o erro real: a mesma mulher de
// máscara em close nos slides 3 a 6 e fantasia no slide "não como fantasia".
const subjects = ['city skyline', 'friends toasting', 'confetti-free dance floor', 'street musicians', 'vinyl records on a mixer', 'stylish crowd in line', 'graphic tropical prints', 'rooftop garden', 'empty table', 'guests leaving at sunrise'];
const mask = { subject: 'woman in golden carnival mask', action: 'looking at the camera', setting: 'night party with colored lights', shot: 'close-up' };
const planV2 = () => {
  const plan = planV1();
  plan.schemaVersion = PRESENTATION_PLAN_SCHEMA_VERSION;
  plan.promptVersion = PRESENTATION_PLAN_PROMPT_VERSION;
  plan.rules = [
    { id: 'r1', level: 'avoid', target: 'image', instruction: 'clichês visuais do Carnaval: fantasias, plumas e confetes literais' },
    { id: 'r2', level: 'required', target: 'copy', instruction: 'humor inteligente, sem humor óbvio' },
  ];
  plan.slides = plan.slides.map(({ imageBrief, ...slide }, index) => ({
    ...slide,
    scene: index === 8 ? null : { subject: subjects[index], action: 'talking', setting: 'São Paulo rooftop at dusk', shot: 'wide' },
    avoid: '',
  }));
  plan.slides[3].keyMessage = 'Carnaval como comportamento, não como fantasia.';
  return plan;
};
const withRealMistake = () => {
  const plan = planV2();
  [2, 4, 5, 6].forEach(index => { plan.slides[index].scene = { ...mask }; });
  plan.slides[3].scene = { ...mask, subject: 'woman in feathered fantasy costume' };
  return plan;
};
const check = plan => validatePresentationPlan(plan, { count: 10, sources });

describe('Spec 1.1 entrega 1: contrato do roteiro v2', () => {
  it('o pedido do roteiro pede rules, scene e avoid, e não pede mais imageBrief', () => {
    const prompt = buildPresentationPlanPrompt({ brief: 'Apresentar a festa.', sources, count: 10 });
    expect(PRESENTATION_PLAN_SCHEMA_VERSION).toBe(2);
    expect(PRESENTATION_PLAN_PROMPT_VERSION).toBe('presentation-plan-v2');
    expect(prompt).toContain('{"schemaVersion":2,"promptVersion":"presentation-plan-v2"');
    expect(prompt).toContain('"rules":[{"id":"r1","level":"avoid","target":"image"');
    expect(prompt).toContain('"scene":{"subject":"who or what","action":"what happens","setting":"where","shot":"wide"},"avoid":""}');
    expect(prompt).toContain('a mesma combinação subject + shot aparece em no máximo 2 posições');
    expect(prompt).toContain('esse elemento vai para avoid e nunca para scene');
    expect(prompt).not.toContain('imageBrief');
  });

  it('aceita o plano v2 e guarda rules, scene e avoid', () => {
    const result = check(planV2());
    expect(result.errors).toEqual([]);
    expect(result.plan.rules).toHaveLength(2);
    expect(result.plan.slides[0]).toMatchObject({ scene: { shot: 'wide' }, avoid: '' });
    expect(result.plan.slides[8].scene).toBeNull();
    expect(result.plan.slides[0]).not.toHaveProperty('imageBrief');
  });

  it('recusa no v2 o imageBrief solto, regra fora da lista e cena sem sujeito', () => {
    const loose = planV2(); loose.slides[1].imageBrief = 'a party';
    expect(check(loose).issues).toContainEqual({ code: 'unknown_field', path: 'slides[1]' });
    const rule = planV2(); rule.rules[0].level = 'maybe';
    expect(check(rule).issues).toContainEqual({ code: 'rule_kind', path: 'rules[0]' });
    const scene = planV2(); scene.slides[1].scene = { subject: '', action: 'dancing', setting: 'street', shot: 'wide' };
    expect(check(scene).issues).toContainEqual({ code: 'slide_scene', path: 'slides[1].scene' });
    const missing = planV2(); delete missing.slides[1].scene;
    expect(check(coercePresentationPlanShape(missing, { count: 10 })).issues).toContainEqual({ code: 'slide_scene', path: 'slides[1].scene' });
  });

  it('versão mista ou desconhecida não passa', () => {
    expect(presentationPlanSchema({ schemaVersion: 2, promptVersion: 'presentation-plan-v1' })).toBe(0);
    expect(presentationPlanSchema({ schemaVersion: 3, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION })).toBe(0);
    expect(presentationPlanSchema(PRESENTATION_PLAN_V1)).toBe(1);
  });
});

describe('Spec 1.1 entrega 1: plano v1 salvo continua abrindo e gerando igual', () => {
  it('o roteiro v1 real da Apoteose é válido e o bloco da redação não muda', () => {
    const result = check(planV1());
    expect(result.errors).toEqual([]);
    expect(presentationPlanSchema(result.plan)).toBe(1);
    expect(auditPresentationPlanScenes(result.plan)).toEqual([]);
    expect(buildPresentationPlanBlock(result.plan)).toContain('Atribua a imagem apenas quando imageBrief contribuir; imagem não substitui informação. Não insira o plano no JSON final.');
  });

  // Spec 1.1 (referência): este teste mudou de propósito. A referência do kit
  // sem papel passou a ir só na capa e no fecho; os pedidos 1 e 10 continuam
  // iguais aos de antes do roteiro v2, os 2 a 9 mudam (sem anexo, com o estilo
  // escrito e a família).
  it('os 10 pedidos de imagem do v1 real: capa e fecho iguais aos de antes, 2 a 9 sem a referência', () => {
    const draft = attachPresentationPlan({ slides: apoteose.slides.map(({ presentationComposition, ...slide }) => slide) }, planV1());
    // O slide 9 tem bloco de métricas: a redação tira a imagem depois; aqui vale o imageBrief.
    expect(draft.slides.map(slide => slide.imageQuery)).toEqual(apoteose.slides.map((slide, index) => slide.imageQuery || apoteose.presentationPlan.slides[index].imageBrief));
    expect(draft.slides[3].presentationPlan).toMatchObject({ imageBrief: apoteose.presentationPlan.slides[3].imageBrief });
    expect(draft.slides[3].presentationPlan).not.toHaveProperty('scene');
    const prompts = draft.slides.map((slide) => {
      const styleKit = presentationStyleKitForSlide(apoteose.styleKit, draft.slides, draft.slides.indexOf(slide));
      const direction = composeImageDirection({ styleKit, slide, fmt: 'apresentacao', baseReferenceCount: styleKit.refImages.length, presentationPanel: true, presentationFamily: 'presentation_cinematic' });
      expect(direction).not.toHaveProperty('avoid');
      return buildImagePrompt({ scene: slide.imageQuery, ...direction }, { route: 'sjinn' }).prompt;
    });
    expect(prompts.some(prompt => prompt.includes('AVOID'))).toBe(false);
    expect(prompts.map(sha)).toEqual(apoteose.imagePromptsV1.sha);
    const before = apoteose.imagePromptsV1.shaAntesDaReferencia;
    expect(prompts.map(sha).map((value, index) => value === before[index])).toEqual([true, false, false, false, false, false, false, false, false, true]);
  });

  it('a imagem planejada da posição v1 continua vindo do imageBrief', () => {
    expect(presentationPlanEntryImageQuery(planV1().slides[0])).toBe(apoteose.presentationPlan.slides[0].imageBrief);
    expect(presentationPlanEntryImageQuery(planV2().slides[8])).toBe('');
  });

  it('o reparo do slide renderizado aceita o plano v1 e o v2', async () => {
    const slides = apoteose.slides.map((slide, index) => ({ ...slide, id: `s${index}` }));
    const issues = [{ code: 'render-overflow', slideIndex: 1 }];
    for (const plan of [check(planV1()).plan, check(planV2()).plan]) {
      const ai = vi.fn().mockResolvedValue({ edits: [] });
      await repairRenderedPresentation({ slides, plan, issues }, ai);
      expect(ai).toHaveBeenCalledTimes(1);
    }
  });
});

describe('Spec 1.1 entrega 1: validação da cena em código', () => {
  it('Apoteose escrita no v2 com o erro real: sujeito e plano repetidos e fantasia na cena que a nega', () => {
    expect(negatedPlanElements('Carnaval como comportamento, não como fantasia.')).toEqual(['fantasia']);
    expect(auditPresentationPlanScenes(check(withRealMistake()).plan)).toEqual([
      { code: 'scene_negated_element', path: 'slides[3].scene' },
      { code: 'scene_repeated', path: 'slides[5].scene' },
      { code: 'scene_repeated', path: 'slides[6].scene' },
    ]);
  });

  it('o mesmo sujeito com o mesmo plano em 2 posições passa; com outro plano, também', () => {
    const plan = planV2();
    [2, 5].forEach(index => { plan.slides[index].scene = { ...mask }; });
    plan.slides[6].scene = { ...mask, shot: 'wide' };
    expect(auditPresentationPlanScenes(check(plan).plan)).toEqual([]);
  });
});

describe('Spec 1.1 entrega 1: a cena reprovada usa o reparo do roteiro que já existe', () => {
  const run = ai => generatePresentationPlan({ brief: 'Apresentar a festa.', sources, count: 10 }, ai);

  it('uma tentativa de reparo, com o código do problema; o plano corrigido segue', async () => {
    const ai = vi.fn().mockResolvedValueOnce(withRealMistake()).mockResolvedValueOnce(planV2());
    const output = await run(ai);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(ai.mock.calls[1][0]).toContain('RECUPERAÇÃO LIMITADA DO PLANEJAMENTO');
    expect(ai.mock.calls[1][0]).toContain('{"code":"scene_repeated","path":"slides[5].scene"}');
    expect(ai.mock.calls[1][0]).toContain('scene_negated_element: a cena mostra o que a keyMessage da posição nega');
    expect(output.plan.slides[3].scene.subject).toBe('street musicians');
  });

  it('reparo que volta com o mesmo problema não gasta outra chamada nem derruba a geração', async () => {
    const ai = vi.fn().mockResolvedValue(withRealMistake());
    const output = await run(ai);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(output.plan.slides[3].scene.subject).toBe('woman in feathered fantasy costume');
    expect(output.diagnostics.at(-1)).toMatchObject({ outcome: 'validated', sceneIssues: expect.any(Array) });
  });

  it('reparo inválido ou fora do ar mantém o primeiro roteiro, que era válido', async () => {
    const broken = vi.fn().mockResolvedValueOnce(withRealMistake()).mockResolvedValueOnce({ schemaVersion: 2 });
    expect((await run(broken)).plan.slides[2].scene.subject).toBe(mask.subject);
    const down = vi.fn().mockResolvedValueOnce(withRealMistake()).mockRejectedValueOnce(Object.assign(new Error('fora do ar'), { status: 503 }));
    expect((await run(down)).diagnostics.at(-1).outcome).toBe('repair_failed_kept_previous');
  });
});

describe('Spec 1.1 entrega 1: imagem montada a partir da cena, com bloco AVOID', () => {
  const attached = () => {
    const plan = check(planV2()).plan;
    plan.slides[3].avoid = 'carnival costumes, feathers, masks';
    return attachPresentationPlan({ slides: apoteose.slides.map(slide => ({ title: slide.title, imageQuery: 'writer query ignored' })) }, plan);
  };

  it('attachPresentationPlan monta imageQuery da cena e leva avoid e rules de imagem ao slide', () => {
    const slides = attached().slides;
    expect(slides[3].imageQuery).toBe('street musicians, talking, São Paulo rooftop at dusk, wide');
    expect(slides[8].imageQuery).toBe('');
    expect(slides[3].presentationPlan).toMatchObject({
      avoid: 'carnival costumes, feathers, masks',
      imageRules: ['clichês visuais do Carnaval: fantasias, plumas e confetes literais'],
      scene: { shot: 'wide' },
    });
  });

  it('o pedido de imagem traz o bloco AVOID com a regra do briefing e o avoid do slide', () => {
    const slide = attached().slides[3];
    const direction = composeImageDirection({ styleKit: apoteose.styleKit, slide, fmt: 'apresentacao', baseReferenceCount: 1, presentationPanel: true, presentationFamily: 'presentation_cinematic' });
    const { prompt, dropped, trimmed } = buildImagePrompt({ scene: slide.imageQuery, ...direction }, { route: 'sjinn' });
    expect(prompt).toContain('AVOID (from the brief and this slide plan; keep these out of the image):\n- clichês visuais do Carnaval: fantasias, plumas e confetes literais\n- carnival costumes, feathers, masks');
    expect([dropped, trimmed]).toEqual([[], []]);
  });

  it('o AVOID entra no orçamento: cortado, aparece no aviso que já existe', () => {
    const avoid = ['clichês visuais do Carnaval: fantasias, plumas e confetes literais', 'carnival costumes, feathers, masks'];
    const at = limit => buildImagePrompt({ scene: 'guests at a rooftop', format: 'presentation', avoid }, { limit });
    const touched = result => result.trimmed.includes('avoid') || result.dropped.includes('avoid');
    // Os blocos opcionais saem antes; o primeiro corte do AVOID tira a última linha inteira.
    let limit = at(0).chars;
    while (limit > 0 && !touched(at(limit))) limit -= 1;
    const trimmed = at(limit);
    expect(trimmed.trimmed).toContain('avoid');
    expect(trimmed.prompt).toContain('- clichês visuais do Carnaval');
    expect(trimmed.prompt).not.toContain('- carnival costumes');
    expect(imagePromptCutMessage(trimmed)).toBe('O pedido desta imagem não coube inteiro no gerador do plano. Reduzido: o que a imagem deve evitar.');
    while (limit > 0 && !at(limit).dropped.includes('avoid')) limit -= 1;
    const dropped = at(limit);
    expect(dropped.prompt).not.toContain('AVOID');
    expect(imagePromptCutMessage(dropped)).toContain('Fora do pedido: o que a imagem deve evitar.');
  });

  it('carrossel e card sem roteiro v2 não ganham bloco AVOID', () => {
    const slide = attached().slides[3];
    expect(composeImageDirection({ slide, fmt: 'carrossel' })).not.toHaveProperty('avoid');
    expect(buildImagePrompt({ scene: 'a bakery', format: 'carousel' }).prompt).not.toContain('AVOID');
  });
});
