import { describe, expect, it } from 'vitest';
import { presentationRoadmap, buildPresentationRoadmapPrompt } from '../../src/utils/presentation-roadmap.js';
import { presentationStageAt } from '../../src/utils/presentation-state.js';
import { PRESENTATION_PATHS } from '../../src/utils/presentation.js';

// MF-11: os sete caminhos devolviam a mesma sequência de fatos. Cada posição
// recebe agora uma etapa do caminho, e o layout usa a mesma etapa.
const labels = (path, n) => presentationRoadmap(path, n).map(stage => stage.label);

describe('roteiro por posição das apresentações', () => {
  it.each(PRESENTATION_PATHS.map(path => path.id))('%s: uma etapa por slide, capa primeiro e fecho no fim', (id) => {
    const stages = PRESENTATION_PATHS.find(path => path.id === id).stages;
    for (const n of [4, 6, 8, 10, 12, 16]) {
      const roadmap = labels(id, n);
      expect(roadmap).toHaveLength(n);
      expect(roadmap[0]).toBe(stages[0].label);
      expect(roadmap.slice(1).includes(stages[0].label), `${id} ${n}: capa repetida`).toBe(false);
      expect(roadmap.at(-1)).not.toBe('APÊNDICE');
    }
  });

  it('decks curtos mantêm as etapas que definem cada caminho', () => {
    expect(labels('aula_workshop', 6)).toEqual(expect.arrayContaining(['CONCEITO', 'EXEMPLO RESOLVIDO', 'ATIVIDADE', 'DEBRIEF']));
    expect(labels('proposta_comercial', 6)).toEqual(expect.arrayContaining(['ESCOPO E ACEITE', 'INVESTIMENTO E CONDIÇÕES']));
    expect(labels('relatorio_executivo', 6)).toEqual(expect.arrayContaining(['SCORECARD', 'ACHADO', 'RECOMENDAÇÕES', 'DECISÃO REQUERIDA']));
    expect(labels('estudo_de_caso', 6)).toEqual(expect.arrayContaining(['DESAFIO E IMPACTO', 'ESTRATÉGIA', 'ANTES E DEPOIS', 'RESULTADOS']));
    expect(labels('pitch', 6)).toEqual(expect.arrayContaining(['CLIENTE E PROBLEMA', 'SOLUÇÃO E MECANISMO', 'TRAÇÃO E PROVA']));
  });

  it('caminhos diferentes pedem sequências diferentes', () => {
    const seqs = PRESENTATION_PATHS.map(path => labels(path.id, 8).join(' > '));
    expect(new Set(seqs).size).toBe(seqs.length);
  });

  it('o layout usa a mesma etapa que o plano recebeu', () => {
    for (const path of PRESENTATION_PATHS) {
      const roadmap = presentationRoadmap(path.id, 9);
      roadmap.forEach((stage, index) => expect(presentationStageAt(path.id, index, 9)).toBe(stage));
    }
  });

  it('o prompt numera as posições e manda não seguir a ordem dos fatos', () => {
    const prompt = buildPresentationRoadmapPrompt('aula_workshop', 6);
    expect(prompt).toContain('ROTEIRO POR POSIÇÃO — 6 slides');
    expect(prompt).toMatch(/\n4\. ATIVIDADE:/);
    expect(prompt).toContain('Não organize o deck na ordem em que os fatos aparecem no briefing');
  });
});

describe('o caminho define o tipo de entrega', () => {
  it('briefing de negócio vira objeto da Aula, não folheto', () => {
    const prompt = buildPresentationRoadmapPrompt('aula_workshop', 8);
    expect(prompt).toContain('TIPO DE ENTREGA: Aula / Workshop');
    expect(prompt).toContain('o negócio entra como caso para explicar, exemplificar e praticar');
    expect(buildPresentationRoadmapPrompt('proposta_comercial', 8)).toContain('Não invente fornecedor, serviço');
    expect(prompt).toContain('Comece a keyMessage de cada posição com o nome da etapa');
  });
  it('Automático continua escolhendo pelo briefing', () => {
    expect(buildPresentationRoadmapPrompt('auto', 8)).not.toContain('TIPO DE ENTREGA');
  });
});
