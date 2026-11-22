import { afterEach, describe, expect, it, vi } from 'vitest';
import { callAI, setAIRuntimeSettings, AI_SYSTEM_PT } from '../../src/utils/ai-client.js';
import {
  presentationAIOptions, buildApresentacaoPackBlock, buildApresentacaoRefineHint,
  buildPresentationSystemPrompt, buildPresentationSummaryRules, buildPresentationFieldRules,
  buildPresentationReviewRules,
} from '../../src/utils/presentation.js';
import {
  buildGenerationLanguageLayer, buildGenerationSlideLayoutRules, buildGenerationImageLayer,
  buildGenerationJsonContract, buildRefineSingleSlideRules, resolveMaterialPromptParts,
} from '../../src/utils/generation-prompts.js';
import { generateReviewedCarousel, buildEditorialReviewPrompt, applyEditorialReview } from '../../src/utils/editorial-review.js';
import { PITCH_SYSTEM_PT } from '../../src/utils/pitch-content.js';
import { buildPresentationDesignSystemPromptBlock } from '../../src/styles/presentation-presets.jsx';

const cases = [
  ['auto', 'automatico', 'estrategista editorial', 'uma única lógica dominante'],
  ['aula_workshop', 'workshop', 'designer instrucional', 'exemplo resolvido'],
  ['proposta_comercial', 'proposta', 'propostas comerciais', 'critério de aceite'],
  ['relatorio_executivo', 'relatório', 'comunicação executiva', 'Ausência de dados não significa zero'],
  ['estudo_de_caso', 'case-study', 'estudos de caso', 'condições comparáveis'],
  ['keynote_manifesto', 'manifesto', 'editor de keynotes', 'objeções fornecidas'],
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
  expect(design).toContain('limites obrigatórios por slide');
});

it('aula reaproveita o caso fornecido e encerra com aprendizagem em redação, revisão e refinamento', () => {
  const brief = 'Caso fictício: uma equipe registra decisões em reuniões. Use apenas os dados fornecidos na atividade. A oferta proposta custa R$ 900; o objetivo desta apresentação é ensinar o método.';
  const prompts = [
    buildApresentacaoPackBlock(6, 'aula'),
    buildEditorialReviewPrompt(brief, { slides: [], caption: '' }, { presetId: 'apresentacao', presentationPath: 'aula' }),
    buildApresentacaoRefineHint('aula'),
  ];
  for (const prompt of prompts) {
    expect(prompt).toContain('o exemplo resolvido e a atividade reutilizam os fatos desse caso');
    expect(prompt).toContain('O rótulo "caso fictício" não autoriza acrescentar pessoas, datas, decisões ou resultados');
    expect(prompt).toContain('usar apenas os dados fornecidos prevalece');
    expect(prompt).toContain('O debrief confere a mesma entrega e os mesmos critérios');
    expect(prompt).toContain('Título, apoio, blocos e notas devem se referir a esse mesmo objeto');
    expect(prompt).toContain('resposta modelo compatível com a fonte, justificativa pelo critério anunciado');
    expect(prompt).toContain('modelo editável citado como entregável futuro não é material disponível');
    expect(prompt).toContain('Não reserve páginas autônomas de oferta');
    expect(prompt).toContain('Feche com a aplicação pelo participante e um critério de aprendizagem');
    expect(prompt).toContain('Preço ou oferta no material não transformam a conclusão nem a caption em venda');
    expect(prompt).toContain('somente um objetivo comercial explícito autoriza esse chamado');
  }
  expect(prompts[0]).toContain('Se o usuário solicitar expressamente um exemplo hipotético');
  expect(prompts[0]).not.toContain('Se não houver caso fornecido e as instruções permitirem');
  expect(prompts[0]).not.toContain('Se faltar caso real');
  expect(prompts[1]).toContain(brief);
  for (const path of ['pitch', 'proposta_comercial', 'relatorio_executivo']) {
    expect(buildApresentacaoPackBlock(6, path)).not.toContain('O debrief confere a mesma entrega');
  }
});

