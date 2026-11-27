import { describe, expect, it } from 'vitest';
import {
  PRESENTATION_PLAN_PROMPT_VERSION, PRESENTATION_PLAN_SCHEMA_VERSION,
  PRESENTATION_SCENE_BRIEF_FIELDS, PRESENTATION_SCENE_LIMITS,
  buildPresentationPlanPrompt, validatePresentationPlan,
} from '../../src/utils/presentation-plan.js';
import { buildSocialFreePrompt } from '../../src/utils/social-free-prompt.js';

const sources = [{ id: 'source-1', title: 'Oficina', text: 'Uma oficina de cerâmica apresenta materiais e processos.' }];
const input = { brief: sources[0].text, sources, count: 2 };
const builders = [
  ['apresentação Livre', () => buildPresentationPlanPrompt({ ...input, freeDesign: true })],
  ['carrossel Livre', () => buildSocialFreePrompt({ formato: 'carrossel' })],
];

describe.each(builders)('novo planejamento com decisões visíveis: %s', (_name, build) => {
  it('liga uma decisão visual distintiva à função editorial e ao briefing', () => {
    const prompt = build();
    expect(prompt).toMatch(/uma decisão visual distintiva[^\n]*função editorial[^\n]*briefing/i);
    expect(prompt).toMatch(/adjetivos[^\n]*não substituem[^\n]*decisões/i);
  });

  it('pede gesto ou instante observável, expressão e direção do olhar', () => {
    const prompt = build();
    expect(prompt).toMatch(/action:[^\n]*gesto físico[^\n]*instante observável/i);
    expect(prompt).toMatch(/expression:[^\n]*expressão[^\n]*direção do olhar/i);
  });

  it('pede materiais relevantes sem transformar toda cena em retrato humano', () => {
    const prompt = build();
    expect(prompt).toMatch(/wardrobe:[^\n]*material[^\n]*quando relevante/i);
    if (_name === 'apresentação Livre') {
      // A experiência pode ser o próprio assunto visual. A regra nova não
      // restringe fotografia a mera ilustração, nem impõe pessoas a outros temas.
      expect(prompt).toMatch(/briefing[^\n]*experiência[^\n]*pessoas[^\n]*comportamento[^\n]*gestos[^\n]*interações/i);
      expect(prompt).toMatch(/subject:[^\n]*dados, arquitetura ou produto[^\n]*não acrescente pessoas por padrão/i);
      expect(prompt).toMatch(/"no people"[^\n]*só por restrição explícita ou necessidade da cena/i);
    } else {
      expect(prompt).toMatch(/subject:[^\n]*objetos[^\n]*pessoas só quando/i);
    }
    expect(prompt).toMatch(/campos sem aplicação[^\n]*""/i);
  });

  it('descreve fonte e direção da luz pela paleta, preservando acabamento clean', () => {
    const prompt = build();
    expect(prompt).toMatch(/light:[^\n]*fonte[^\n]*direção[^\n]*paleta/i);
    expect(prompt).toMatch(/respeite[^\n]*acabamento[^\n]*sem grão/i);
    expect(prompt).toMatch(/não imponha[^\n]*luz saturada/i);
  });

  it('descreve perspectiva e profundidade sem câmera ou lente obrigatória', () => {
    const prompt = build();
    expect(prompt).toMatch(/setting:[^\n]*primeiro plano[^\n]*fundo/i);
    expect(prompt).toMatch(/shot:[^\n]*ponto de vista[^\n]*profundidade/i);
    expect(prompt).toMatch(/sem[^\n]*lente[^\n]*obrigatóri/i);
  });

  it('separa casting conceitual de fatos e exige recorrência explícita', () => {
    const prompt = build();
    expect(prompt).toMatch(/identidade recorrente[^\n]*somente[^\n]*solicitada[^\n]*planejada/i);
    expect(prompt).toMatch(/ficha[^\n]*não obriga[^\n]*todas as imagens/i);
    expect(prompt).toMatch(/casting[^\n]*locais[^\n]*conceituais[^\n]*não[^\n]*fatos[^\n]*público/i);
  });

  it('resolve ausência de grafismos na foto sem proibir a linguagem do layout', () => {
    const prompt = build();
    expect(prompt).toMatch(/visualDirection\.graphics[^\n]*"none"[^\n]*proíbe[^\n]*grafismos/i);
    expect(prompt).toMatch(/scene\.graphics[^\n]*"none"[^\n]*dentro da imagem/i);
    expect(prompt).toMatch(/layout[^\n]*separad[^\n]*foto/i);
  });
});

describe('guardas do novo contrato de cena', () => {
  it('mantém os mesmos oito campos e os limites de dados existentes', () => {
    expect(PRESENTATION_SCENE_BRIEF_FIELDS).toEqual(['subject', 'wardrobe', 'action', 'expression', 'setting', 'light', 'graphics', 'shot']);
    expect(PRESENTATION_SCENE_LIMITS).toEqual({ subject: 240, wardrobe: 160, action: 160, expression: 120, setting: 160, light: 160, graphics: 160, shot: 80 });
    expect(buildPresentationPlanPrompt({ ...input, freeDesign: true })).toContain('subject até 200 caracteres; wardrobe, action, setting, light e graphics até 120; expression e shot até 60');
  });

  it('uma cena antiga com somente subject continua válida e não recebe dados inventados', () => {
    const scene = { subject: 'A ceramic bowl' };
    const raw = {
      schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
      objective: 'Apresentar a oficina', audience: 'Visitantes', thesis: 'Conhecer materiais e processos', rules: [], evidence: [], gaps: [],
      slides: [0, 1].map(index => ({
        index: index + 1, visualRole: index ? 'closing' : 'cover', purpose: index ? 'decision' : 'introduction',
        question: 'O que conhecer?', keyMessage: 'A oficina apresenta materiais e processos.', evidenceIds: [], scene, avoid: '',
      })),
    };
    const result = validatePresentationPlan(raw, { count: 2, sources });
    expect(result.valid).toBe(true);
    expect(result.plan.slides[0].scene).toEqual({ ...scene, action: '', setting: '', shot: '' });
  });

  it('o pedido de apresentação não Livre não recebe o contrato opt-in', () => {
    expect(buildPresentationPlanPrompt(input)).not.toMatch(/uma decisão visual distintiva/i);
    expect(buildPresentationPlanPrompt({ ...input, freeDesign: false })).toBe(buildPresentationPlanPrompt(input));
  });

  it('o reparo compacto do Livre ainda exige decisões visíveis dentro dos mesmos limites', () => {
    const prompt = buildPresentationPlanPrompt({ ...input, freeDesign: true, compactRepair: true });
    expect(prompt).toMatch(/uma decisão visual distintiva/i);
    expect(prompt).toContain('subject até 200 caracteres; wardrobe, action, setting, light e graphics até 120; expression e shot até 60');
  });
});
