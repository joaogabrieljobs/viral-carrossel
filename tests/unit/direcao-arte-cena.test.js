// Direção de arte das imagens (docs/product/direcao-de-arte-imagens.md), parte 2:
// a cena de cada slide vira briefing de foto (casting, figurino, ação,
// expressão, luz pela paleta do deck, grafismos e plano), retrocompatível com
// subject/action/setting/shot.
import { describe, expect, it } from 'vitest';
import {
  PRESENTATION_PLAN_PROMPT_VERSION, PRESENTATION_PLAN_SCHEMA_VERSION, PRESENTATION_SCENE_BRIEF_FIELDS,
  PRESENTATION_SCENE_FIELDS, PRESENTATION_SCENE_LIMITS, attachPresentationPlan, auditPresentationPlanScenes,
  buildPresentationPlanPrompt, coercePresentationPlanShape, presentationSceneQuery, validatePresentationPlan,
} from '../../src/utils/presentation-plan.js';

const SRC = [{ id: 's1', title: 'Fonte', text: 'A festa reúne convidados da música e da moda.' }];

export const CENA_CAPA = Object.freeze({
  subject: 'adult Afro-Brazilian woman in her thirties, editorial fashion close-up, large translucent sculptural glasses',
  wardrobe: 'translucent amber glasses, small gold hoops',
  action: 'turns her gaze to the left of the frame',
  expression: 'presence and confidence',
  setting: 'dark studio backdrop',
  light: 'intense orange light on the face, deep indigo shadows, visible skin texture',
  graphics: 'cyan organic leaf strokes on the right edge and a small area of the cheek; a few acid green dots top right',
  shot: 'close-up',
});

const plano = (scene) => ({
  schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
  objective: 'Apresentar a festa', audience: 'Convidados', thesis: 'A festa é o ápice', rules: [], evidence: [], gaps: [],
  slides: [0, 1].map(i => ({
    index: i + 1, visualRole: i ? 'closing' : 'cover', purpose: i ? 'decision' : 'introduction', question: 'Pergunta?', keyMessage: 'Mensagem.',
    evidenceIds: [], scene: i ? { subject: 'friends laughing', action: 'leaning in', setting: 'rooftop', shot: 'medium' } : scene, avoid: '',
  })),
});
const check = (raw) => validatePresentationPlan(coercePresentationPlanShape(raw, { count: 2 }), { count: 2, sources: SRC });

