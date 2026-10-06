import { describe, expect, it } from 'vitest';
import { buildResearchUserPrompt, normalizeResearchResult, researchIdeaMaterial } from '../../src/utils/research-prompts.js';

const raw = {
  trending_topics: [{ topic: 'Observação', why: 'Um fato', eventDate: '2026-09-01', sources: [
    { name: 'Fonte', url: 'https://example.com/report', publishedAt: '2026-09-20' },
    { name: 'Inseguro', url: 'javascript:alert(1)', publishedAt: '2026-09-20' },
    { name: 'Sem data', url: 'https://example.com/other', publishedAt: '' },
  ] }],
  carousel_ideas: [{ title: 'Uma ideia', angle: 'Um recorte', sourceIndexes: [0, 99, 0] }], viral_hooks: ['Um gancho'],
};

const presentationRaw = {
  evidence_topics: [{
    topic: 'Tempo perdido em aprovação',
    why: 'O ciclo atual exige quatro revisões',
    eventDate: '2026-09-01',
    sources: [{ name: 'Relatório interno', url: 'https://example.com/report', publishedAt: '2026-09-20' }],
  }],
  presentation_angles: [{
    title: 'Um fluxo único reduz o retrabalho',
    angle: 'Comparar processo atual e proposto',
    evidence: 'Tempo médio por etapa',
    decision: 'Aprovar o piloto',
    sourceIndexes: [0],
  }],
  decision_openings: [{
    title: 'Quatro revisões atrasam cada lançamento',
    evidence: 'Tempo medido no último trimestre',
    decision: 'Escolher o novo fluxo',
  }],
};

describe('pesquisa atualizada com fontes', () => {
  it('distingue data de publicação/evento e não força fórmulas antigas', () => {
    const prompt = buildResearchUserPrompt({ niche: 'escrita', contentObjective: 'saves', hasWeb: true, today: '2026-09-22' });
    expect(prompt).toContain('Data de referência: 2026-09-22');
    expect(prompt).toContain('data de publicação e data do evento');
    expect(prompt).toContain('Gerar salvamentos');
    expect(prompt).not.toContain('Não é sobre X. É sobre Y.');
    expect(prompt).not.toContain('Mínimo:');
  });
  it('fallback não mistura ordem de pesquisar com aviso sem web', () => {
    const prompt = buildResearchUserPrompt({ niche: 'escrita', hasWeb: false });
    expect(prompt).toContain('SEM WEB AO VIVO');
    expect(prompt).not.toContain('Use pesquisa web');
    expect(prompt).not.toContain('na web');
    expect(prompt).toContain('deixe sources vazio');
    const normalized = normalizeResearchResult(raw, false);
    expect(normalized.trending_topics[0].sources).toEqual([]);
    expect(normalized.trending_topics[0].eventDate).toBe('');
    expect(normalized.carousel_ideas[0].sourceIndexes).toEqual([]);
  });
  it('aceita apenas fontes datadas com URL http(s) e transfere referências da ideia', () => {
    const result = normalizeResearchResult(raw, true);
    expect(result.trending_topics[0].sources).toHaveLength(1);
    expect(result.carousel_ideas[0].sourceIndexes).toEqual([0]);
    const material = researchIdeaMaterial(result.carousel_ideas[0], result.trending_topics);
    expect(material.sources).toBe('https://example.com/report');
    expect(material.content).toContain('2026-09-01');
    expect(material.content).toContain('2026-09-20');
  });
  it('respostas legadas sem fonte ficam identificadas como hipótese', () => {
    const result = normalizeResearchResult({ trending_topics: ['Assunto antigo'], carousel_ideas: [{ title: 'Ideia' }] }, true);
    expect(result.warning).toContain('hipóteses');
    expect(researchIdeaMaterial(result.carousel_ideas[0], result.trending_topics).content).toContain('Hipótese editorial');
    expect(normalizeResearchResult(null, false).trending_topics).toEqual([]);
  });

  it('datas impossíveis não passam como referência datada', () => {
    const value = structuredClone(raw);
    value.trending_topics[0].sources[0].publishedAt = '2026-02-30';
    const result = normalizeResearchResult(value, true);
    expect(result.trending_topics[0].sources).toEqual([]);
    expect(result.carousel_ideas[0].sourceIndexes).toEqual([]);
  });

  it('apresentação usa contrato próprio de evidência, ângulo e decisão', () => {
    const prompt = buildResearchUserPrompt({
      niche: 'aprovação criativa',
      productKind: 'apresentacao',
      creativePreset: 'apresentacao',
      presentationPath: 'pitch',
      hasWeb: true,
      today: '2026-09-22',
    });

    expect(prompt).toContain('APRESENTAÇÃO 16:9');
    expect(prompt).toContain('Caminho da apresentação: Pitch');
    expect(prompt).toContain('"evidence_topics"');
    expect(prompt).toContain('"presentation_angles"');
    expect(prompt).toContain('"decision_openings"');
    expect(prompt).not.toContain('"viral_hooks"');
    expect(prompt).not.toContain('"carousel_ideas"');
    expect(prompt).not.toContain('Instagram');

    const result = normalizeResearchResult(presentationRaw, true, {
      productKind: 'apresentacao',
      creativePreset: 'apresentacao',
    });
    expect(result.presentation_angles).toHaveLength(1);
    expect(result.presentation_angles[0]).toMatchObject({
      evidence: 'Tempo médio por etapa',
      decision: 'Aprovar o piloto',
      sourceIndexes: [0],
    });
    expect(result.decision_openings[0].title).toContain('Quatro revisões');
    expect(result).not.toHaveProperty('viral_hooks');
    expect(result).not.toHaveProperty('carousel_ideas');

    const material = researchIdeaMaterial(result.presentation_angles[0], result.evidence_topics);
    expect(material.content).toContain('Decisão/aprendizagem: Aprovar o piloto');
    expect(material.sources).toBe('https://example.com/report');
  });

  it('fallback de apresentação mantém lacunas explícitas e aceita resposta legada sem expor campos sociais', () => {
    const result = normalizeResearchResult(raw, false, {
      productKind: 'apresentacao',
      creativePreset: 'apresentacao',
    });
    expect(result.evidence_topics[0].sources).toEqual([]);
    expect(result.presentation_angles[0].title).toBe('Uma ideia');
    expect(result.decision_openings[0].title).toBe('Um gancho');
    expect(result.warning).toContain('valide evidências');
    expect(result).not.toHaveProperty('viral_hooks');
    expect(result).not.toHaveProperty('carousel_ideas');
  });
});
