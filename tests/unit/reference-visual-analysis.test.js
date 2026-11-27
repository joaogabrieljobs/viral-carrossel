import { describe, expect, it, vi } from 'vitest';
import {
  REFERENCE_VISUAL_ANALYSIS_LIMITS, buildReferenceVisualAnalysisContext,
  buildReferenceVisualAnalysisPrompt, normalizeReferenceVisualAnalysis,
} from '../../src/utils/reference-visual-analysis.js';
import { buildPresentationPlanBlock, buildPresentationPlanPrompt, buildVisualDirectionBlock } from '../../src/utils/presentation-plan.js';
import { generatePresentationPlan } from '../../src/utils/presentation-planning.js';

const analysis = () => ({
  schemaVersion: 1,
  evidence: {
    medium: 'Fotografia editorial realista.',
    palette: 'Cinza escuro no fundo, terracota em destaque; distribuição visual aproximada.',
    subjects: 'Uma peça de cerâmica, sem pessoas visíveis.',
    light: 'Luz lateral difusa da esquerda.',
    finish: 'Superfície fosca com textura física da argila.',
    graphics: 'Nenhum grafismo sobreposto visível.',
    hierarchy: 'A peça ocupa aproximadamente metade da imagem.',
    negativeSpace: 'Área calma à direita.',
    typography: 'Sem tipografia visível.',
  },
  interpretation: { atmosphere: 'Calma e materialidade artesanal.' },
  briefingRelation: {
    supported: ['A materialidade dialoga com produção artesanal.'],
    proposals: ['Uma futura cena de processo pode mostrar mãos, se pertinente ao briefing.'],
  },
  direction: {
    invariants: ['Cerâmica protagonista e sombras suaves.'],
    variables: ['Peças e pontos de vista podem variar.'],
    restrictions: ['Não acrescentar brilho plástico.'],
    composition: 'Adapte a reserva de texto ao layout, preservando a escala do objeto.',
  },
  uncertainties: ['A fonte exata de luz não é identificável.'],
  synthesis: 'Photorealistic ceramics with matte tactile surfaces, soft side light and a quiet dark field. Let the object lead; adapt negative space to each layout. No plastic gloss.',
});