describe('cena como briefing: campos e limites', () => {
  it('os campos novos entram em ordem de pedido; os quatro antigos continuam', () => {
    expect(PRESENTATION_SCENE_FIELDS).toEqual(['subject', 'action', 'setting', 'shot']);
    expect(PRESENTATION_SCENE_BRIEF_FIELDS).toEqual(['subject', 'wardrobe', 'action', 'expression', 'setting', 'light', 'graphics', 'shot']);
    expect(PRESENTATION_SCENE_LIMITS).toEqual({ subject: 240, wardrobe: 160, action: 160, expression: 120, setting: 160, light: 160, graphics: 160, shot: 80 });
  });

  it('plano com a cena completa é válido e guarda os campos novos', () => {
    const result = check(plano({ ...CENA_CAPA }));
    expect(result.errors).toEqual([]);
    expect(result.plan.slides[0].scene).toEqual(CENA_CAPA);
  });

  it('cena antiga (subject/action/setting/shot) continua válida e não ganha chaves', () => {
    const result = check(plano({ subject: 'crowd', action: 'dancing', setting: 'club', shot: 'wide' }));
    expect(result.valid).toBe(true);
    expect(Object.keys(result.plan.slides[0].scene)).toEqual(['subject', 'action', 'setting', 'shot']);
  });

  it('campos novos vazios não ficam no roteiro; o coerce corta cada campo no seu limite', () => {
    const coerced = coercePresentationPlanShape(plano({ ...CENA_CAPA, wardrobe: '', expression: '   ', light: 'orange '.repeat(60) }), { count: 2 });
    const scene = coerced.slides[0].scene;
    expect(scene).not.toHaveProperty('wardrobe');
    expect(scene).not.toHaveProperty('expression');
    expect(scene.light.length).toBeLessThanOrEqual(160);
    expect(check(plano({ ...CENA_CAPA, wardrobe: '' })).plan.slides[0].scene).not.toHaveProperty('wardrobe');
  });

  it('sem coerce, campo desconhecido, texto longo ou sujeito vazio recusam a cena', () => {
    const strict = scene => validatePresentationPlan(plano(scene), { count: 2, sources: SRC }).issues;
    expect(strict({ ...CENA_CAPA, mood: 'x' })).toContainEqual({ code: 'slide_scene', path: 'slides[0].scene' });
    expect(strict({ ...CENA_CAPA, expression: 'x'.repeat(121) })).toContainEqual({ code: 'slide_scene', path: 'slides[0].scene' });
    expect(strict({ ...CENA_CAPA, subject: '' })).toContainEqual({ code: 'slide_scene', path: 'slides[0].scene' });
    expect(strict({ subject: 'crowd', shot: 'wide' })).toEqual([]);
  });

  it('o pedido de imagem montado da cena segue a ordem do briefing; a cena antiga monta igual a antes', () => {
    expect(presentationSceneQuery({ subject: 'crowd', action: 'dancing', setting: 'club', shot: 'wide' })).toBe('crowd, dancing, club, wide');
    expect(presentationSceneQuery(CENA_CAPA)).toBe(PRESENTATION_SCENE_BRIEF_FIELDS.map(key => CENA_CAPA[key]).join(', '));
  });

  it('attachPresentationPlan leva a cena completa ao slide e à imageQuery', () => {
    const { plan } = check(plano({ ...CENA_CAPA }));
    const draft = attachPresentationPlan({ slides: [{ title: 'Apoteose' }, { title: 'Fim' }] }, plan);
    expect(draft.slides[0].presentationPlan.scene).toEqual(CENA_CAPA);
    expect(draft.slides[0].imageQuery).toBe(presentationSceneQuery(CENA_CAPA));
  });

  it('a conferência de cena repetida e negada vê os campos novos', () => {
    const { plan } = check(plano({ ...CENA_CAPA }));
    plan.slides[0].keyMessage = 'A festa, sem confete.';
    plan.slides[0].scene.graphics = 'confetti bursts on the right edge';
    expect(auditPresentationPlanScenes(plan)).toContainEqual({ code: 'scene_negated_element', path: 'slides[0].scene' });
  });
});

describe('cena como briefing: o pedido do roteiro', () => {
  const prompt = buildPresentationPlanPrompt({ brief: 'Festa', sources: SRC, count: 6 });

  it('pede casting com diversidade e sem estereótipo, figurino, expressão, luz pela paleta e grafismos do slide', () => {
    expect(prompt).toContain('scene é o briefing da foto, em inglês');
    expect(prompt).toContain('casting');
    expect(prompt).toContain('diversidade de idade adulta, tom de pele, corpo e gênero entre os slides, sem estereótipo');
    expect(prompt).toContain('wardrobe (figurino');
    expect(prompt).toContain('expression (expressão e atitude');
    expect(prompt).toContain('light (a luz pela paleta de visualDirection');
    expect(prompt).toContain('graphics (os grafismos deste slide');
  });

  it('proíbe pessoa real, marca e texto na imagem', () => {
    expect(prompt).toContain('Personagens originais: nunca uma pessoa real, celebridade ou alguém da imagem de referência; nenhuma marca, logotipo, texto legível ou tela com informação.');
  });

  it('limites por campo e contrato com os campos novos', () => {
    expect(prompt).toContain('subject até 200 caracteres; wardrobe, action, setting, light e graphics até 120; expression e shot até 60');
    expect(prompt).toContain('"scene":{"subject":"who or what","wardrobe":"","action":"what happens","expression":"","setting":"where","light":"","graphics":"","shot":"wide"}');
  });
});
