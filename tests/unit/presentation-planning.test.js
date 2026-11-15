import { describe, expect, it, vi } from 'vitest';
import { generatePresentationPlan, parsePresentationPlanResponse } from '../../src/utils/presentation-planning.js';
import { PRESENTATION_PLAN_PROMPT_VERSION, PRESENTATION_PLAN_SYSTEM_PROMPT } from '../../src/utils/presentation-plan.js';

const sources = [{ id: 's1', text: 'O piloto foi gratuito. Foram observadas 20 reuniões. A oferta proposta custa R$ 6.000.' }];
const config = { brief: 'Apresentar o piloto sem inventar receita.', sources, count: 3, presentationPath: 'pitch' };
const plan = () => ({
  schemaVersion: 1, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
  objective: 'Definir a próxima experiência', audience: 'Coordenação', thesis: 'O piloto precede a primeira oferta paga.',
  evidence: [{ id: 'e1', status: 'fact', sourceId: 's1', quote: 'O piloto foi gratuito.', claim: 'Piloto gratuito.' }],
  gaps: ['Não há contratos pagos informados.'],
  slides: [
    { index: 1, visualRole: 'cover', purpose: 'introduction', question: 'O que foi observado?', keyMessage: 'Piloto gratuito antes da oferta paga.', evidenceIds: ['e1'], imageBrief: '' },
    { index: 2, visualRole: 'content', purpose: 'evidence', question: 'O que está validado?', keyMessage: 'A execução do piloto não é receita.', evidenceIds: ['e1'], imageBrief: '' },
    { index: 3, visualRole: 'closing', purpose: 'decision', question: 'Qual o próximo passo?', keyMessage: 'Definir a oferta para um novo teste.', evidenceIds: [], imageBrief: '' },
  ],
});
const failure = code => Object.assign(new Error('Provider details with private content'), { code });