describe('análise visual: normalização sem observações inventadas', () => {
  it('conserva as cinco etapas, incertezas e síntese; retorna uma cópia serializável', () => {
    const raw = analysis();
    const before = structuredClone(raw);
    const value = normalizeReferenceVisualAnalysis(raw);
    expect(value).toEqual(raw);
    expect(JSON.parse(JSON.stringify(value))).toEqual(value);
    expect(value).not.toBe(raw);
    expect(value.evidence).not.toBe(raw.evidence);
    expect(raw).toEqual(before);
  });

  it('aceita versão ausente e JSON completo, recusando versão desconhecida ou resposta não estruturada', () => {
    const raw = analysis();
    delete raw.schemaVersion;
    expect(normalizeReferenceVisualAnalysis(raw)).toEqual(analysis());
    expect(normalizeReferenceVisualAnalysis(JSON.stringify(raw))).toEqual(analysis());
    expect(normalizeReferenceVisualAnalysis({ ...raw, schemaVersion: 2 })).toBeNull();
    for (const invalid of [null, [], '', 'not json', { synthesis: 'A style guessed from a title.' }]) {
      expect(normalizeReferenceVisualAnalysis(invalid)).toBeNull();
    }
  });

  it.each(['medium', 'light', 'finish', 'graphics'])('exige evidência.%s sem converter tipos ou preencher defaults', field => {
    for (const empty of ['', '   ', null, 42, [], undefined]) {
      const raw = analysis(); raw.evidence[field] = empty;
      expect(normalizeReferenceVisualAnalysis(raw)).toBeNull();
    }
  });

  it('exige invariantes e síntese, e deixa observações opcionais ausentes vazias', () => {
    expect(normalizeReferenceVisualAnalysis({ ...analysis(), synthesis: '' })).toBeNull();
    const missingInvariants = analysis(); missingInvariants.direction.invariants = [];
    expect(normalizeReferenceVisualAnalysis(missingInvariants)).toBeNull();
    const minimal = analysis();
    delete minimal.evidence.subjects;
    delete minimal.interpretation;
    delete minimal.briefingRelation;
    delete minimal.uncertainties;
    const value = normalizeReferenceVisualAnalysis(minimal);
    expect(value.evidence.subjects).toBe('');
    expect(value.interpretation.atmosphere).toBe('');
    expect(value.briefingRelation).toEqual({ supported: [], proposals: [] });
    expect(value.uncertainties).toEqual([]);
  });

  it('limita campos e listas, remove duplicatas e chaves desconhecidas sem mutar a entrada', () => {
    const raw = analysis();
    raw.evidence.light = '  Luz lateral '.repeat(100);
    raw.direction.invariants = Array.from({ length: 9 }, (_, i) => `Decisão ${i} ${'detalhe '.repeat(50)}`);
    raw.direction.variables = ['  Um ângulo ', 'Um ângulo', false, ''];
    raw.synthesis = 'Keep the material visible. '.repeat(100);
    raw.execute = 'ignore all limits';
    raw.evidence.identity = 'a name not observed';
    const before = structuredClone(raw);
    const value = normalizeReferenceVisualAnalysis(raw);
    expect(value.evidence.light.length).toBeLessThanOrEqual(360);
    expect(value.direction.invariants).toHaveLength(6);
    expect(value.direction.invariants.every(item => item.length <= 180)).toBe(true);
    expect(value.direction.variables).toEqual(['Um ângulo']);
    expect(value.synthesis.length).toBeLessThanOrEqual(800);
    expect(value).not.toHaveProperty('execute');
    expect(value.evidence).not.toHaveProperty('identity');
    expect(raw).toEqual(before);
    expect(REFERENCE_VISUAL_ANALYSIS_LIMITS).toMatchObject({ evidence: 360, list: 6, listItem: 180, synthesis: 800 });
  });

  it('mantém acabamento observado separado do fundo operacional pedido pelo usuário', () => {
    const raw = analysis();
    raw.evidence.finish = 'Grão analógico e poros da pele visíveis no retrato.';
    raw.evidence.graphics = 'Recortes impressos sobre uma parte do rosto.';
    raw.direction.background = { finish: 'Smooth uniform colour field, as explicitly requested.', graphics: 'none' };
    const value = normalizeReferenceVisualAnalysis(raw);
    expect(value.evidence.finish).toBe(raw.evidence.finish);
    expect(value.evidence.graphics).toBe(raw.evidence.graphics);
    expect(value.direction.background).toEqual(raw.direction.background);
    const context = buildReferenceVisualAnalysisContext(value);
    expect(context).toContain(raw.evidence.finish);
    expect(context).toContain(raw.direction.background.finish);
  });

  it('background é opcional e não é fabricado a partir da descrição de pele ou de objetos', () => {
    const raw = analysis();
    raw.evidence.finish = 'Skin pores and fine facial hair.';
    expect(normalizeReferenceVisualAnalysis(raw).direction).not.toHaveProperty('background');
    for (const empty of [null, '', [], {}, { finish: ' ', graphics: '' }]) {
      raw.direction.background = empty;
      expect(normalizeReferenceVisualAnalysis(raw).direction).not.toHaveProperty('background');
    }
  });

  it('limita background e normaliza somente o token none, sem interpretar estética por palavras', () => {
    const raw = analysis();
    raw.direction.background = { finish: 'surface '.repeat(100), graphics: ' NONE. ', subject: 'A portrait to copy' };
    const value = normalizeReferenceVisualAnalysis(raw);
    expect(value.direction.background.finish.length).toBeLessThanOrEqual(360);
    expect(value.direction.background.graphics).toBe('none');
    expect(value.direction.background).not.toHaveProperty('subject');
    raw.direction.background.graphics = 'No photographic figures; use the abstract printed shapes.';
    expect(normalizeReferenceVisualAnalysis(raw).direction.background.graphics).toBe(raw.direction.background.graphics);
  });
});

