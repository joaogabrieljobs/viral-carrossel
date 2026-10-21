import { afterEach, describe, expect, it, vi } from 'vitest';
import { callAI, setAIRuntimeSettings, AI_SYSTEM_PT } from '../../src/utils/ai-client.js';
import {
  presentationAIOptions, buildApresentacaoPackBlock, buildApresentacaoRefineHint,
  buildPresentationSystemPrompt, buildPresentationSummaryRules,
} from '../../src/utils/presentation.js';
import {
  buildGenerationLanguageLayer, buildGenerationSlideLayoutRules, buildGenerationImageLayer,
  buildGenerationJsonContract, buildRefineSingleSlideRules, resolveMaterialPromptParts,
} from '../../src/utils/generation-prompts.js';
import { generateReviewedCarousel, buildEditorialReviewPrompt } from '../../src/utils/editorial-review.js';
import { PITCH_SYSTEM_PT } from '../../src/utils/pitch-content.js';
import { buildPresentationDesignSystemPromptBlock } from '../../src/styles/presentation-presets.jsx';

const cases = [
  ['auto', 'automatico', 'estrategista editorial', 'uma única lógica dominante'],
  ['aula_workshop', 'workshop', 'designer instrucional', 'exemplo resolvido'],
  ['proposta_comercial', 'proposta', 'propostas comerciais', 'critério de aceite'],
  ['relatorio_executivo', 'relatório', 'comunicação executiva', 'Ausência de dados não significa zero'],
  ['estudo_de_caso', 'case-study', 'estudos de caso', 'condições comparáveis'],
  ['keynote_manifesto', 'manifesto', 'editor de keynotes', 'melhor objeção'],
];
const completion = (data, provider = 'zai') => new Response(JSON.stringify(
  provider === 'anthropic'
    ? { content: [{ type: 'text', text: JSON.stringify(data) }] }
    : { choices: [{ message: { content: JSON.stringify(data) } }] },
), { status: 200 });
const bodyAt = (fetchMock, index = 0) => {
  const envelope = JSON.parse(fetchMock.mock.calls[index][1].body);
  return envelope.payload || envelope;
};
const systemAt = (fetchMock, index = 0) => {
  const body = bodyAt(fetchMock, index);
  return body.system || body.messages.find(message => message.role === 'system')?.content;
};
const userAt = (fetchMock, index = 0) => bodyAt(fetchMock, index).messages.find(message => message.role === 'user')?.content;

afterEach(() => {
  vi.unstubAllGlobals();
  setAIRuntimeSettings({});
});

describe.each(cases)('contrato editorial de %s', (path, alias, role, criterion) => {
  it.each(['zai', 'kimi', 'anthropic', 'openai'])('envia papel e caminho normalizado a %s sem afetar a próxima chamada social', async provider => {
    setAIRuntimeSettings({ textProvider: provider, keys: { [provider]: 'synthetic-key' } });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(completion({ ok: true }, provider)));
    vi.stubGlobal('fetch', fetchMock);

    await callAI('brief', { json: true, ...presentationAIOptions('apresentacao', alias) });
    expect(systemAt(fetchMock)).toContain(role);
    expect(systemAt(fetchMock)).not.toContain('especialista em conteúdo estratégico para Instagram');
    await callAI('post', { json: true, ...presentationAIOptions('livre', path) });
    expect(systemAt(fetchMock, 1)).toContain(AI_SYSTEM_PT);
    expect(systemAt(fetchMock, 1)).not.toContain(role);
  });

  it('liga redação e revisão ao mesmo contrato e aplica uma correção sem alterar mídia', async () => {
    const draft = {
      slides: [{ title: 'Um título', subtitle: 'Uma síntese', bodyAfterImage: '', imageQuery: '', logoImageId: 'kept' }],
      caption: 'Resumo',
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(completion(draft))
      .mockResolvedValueOnce(completion({ edits: [{
        slideIndex: 0, reason: 'Explicar o critério disponível', subtitle: 'Uma síntese com critério.', bodyAfterImage: 'Condição fornecida.',
      }] }));
    vi.stubGlobal('fetch', fetchMock);
    const config = {
      count: 1, presetId: 'apresentacao', presentationPath: alias,
      presentationTextLimits: [{ subtitle: { maxChars: 40 }, bodyAfterImage: { maxChars: 30 } }],
    };
    const { result, reviewStatus } = await generateReviewedCarousel({
      prompt: buildApresentacaoPackBlock(5, alias), config,
    }, callAI);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(systemAt(fetchMock, 0)).toBe(systemAt(fetchMock, 1));
    expect(systemAt(fetchMock)).toContain(role);
    expect(userAt(fetchMock, 0)).toContain(criterion);
    expect(userAt(fetchMock, 1)).toContain('REVISÃO DE PROFUNDIDADE');
    expect(userAt(fetchMock, 1)).toContain('subtitle e bodyAfterImage são editáveis');
    expect(userAt(fetchMock, 1)).toContain('até 40 caracteres');
    expect(reviewStatus).toBe('revised');
    expect(result.slides[0]).toMatchObject({ subtitle: 'Uma síntese com critério.', imageQuery: '', logoImageId: 'kept' });
    expect(draft.slides[0].subtitle).toBe('Uma síntese');
  });

  it('mantém profundidade, limites, integridade e schema coerentes em todas as etapas', () => {
    const blocks = [
      buildApresentacaoPackBlock(12, alias),
      buildApresentacaoRefineHint(alias),
      buildEditorialReviewPrompt('brief', { slides: [] }, { presetId: 'apresentacao', presentationPath: alias }),
    ];
    for (const block of blocks) {
      expect(block).toContain('FIDELIDADE E RACIOCÍNIO');
      expect(block).toContain('Não mencione o arquivo enviado');
      expect(block).toContain('Os limites obrigatórios por slide prevalecem');
      expect(block).not.toMatch(/bodyAfterImage (?:só|somente|continua reservado|fica vazio por padrão)|quase sempre ""/);
    }
    const fields = [
      buildGenerationSlideLayoutRules('viral', 'apresentacao', '1_5', 12, alias),
      buildRefineSingleSlideRules('viral', '1_5', { presetId: 'apresentacao', presentationPath: alias }),
      buildGenerationJsonContract('apresentacao', '1_5', 12, null, alias),
    ];
    for (const block of fields) {
      expect(block).toContain('bodyAfterImage');
      expect(block).not.toMatch(/use apenas fonte|somente para fonte|quase sempre ""/);
    }
    const images = buildGenerationImageLayer('apresentacao', 'Tema', '', '', true, alias);
    expect(images).toContain('Use ""');
    expect(images).toContain('Não invente gráfico');
    expect(buildApresentacaoRefineHint(alias)).not.toContain('edits');
    expect(buildPresentationSummaryRules(alias)).toContain('Não mencione o arquivo enviado');
  });

  it('inclui informação relevante após 8 mil caracteres sem aumentar o contexto social', async () => {
    const marker = 'Decisão final: avaliar dependências antes da execução.';
    const material = { content: `${'Contexto. '.repeat(1100)}${marker}` };
    expect((await resolveMaterialPromptParts(material, null, { presentationPath: path })).materialBlock).toContain(marker);
    expect((await resolveMaterialPromptParts(material)).materialBlock).not.toContain(marker);
  });
});