describe('planejamento limitado com recuperação', () => {
  it('usa prompt e teto próprios, publica somente o plano validado e não repete sucesso', async () => {
    const callAI = vi.fn().mockResolvedValue(plan());
    const onPlan = vi.fn(); const onStage = vi.fn();
    const result = await generatePresentationPlan({ ...config, aiOptions: { systemPrompt: 'Redija um deck inteiro', maxTokens: 2000 }, onPlan, onStage }, callAI);
    expect(result.attempts).toBe(1);
    expect(callAI).toHaveBeenCalledTimes(1);
    expect(callAI.mock.calls[0][1]).toMatchObject({ maxTokens: 8192, thinking: 'disabled', systemPrompt: PRESENTATION_PLAN_SYSTEM_PROMPT, jsonParser: parsePresentationPlanResponse });
    expect(callAI.mock.calls[0][0]).toContain('8192 tokens');
    expect(onPlan).toHaveBeenCalledWith(result.plan, { attempts: 1, diagnostics: result.diagnostics });
    expect(onStage.mock.calls.map(call => call[0])).toEqual(['planning']);
  });

  it.each(['ai_output_truncated', 'ai_invalid_json'])('recupera %s com a mesma quantidade e fontes', async code => {
    const callAI = vi.fn().mockRejectedValueOnce(failure(code)).mockResolvedValueOnce(plan());
    const onStage = vi.fn();
    const result = await generatePresentationPlan({ ...config, onStage }, callAI);
    expect(result.attempts).toBe(2);
    expect(onStage.mock.calls.map(call => call[0])).toEqual(['planning', 'planning_repair']);
    expect(callAI.mock.calls[1][0]).toContain('Quantidade EXATA: 3');
    expect(callAI.mock.calls[1][0]).toContain(sources[0].text);
    expect(callAI.mock.calls[1][0]).not.toContain('Provider details');
    expect(callAI.mock.calls[1][1].maxTokens).toBe(8192);
  });

  it('mantém a restrição final completa na tentativa inicial e na recuperação do plano de Aula', async () => {
    const userInstructions = 'Contexto instrucional. '.repeat(650) + 'FINAL: atividade e correção usam somente o caso fornecido.';
    const callAI = vi.fn().mockRejectedValueOnce(failure('ai_invalid_json')).mockResolvedValueOnce(plan());
    await generatePresentationPlan({ ...config, presentationPath: 'aula', userInstructions }, callAI);
    expect(callAI).toHaveBeenCalledTimes(2);
    for (const [prompt] of callAI.mock.calls) {
      expect(prompt).toContain(userInstructions);
      expect(prompt).toContain('CONTRATO DA ATIVIDADE E DA CORREÇÃO');
      expect(prompt).toContain('purpose=practice');
      expect(prompt).toContain('correção dessa mesma entrega na posição seguinte');
      expect(prompt).toContain('Rotular um cenário novo como hipotético não atende essa restrição');
      expect(prompt).toContain('Não reserve páginas autônomas de oferta');
    }
  });

  it('devolve os caminhos inválidos para reparo e revalida toda a resposta', async () => {
    const invalid = plan(); invalid.slides[1].purpose = 'inventado';
    const callAI = vi.fn().mockResolvedValueOnce(invalid).mockResolvedValueOnce(plan());
    const onPlan = vi.fn();
    const result = await generatePresentationPlan({ ...config, onPlan }, callAI);
    expect(result.diagnostics[0].issues).toContainEqual({ code: 'slide_purpose', path: 'slides[1].purpose' });
    expect(callAI.mock.calls[1][0]).toContain('RESPOSTA ANTERIOR NÃO VALIDADA');
    expect(callAI.mock.calls[1][0]).toContain('slides[1].purpose');
    expect(onPlan).toHaveBeenCalledTimes(1);
    expect(onPlan.mock.calls[0][0].slides[1].purpose).toBe('evidence');
  });

  it('nunca publica citação inventada após duas tentativas e não vaza valores nos diagnósticos', async () => {
    const invalid = plan(); invalid.evidence[0].quote = 'A empresa recebeu investimento secreto de R$ 5 milhões.';
    invalid.evidence[0].id = 'segredo_privado'; invalid.slides[0].evidenceIds = ['segredo_privado']; invalid.slides[1].evidenceIds = ['segredo_privado'];
    const callAI = vi.fn().mockResolvedValue(invalid); const onPlan = vi.fn();
    const error = await generatePresentationPlan({ ...config, onPlan }, callAI).catch(error => error);
    expect(error).toMatchObject({ code: 'presentation_plan_invalid', attempts: 2, stage: 'planning' });
    expect(error.validationErrors).toContainEqual({ code: 'quote_not_found', path: 'evidence[0].quote' });
    expect(JSON.stringify(error.planningDiagnostics)).not.toMatch(/milhões|segredo|investimento/);
    expect(error.message).not.toMatch(/milhões|segredo/);
    expect(callAI).toHaveBeenCalledTimes(2);
    expect(onPlan).not.toHaveBeenCalled();
  });

  it('preserva status de proposta e citações originais na recuperação', async () => {
    const invalid = plan(); invalid.evidence.push({ id: 'e2', status: 'proposal', sourceId: 's1', quote: 'A oferta custa seis mil.', claim: 'Oferta proposta.' });
    const fixed = structuredClone(invalid); fixed.evidence[1].quote = 'A oferta proposta custa R$ 6.000.';
    const callAI = vi.fn().mockResolvedValueOnce(invalid).mockResolvedValueOnce(fixed);
    const result = await generatePresentationPlan(config, callAI);
    expect(result.plan.evidence[1]).toMatchObject({ status: 'proposal', quote: 'A oferta proposta custa R$ 6.000.' });
    expect(callAI.mock.calls[1][0]).toContain('não transforme proposta em fato');
  });

  it('interrupções repetidas terminam com mensagem de planejamento, sem loop e sem mensagem privada do provedor', async () => {
    const callAI = vi.fn().mockRejectedValue(failure('ai_output_truncated'));
    const error = await generatePresentationPlan(config, callAI).catch(error => error);
    expect(error.code).toBe('presentation_plan_incomplete');
    expect(error.message).toContain('mesmas escolhas');
    expect(JSON.stringify(error)).not.toContain('Provider details');
    expect(callAI).toHaveBeenCalledTimes(2);
  });

  it('não repete autenticação, quota, rede nem outros erros operacionais', async () => {
    const original = failure('unauthorized'); const callAI = vi.fn().mockRejectedValue(original);
    await expect(generatePresentationPlan(config, callAI)).rejects.toBe(original);
    expect(callAI).toHaveBeenCalledTimes(1);
  });

  it('cancelamento impede uma recuperação após a primeira resposta', async () => {
    const controller = new AbortController();
    const callAI = vi.fn().mockImplementation(async () => { controller.abort(); throw failure('ai_output_truncated'); });
    await expect(generatePresentationPlan({ ...config, aiOptions: { signal: controller.signal } }, callAI)).rejects.toBeTruthy();
    expect(callAI).toHaveBeenCalledTimes(1);
  });

  it('descarta plano tardio quando cancelado e não publica a prévia', async () => {
    const controller = new AbortController(); const onPlan = vi.fn();
    const callAI = vi.fn().mockImplementation(async () => { controller.abort(); return plan(); });
    await expect(generatePresentationPlan({ ...config, aiOptions: { signal: controller.signal }, onPlan }, callAI)).rejects.toBeTruthy();
    expect(onPlan).not.toHaveBeenCalled();
  });

  it('sinal já cancelado não chama o provedor', async () => {
    const controller = new AbortController(); controller.abort(); const callAI = vi.fn();
    await expect(generatePresentationPlan({ ...config, aiOptions: { signal: controller.signal } }, callAI)).rejects.toBeTruthy();
    expect(callAI).not.toHaveBeenCalled();
  });
  it('quantidade inválida não gasta chamada de IA', async () => {
    const callAI = vi.fn();
    await expect(generatePresentationPlan({ ...config, count: 0 }, callAI)).rejects.toMatchObject({ code: 'presentation_input_invalid' });
    expect(callAI).not.toHaveBeenCalled();
  });
  it('coleta somente metadados operacionais e preserva o callback do chamador', async () => {
    const onResponseMetadata = vi.fn();
    const metadata = { provider: 'zai', model: 'glm-4.7', finishReason: 'stop', maxTokens: 8192, completionTokens: 1100, reasoningTokens: 0, content: 'segredo', reasoningContent: 'privado' };
    const callAI = vi.fn().mockImplementation(async (_prompt, options) => { options.onResponseMetadata(metadata); return plan(); });
    const result = await generatePresentationPlan({ ...config, aiOptions: { onResponseMetadata } }, callAI);
    expect(result.diagnostics[0].response).toEqual({ provider: 'zai', model: 'glm-4.7', finishReason: 'stop', maxTokens: 8192, completionTokens: 1100, reasoningTokens: 0 });
    expect(JSON.stringify(result.diagnostics)).not.toMatch(/segredo|privado/);
    expect(onResponseMetadata).toHaveBeenCalledWith(metadata);
  });
  it('guarda o motivo e o orçamento da interrupção sem capturar o corpo ou mensagem', async () => {
    const truncated = failure('ai_output_truncated'); truncated.aiDiagnostics = { provider: 'zai', finishReason: 'length', completionTokens: 8192, response: 'segredo' };
    const callAI = vi.fn().mockRejectedValueOnce(truncated).mockResolvedValueOnce(plan());
    const result = await generatePresentationPlan(config, callAI);
    expect(result.diagnostics[0].response).toEqual({ provider: 'zai', finishReason: 'length', completionTokens: 8192 });
    expect(JSON.stringify(result.diagnostics)).not.toMatch(/segredo|Provider/);
  });
});

describe('parser privado de planejamento', () => {
  it('aceita objeto JSON completo e fence externa', () => {
    expect(parsePresentationPlanResponse(JSON.stringify(plan()))).toEqual(plan());
    expect(parsePresentationPlanResponse('```json\n' + JSON.stringify(plan()) + '\n```')).toEqual(plan());
  });
  it('rejeita JSON incompleto sem recortar objeto interno ou logar conteúdo', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(() => parsePresentationPlanResponse('{"private":"segredo", "slides":[{"index":1}]')).toThrow('roteiro completo');
      expect(warn).not.toHaveBeenCalled();
    } finally { warn.mockRestore(); }
  });
});