describe.each(['auto', 'pitch', 'aula_workshop', 'proposta_comercial', 'relatorio_executivo', 'estudo_de_caso', 'keynote_manifesto'])('clareza e fidelidade em %s', path => {
  it('mantém decisões pendentes e condições exatas em geração, revisão, refinamento e resumo', () => {
    for (const prompt of [buildApresentacaoPackBlock(12, path), buildPresentationReviewRules(path),
      buildApresentacaoRefineHint(path), buildPresentationSummaryRules(path)]) {
      expect(prompt).toContain('FIDELIDADE EM TODOS OS CAMPOS');
      expect(prompt).toContain('presentationBlocks, speakerNotes e caption');
      expect(prompt).toContain('Um pedido de aprovação não comprova aprovação');
      expect(prompt).toContain('Critério de aceite não determina encerramento do contrato');
      expect(prompt).toContain('Aprovação da proposta e aceite das entregas são decisões distintas');
      expect(prompt).toContain('Lacunas não viram novos objetivos ou metodologia aprovados');
      expect(prompt).toContain('No próprio slide de indicadores');
      expect(prompt).toContain('base/denominador');
      expect(prompt).toContain('licenças de software não equivalem a software próprio');
      expect(prompt).toContain('mesmo tipo e mesmas equipes não significam as mesmas observações repetidas');
      expect(prompt).toContain('Também não define condições de pagamento');
      expect(prompt).toContain('Preserve qualificadores temporais das exclusões');
      expect(prompt).toContain('não comprovam diagnóstico nem causa do problema');
      expect(prompt).toContain('uma ressalva em outra página não corrige uma afirmação categórica');
      expect(prompt).not.toContain('Mesa Clara');
      expect(prompt).not.toContain('R$ 6.000');
    }
  });
  it('usa limites como tetos e mantém condições essenciais visíveis, sem exigir preenchimento', () => {
    const fields = buildPresentationFieldRules(path);
    expect(fields).toContain('Os limites obrigatórios por slide prevalecem');
    expect(fields).toContain('tetos, não metas de preenchimento');
    expect(fields).toContain('Balanceado');
    expect(fields).toContain('speakerNotes');
    expect(fields).toMatch(/condições de aceite|aceite/);
    expect(fields).toMatch(/limitações|incerteza/);
    expect(fields).toContain('sem repetir cada célula');
    expect(fields).not.toMatch(/normalmente 220–360|duas a quatro frases|mínimo de \d+/);
    expect(buildPresentationReviewRules(path)).toContain('Um slide curto e completo não precisa ser ampliado');
  });

  // Catálogo final 22/11: "fictício" é nota de produção. Não entra sozinho no
  // título nem no nome da marca; só acompanha o que puder passar por evidência real.
  it('preserva idioma e trata "fictício" como nota de produção em redação, revisão e refinamento', () => {
    expect(buildPresentationSystemPrompt(path)).toContain('O idioma explícito do pedido prevalece');
    for (const prompt of [
      buildApresentacaoPackBlock(12, path),
      buildPresentationReviewRules(path),
      buildApresentacaoRefineHint(path),
    ]) {
      expect(prompt).toMatch(/Notas de produção como "fictício", "exemplo" e "rascunho" não entram automaticamente (?:no título|na abertura)/);
      expect(prompt).toMatch(/cliente (?:ou resultado )?real/);
      expect(prompt).not.toMatch(/preserve essa natureza na abertura|continua identificado como fictício na abertura/);
      expect(prompt).not.toContain('Mesa Clara');
      expect(prompt).not.toContain('R$ 6.000');
    }
  });
});

it('revisão recebe e pode corrigir notas e resumo sem substituir o slide ou perder blocos', () => {
  const presentationPlan = { slides:[{ index:1 }], evidence:[] };
  const config = { presetId:'apresentacao', presentationPath:'auto', count:1, presentationPlan };
  const blocks = [{ type:'metrics', items:[{ label:'Duração média', value:'45 → 33 min', detail:'Mesmas equipes; dois períodos observados.' }] }];
  const draft = { presentationPlan, slides:[{ title:'Decisão em discussão', subtitle:'Avaliar o próximo ciclo.', bodyAfterImage:'', imageQuery:'',
    presentationBlocks:blocks, speakerNotes:'A decisão final é aprovar. O contrato se encerra na entrega.', logoImageId:'logo-preservada' }],
    caption:'Iniciar o ciclo.' };
  const prompt = buildEditorialReviewPrompt('A aprovação está em discussão. O aceite depende da entrega. Não foi definido encerramento contratual.', draft, config);
  expect(prompt).toContain('Leia todos os campos do rascunho');
  expect(prompt).toContain('inclusive blocos nativos, speakerNotes e caption');
  const transmitted = JSON.parse(prompt.match(/<rascunho>\n([\s\S]*?)\n<\/rascunho>/)[1]);
  expect(transmitted.slides[0].speakerNotes).toBe(draft.slides[0].speakerNotes);
  expect(transmitted.slides[0].presentationBlocks).toEqual(blocks);
  expect(transmitted.caption).toBe(draft.caption);
  const corrected = applyEditorialReview(draft, { edits:[{ slideIndex:0, reason:'Preservar a decisão pendente e somente o aceite informado.',
    speakerNotes:'A aprovação está em discussão. O aceite depende da entrega.' }], caption:'Avaliar o próximo ciclo; se aprovado, definir o início.' }, config);
  expect(corrected.slides[0]).toMatchObject({ title:draft.slides[0].title, presentationBlocks:blocks, logoImageId:'logo-preservada',
    speakerNotes:'A aprovação está em discussão. O aceite depende da entrega.' });
  expect(corrected.caption).toBe('Avaliar o próximo ciclo; se aprovado, definir o início.');
});
