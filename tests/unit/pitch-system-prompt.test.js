import { afterEach, describe, expect, it, vi } from 'vitest';
import { callAI, setAIRuntimeSettings, AI_SYSTEM_PT } from '../../src/utils/ai-client.js';
import { generateReviewedCarousel, buildEditorialReviewPrompt } from '../../src/utils/editorial-review.js';
import { buildApresentacaoPackBlock, buildApresentacaoRefineHint, getPresentationPath } from '../../src/utils/presentation.js';
import { buildGenerationImageLayer, buildGenerationLanguageLayer } from '../../src/utils/generation-prompts.js';
import { PITCH_SYSTEM_PT, buildPitchEvidenceRules } from '../../src/utils/pitch-content.js';

afterEach(() => {
  vi.unstubAllGlobals();
  setAIRuntimeSettings({});
});

const response = (data, provider = 'zai') => new Response(JSON.stringify(
  provider === 'anthropic'
    ? { content: [{ type: 'text', text: JSON.stringify(data) }] }
    : { choices: [{ message: { content: JSON.stringify(data) } }] },
), { status: 200, headers: { 'Content-Type': 'application/json' } });

const requestBody = (fetchMock, index = 0) => {
  const envelope = JSON.parse(fetchMock.mock.calls[index][1].body);
  return envelope.payload || envelope;
};
const systemOf = body => body.system || body.messages.find(m => m.role === 'system')?.content;

describe('papel do Pitch no transporte real de texto', () => {
  it.each(['zai', 'kimi', 'anthropic', 'openai'])('envia o papel do Pitch a %s sem contaminar a chamada seguinte', async provider => {
    setAIRuntimeSettings({ textProvider: provider, keys: { [provider]: 'synthetic-test-key' } });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response({ ok: true }, provider)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callAI('brief de investimento', { json: true, contentMode: 'pitch' })).resolves.toEqual({ ok: true });
    expect(systemOf(requestBody(fetchMock))).toContain(PITCH_SYSTEM_PT);
    expect(systemOf(requestBody(fetchMock))).not.toContain('especialista em conteúdo estratégico para Instagram');

    await callAI('publicação social', { json: true });
    expect(systemOf(requestBody(fetchMock, 1))).toContain(AI_SYSTEM_PT);
    expect(systemOf(requestBody(fetchMock, 1))).not.toContain(PITCH_SYSTEM_PT);
  });

  it('mantém o papel quando o provedor escolhido sem chave cai na IA do plano', async () => {
    setAIRuntimeSettings({ textProvider: 'openai', keys: {} });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);
    await callAI('brief', { json: true, contentMode: 'pitch' });
    const envelope = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(envelope.provider).toBe('zai');
    expect(systemOf(envelope.payload)).toContain(PITCH_SYSTEM_PT);
  });
});

describe('geração e segunda leitura do Pitch', () => {
  const draft = {
    slides: [
      { title: 'Um histórico contínuo', subtitle: 'Software para organizar registros e apoiar a revisão profissional.', bodyAfterImage: '', imageQuery: '' },
      { title: 'Continuidade sustenta a permanência', subtitle: 'O histórico retém os membros.', bodyAfterImage: '', imageQuery: '' },
      { title: 'Validar a primeira oferta', subtitle: 'O próximo passo é definir escopo e preço antes do piloto pago.', bodyAfterImage: '', imageQuery: '' },
    ],
    caption: 'Produto em preparação comercial.',
  };

  it.each(['pitch', 'pitch_deck', 'investor_pitch'])('usa o mesmo papel nas duas etapas para %s e aplica a correção sem mudar mídia', async presentationPath => {
    const correction = 'A hipótese é que o histórico favoreça a renovação. O piloto deve medir uso, retorno e custo por membro.';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(draft))
      .mockResolvedValueOnce(response({
        edits: [{ slideIndex: 1, reason: 'Retenção ainda não foi medida.', title: 'Testar a continuidade entre ciclos', subtitle: correction }],
      }));
    vi.stubGlobal('fetch', fetchMock);
    const config = { count: 3, presetId: 'apresentacao', presentationPath };
    const result = await generateReviewedCarousel({
      prompt: 'Software construído; cobrança ainda não ativa; retenção a validar.',
      config,
    }, callAI);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const index of [0, 1]) expect(systemOf(requestBody(fetchMock, index))).toContain(PITCH_SYSTEM_PT);
    expect(requestBody(fetchMock, 1).messages.find(m => m.role === 'user').content)
      .toContain('Retenção é uma hipótese até haver observação');
    expect(result.reviewStatus).toBe('revised');
    expect(result.result.slides).toHaveLength(3);
    expect(result.result.slides[1]).toMatchObject({ subtitle: correction, imageQuery: '' });
    expect(draft.slides[1].subtitle).toBe('O histórico retém os membros.');
  });

  it.each([
    { presetId: 'apresentacao', presentationPath: 'keynote_manifesto' },
    { presetId: 'livre', presentationPath: 'pitch' },
  ])('mantém o papel apropriado fora de uma apresentação Pitch (%j)', async mode => {
    const ai = vi.fn().mockResolvedValueOnce(draft).mockResolvedValueOnce({ edits: [] });
    await generateReviewedCarousel({ prompt: '', config: { ...mode, count: 3 } }, ai);
    for (const [, options] of ai.mock.calls) {
      expect(options.contentMode).toBe(mode.presetId === 'apresentacao' ? 'presentation' : undefined);
    }
  });

  it('geração, revisão e refinamento compartilham critérios factuais e preservam a autonomia do deck', () => {
    const blocks = [
      buildApresentacaoPackBlock(17, 'pitch'),
      buildEditorialReviewPrompt('brief', draft, { presetId: 'apresentacao', presentationPath: 'pitch' }),
      buildApresentacaoRefineHint('pitch'),
    ];
    for (const block of blocks) {
      expect(block).toContain(buildPitchEvidenceRules());
      expect(block).toContain('Não mencione o manual');
      expect(block).toContain('instituição e ano');
      expect(block).not.toContain('quase sempre ""');
    }
    expect(getPresentationPath('pitch').stages.at(-1).visualRole).toBe('decision');
  });

  it('o apoio visual e a linguagem do Pitch não exigem fotografia nem texto de palestra', () => {
    const images = buildGenerationImageLayer('apresentacao', 'Produto', '', '', true, 'pitch');
    expect(images).toContain('Use ""');
    expect(images).toContain('não obriga fotografia em cada slide');
    expect(images).not.toContain('contexto ou atmosfera');
    const language = buildGenerationLanguageLayer('apresentacao', 'provocador', 'viral', 'pitch');
    expect(language).toContain('Clareza factual tem prioridade');
    expect(language).not.toContain('fala do apresentador');
    expect(buildGenerationImageLayer('apresentacao', 'Tema')).toContain('APOIO VISUAL DE AUTO');
    expect(buildGenerationLanguageLayer('apresentacao', 'direto')).toContain('Escolha a densidade pelo uso');
  });
});