it('preserva Pitch e normaliza caminhos desconhecidos para Auto', () => {
  expect(buildPresentationSystemPrompt('investor_pitch')).toBe(PITCH_SYSTEM_PT);
  expect(presentationAIOptions('apresentacao', 'pitch_deck')).toEqual({ contentMode: 'pitch', presentationPath: 'pitch' });
  expect(presentationAIOptions('apresentacao', 'unknown')).toEqual({ contentMode: 'presentation', presentationPath: 'auto' });
  expect(presentationAIOptions('livre', 'proposta')).toEqual({});
});

it('fallback para a IA do plano preserva o especialista e aceita resumo em texto puro', async () => {
  setAIRuntimeSettings({ textProvider: 'openai', keys: {} });
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    choices: [{ message: { content: 'Resumo executivo com decisões pendentes.' } }],
  }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(callAI('Resuma o deck', presentationAIOptions('apresentacao', 'relatorio')))
    .resolves.toBe('Resumo executivo com decisões pendentes.');
  expect(systemAt(fetchMock)).toContain('comunicação executiva');
  expect(systemAt(fetchMock)).toContain('formato solicitado');
  expect(bodyAt(fetchMock).response_format).toBeUndefined();
});

it('respeita o orçamento do material e avisa sobre seleção distribuída nas apresentações', async () => {
  const toast = vi.fn();
  const { materialBlock } = await resolveMaterialPromptParts({ content: 'a'.repeat(80_001) }, toast, { presentationPath: 'aula' });
  expect(toast).toHaveBeenCalledWith(expect.stringContaining('todo o conteúdo'), 'info', 6000);
  expect(materialBlock.length).toBeLessThanOrEqual(58_000);
});

it('preserva aula e keynote ao vivo, e a leitura autônoma dos documentos de decisão', () => {
  expect(buildGenerationLanguageLayer('apresentacao', '', 'editorial', 'keynote')).toContain('baixa densidade');
  expect(buildGenerationLanguageLayer('apresentacao', '', 'editorial', 'aula')).toContain('instruções de prática');
  expect(buildGenerationLanguageLayer('apresentacao', '', 'editorial', 'proposta')).toContain('leitura autônoma');
  expect(buildGenerationLanguageLayer('apresentacao', '', 'editorial', 'relatorio')).toContain('leitura autônoma');
  const design = buildPresentationDesignSystemPromptBlock('presentation_data_first', 'relatorio');
  expect(design).toContain('Nunca peça que imageQuery fabrique');
  expect(design).toContain('Limites obrigatórios da composição');
});