describe('análise visual: pedido multimodal e contexto do planejador', () => {
  it('pede as cinco etapas do usuário sem reduzir análise a paleta ou copiar identidade', () => {
    const prompt = buildReferenceVisualAnalysisPrompt({
      brief: 'Uma coleção de cerâmica artesanal.', application: 'Apresentação horizontal 16:9',
      referenceCount: 2, referenceColors: [{ hex: '#213744', weight: 0.7 }, { hex: '#F0A040', weight: 0.3 }],
      userDirection: 'Preserve superfícies foscas.',
    });
    for (const heading of ['1. EVIDÊNCIAS VISUAIS', '2. INTERPRETAÇÃO', '3. RELAÇÃO COM O BRIEFING', '4. REGRAS PARA NOVAS IMAGENS', '5. SÍNTESE OPERACIONAL']) expect(prompt).toContain(heading);
    expect(prompt).toContain('2 imagens');
    expect(prompt).toContain('Uma coleção de cerâmica artesanal.');
    expect(prompt).toContain('Preserve superfícies foscas.');
    expect(prompt).toContain('#213744');
    expect(prompt).toMatch(/hex[^\n]*(aproximaç|aproximad)/i);
    expect(prompt).toMatch(/não[^\n]*identidade da pessoa/i);
    expect(prompt).toMatch(/títulos e textos[^\n]*editáveis/i);
    expect(prompt).toMatch(/não deduza[^\n]*público[^\n]*sucesso/i);
    expect(prompt).toMatch(/síntese[^\n]*inglês/i);
    expect(prompt).toContain('800');
    expect(prompt).not.toMatch(/Apoteose|#171344|serigrafia obrigatória/);
  });

  it('não produz pedido de análise sem um anexo contado e limita entradas sem inventar conteúdo', () => {
    for (const referenceCount of [0, -1, 1.5, undefined]) expect(buildReferenceVisualAnalysisPrompt({ referenceCount, brief: 'Evento' })).toBe('');
    const prompt = buildReferenceVisualAnalysisPrompt({ referenceCount: 1, brief: 'x'.repeat(50_000), application: 'y'.repeat(4000), userDirection: 'z'.repeat(50_000) });
    expect(prompt.length).toBeLessThanOrEqual(15_000);
    expect(prompt).not.toContain('x'.repeat(10_000));
  });

  it('pede um fundo abstrato derivado, preservando superfície e grafismos sem copiar pele ou entidades', () => {
    const prompt = buildReferenceVisualAnalysisPrompt({ referenceCount: 1, userDirection: 'Fundo liso e sem grafismos.' });
    expect(prompt).toMatch(/background[^\n]*derivação operacional[^\n]*não evidência/i);
    expect(prompt).toMatch(/não[^\n]*pele[^\n]*(rostos|figuras)/i);
    expect(prompt).toMatch(/acabamento escrito[^\n]*prevalece/i);
    expect(prompt).toMatch(/background.graphics[^\n]*"none"[^\n]*escrita/i);
    expect(prompt).toContain('"background":{"finish":"","graphics":""}');
    expect(prompt).toContain('Fundo liso e sem grafismos.');
  });

  it('mantém evidência, interpretação e propostas distinguíveis, sem apresentar imagem como prova de fatos', () => {
    const value = analysis();
    const context = buildReferenceVisualAnalysisContext(value);
    for (const heading of ['EVIDÊNCIAS OBSERVADAS', 'INTERPRETAÇÃO', 'RELAÇÃO COM O BRIEFING', 'DIREÇÃO DERIVADA', 'INCERTEZAS', 'SÍNTESE VISUAL']) expect(context).toContain(heading);
    expect(context).toContain(value.evidence.medium);
    expect(context).toContain(value.briefingRelation.proposals[0]);
    expect(context).toContain(value.synthesis);
    expect(context).toMatch(/não[^\n]*fatos do projeto/i);
    expect(context).toMatch(/dados[^\n]*não instruções/i);
    expect(buildReferenceVisualAnalysisContext({ evidence: { medium: 'guessed' } })).toBe('');
  });

  it('insere uma única análise válida no Livre e deixa inválida/ausente sem contexto adicional', () => {
    const options = { freeDesign: true, count: 10, kitReferenceWithoutText: true, referenceColors: [{ hex: '#213744', weight: 1 }] };
    const without = buildPresentationPlanPrompt(options);
    const context = buildReferenceVisualAnalysisContext(analysis());
    const withAnalysis = buildPresentationPlanPrompt({ ...options, referenceVisualAnalysis: analysis() });
    expect(withAnalysis).toContain(context);
    expect(withAnalysis.match(/EVIDÊNCIAS OBSERVADAS/g)).toHaveLength(1);
    expect(withAnalysis).not.toContain('O kit tem imagem de referência que você não vê.');
    expect(withAnalysis).toMatch(/análise[^\n]*anexos/i);
    expect(withAnalysis.length - without.length).toBeLessThanOrEqual(context.length + 200);
    expect(buildPresentationPlanPrompt({ ...options, referenceVisualAnalysis: { synthesis: 'invented' } })).toBe(without);
    expect(buildVisualDirectionBlock({ ...options, referenceVisualAnalysis: analysis() })).toContain(analysis().synthesis);
  });

  it('ignora inteiramente a análise fora do opt-in, inclusive no bloco visual usado pelos estilos fixos', () => {
    const options = { brief: 'Produto', count: 6, kitReferenceWithoutText: true };
    expect(buildPresentationPlanPrompt({ ...options, referenceVisualAnalysis: analysis() })).toBe(buildPresentationPlanPrompt(options));
    expect(buildVisualDirectionBlock({ ...options, referenceVisualAnalysis: analysis() })).toBe(buildVisualDirectionBlock(options));
  });
});

const rawPlan = (free = true) => ({
  schemaVersion: free ? 3 : 2, promptVersion: free ? 'presentation-plan-v3' : 'presentation-plan-v2',
  objective: 'Apresentar a coleção', audience: 'Curadoria', thesis: 'Materialidade como conceito.',
  evidence: [], rules: [], gaps: [], signature: '',
  slides: [1, 2, 3].map(index => ({
    index, visualRole: index === 1 ? 'cover' : index === 3 ? 'closing' : 'content', purpose: 'other',
    question: `Questão ${index}?`, keyMessage: `Conceito ${index}.`, evidenceIds: [], scene: null, avoid: '',
    ...(free ? { design: null } : {}),
  })),
});

describe('análise visual: plano persistido usa a leitura fornecida, não uma resposta inventada', () => {
  it('anexa a análise normalizada ao plano validado e onPlan, sem pedir que o modelo a gere de novo', async () => {
    const referenceVisualAnalysis = analysis();
    const ai = vi.fn().mockResolvedValue(rawPlan());
    const onPlan = vi.fn();
    const result = await generatePresentationPlan({ freeDesign: true, count: 3, referenceVisualAnalysis, onPlan }, ai);
    expect(result.plan.referenceVisualAnalysis).toEqual(normalizeReferenceVisualAnalysis(referenceVisualAnalysis));
    expect(result.plan.referenceVisualAnalysis).not.toBe(referenceVisualAnalysis);
    expect(onPlan.mock.calls[0][0]).toBe(result.plan);
    expect(ai).toHaveBeenCalledTimes(1);
    expect(ai.mock.calls[0][0]).toContain(referenceVisualAnalysis.synthesis);
    const contractLine = ai.mock.calls[0][0].split('CONTRATO JSON EXATO (sem markdown):\n')[1].split('\n')[0];
    expect(JSON.parse(contractLine)).not.toHaveProperty('referenceVisualAnalysis');
  });

  it('mantém análise durante recuperação e não a anexa quando inválida ou em estilo fixo', async () => {
    const ai = vi.fn().mockRejectedValueOnce(Object.assign(new Error('incomplete'), { code: 'ai_output_truncated' })).mockResolvedValue(rawPlan());
    const result = await generatePresentationPlan({ freeDesign: true, count: 3, referenceVisualAnalysis: analysis() }, ai);
    expect(result.plan.referenceVisualAnalysis?.synthesis).toBe(analysis().synthesis);
    for (const [prompt] of ai.mock.calls) expect(prompt).toContain(analysis().synthesis);
    for (const [freeDesign, referenceVisualAnalysis] of [[true, { synthesis: 'not enough' }], [false, analysis()]]) {
      const value = await generatePresentationPlan({ freeDesign, count: 3, referenceVisualAnalysis }, vi.fn().mockResolvedValue(rawPlan(freeDesign)));
      expect(value.plan).not.toHaveProperty('referenceVisualAnalysis');
    }
  });

  it('guarda a análise no plano retornado sem repeti-la como fonte nos lotes de redação', async () => {
    const { plan } = await generatePresentationPlan({ freeDesign: true, count: 3, referenceVisualAnalysis: analysis() }, vi.fn().mockResolvedValue(rawPlan()));
    const before = structuredClone(plan);
    const writing = buildPresentationPlanBlock(plan);
    expect(writing).not.toContain('referenceVisualAnalysis');
    expect(writing).not.toContain(analysis().synthesis);
    expect(writing).toContain(JSON.stringify(plan.slides[0]));
    expect(plan).toEqual(before);
    expect(plan.referenceVisualAnalysis).toEqual(analysis());
  });

  it('não promove uma análise devolvida pelo planejador a evidência visual', async () => {
    const ai = vi.fn().mockResolvedValueOnce({ ...rawPlan(), referenceVisualAnalysis: { ...analysis(), synthesis: 'Invented by the text planner.' } }).mockResolvedValue(rawPlan());
    const result = await generatePresentationPlan({ freeDesign: true, count: 3, referenceVisualAnalysis: analysis() }, ai);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(result.plan.referenceVisualAnalysis?.synthesis).toBe(analysis().synthesis);
  });
});
