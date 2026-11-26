import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateDALLE, generateDALLEWithRetry, planImagePrompt, setAIRuntimeSettings } from '../../src/utils/ai-client.js';
import { composeImageDirection } from '../../src/utils/image-direction.js';
import * as budget from '../../src/utils/image-prompt-budget.js';

// Auditoria 23/11 (IA-02): no gerador do plano o pedido tem 4.000 caracteres.
// Quando não cabe, o estilo do projeto, a ficha visual e o mapa de referências
// são reduzidos ou saem inteiros. Ninguém lia `dropped`/`trimmed`: o app
// gerava, debitava e mostrava a imagem como se o pedido tivesse ido completo.
// Nenhum teste aqui chama IA: `fetch` é simulado.
const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');

afterEach(() => {
  vi.unstubAllGlobals();
  setAIRuntimeSettings({});
});

const Q = 'baker shaping sourdough loaf on floured wooden table, morning window light';
const ficha4 = { entities: ['um', 'dois', 'tres', 'quatro'].map((id, i) => ({
  id, en: `subject number ${i + 1} ${'with a long but complete visible trait '.repeat(9)}end`.slice(0, 380), never: 'anything else on the table',
})) };
const estilo2400 = { stylePrompt: 'Use layered paper collage with visible fibres. '.repeat(60).slice(0, 2400), contextMd: '' };
const direcaoLonga = () => composeImageDirection({ styleKit: estilo2400, visualBible: ficha4, slide: { socialCompositionVersion: 4, socialFamily: 'revista' }, fmt: 'carrossel' });
const direcaoCurta = () => composeImageDirection({ styleKit: { stylePrompt: 'Use paper collage with muted warm colours.', contextMd: '' }, slide: {}, fmt: 'carrossel' });
const okFetch = () => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ b64_json: 'result' }) });

describe('auditoria 23/11 IA-02: corte do pedido de imagem é avisado antes do crédito', () => {
  it('o cenário do relatório corta o estilo do projeto na rota do plano', () => {
    const plan = planImagePrompt(Q, null, direcaoLonga(), { route: 'sjinn', aspectRatio: '4:5' });
    expect(plan.chars).toBeLessThanOrEqual(4000);
    expect(plan.trimmed).toContain('style');
  });

  it('generatePlatformSjinnImage expõe trimmed: [style] ao chamador antes de chamar fetch', async () => {
    setAIRuntimeSettings({ useOwnImageKey: false });
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    const seen = [];
    const onPromptPlan = vi.fn(async (plan) => {
      seen.push({ trimmed: plan.trimmed, fetchCalls: fetchMock.mock.calls.length });
      return true;
    });
    await generateDALLE(Q, '', null, { imageDirection: direcaoLonga(), aspectRatio: '4:5', onPromptPlan });
    expect(onPromptPlan).toHaveBeenCalledTimes(1);
    expect(seen[0].trimmed).toContain('style');
    expect(seen[0].fetchCalls).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ai/sjinn-image');
  });

  it('sem o sim do chamador, nada é enviado e nenhuma tentativa é repetida', async () => {
    setAIRuntimeSettings({ useOwnImageKey: false });
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    const onPromptPlan = vi.fn(async () => false);
    await expect(generateDALLEWithRetry(Q, '', null, { imageDirection: direcaoLonga(), aspectRatio: '4:5', onPromptPlan }))
      .rejects.toMatchObject({ code: 'image_prompt_declined' });
    expect(onPromptPlan).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('o aviso só fala de texto do usuário, não de bloco opcional do app', () => {
    expect(budget.imagePromptCutMessage({ trimmed: ['defaultArtDirection'], dropped: ['medium', 'treatment'] })).toBe('');
    expect(budget.imagePromptCutMessage({ trimmed: [], dropped: [] })).toBe('');
    expect(budget.imagePromptCutMessage(null)).toBe('');
    const message = budget.imagePromptCutMessage({ trimmed: ['style', 'defaultArtDirection'], dropped: ['subjects', 'referenceMap', 'medium'] });
    expect(message).toContain('gerador do plano');
    expect(message).toContain('Reduzido: o estilo do projeto.');
    expect(message).toContain('Fora do pedido: a ficha visual e o mapa das referências.');
  });

  it('projeto comum não recebe aviso', async () => {
    const plan = planImagePrompt(Q, null, direcaoCurta(), { route: 'sjinn', aspectRatio: '4:5' });
    expect(budget.imagePromptCutMessage(plan)).toBe('');
    const ask = vi.fn(() => true);
    expect(await budget.createImagePromptCutGate({ ask })(plan, 'projeto-1')).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it('o editor mostra o aviso e só então envia; o sim vale para o mesmo corte no projeto', async () => {
    setAIRuntimeSettings({ useOwnImageKey: false });
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    const order = [];
    fetchMock.mockImplementation(async () => { order.push('fetch'); return { ok: true, json: async () => ({ b64_json: 'result' }) }; });
    const ask = vi.fn((message) => { order.push('aviso'); expect(message).toContain('o estilo do projeto'); expect(message).toContain('crédito'); return true; });
    const gate = budget.createImagePromptCutGate({ ask });
    const generate = projectId => generateDALLE(Q, '', null, {
      imageDirection: direcaoLonga(), aspectRatio: '4:5', onPromptPlan: plan => gate(plan, projectId),
    });
    await generate('projeto-1');
    expect(order).toEqual(['aviso', 'fetch']);
    // Segunda imagem do mesmo projeto com o mesmo corte: não pergunta de novo.
    await generate('projeto-1');
    expect(ask).toHaveBeenCalledTimes(1);
    // Outro projeto pergunta.
    await generate('projeto-2');
    expect(ask).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('o não da pessoa não fica guardado e não chama fetch', async () => {
    setAIRuntimeSettings({ useOwnImageKey: false });
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    const ask = vi.fn(() => false);
    const gate = budget.createImagePromptCutGate({ ask });
    const options = { imageDirection: direcaoLonga(), aspectRatio: '4:5', onPromptPlan: plan => gate(plan, 'projeto-1') };
    await expect(generateDALLE(Q, '', null, options)).rejects.toMatchObject({ code: 'image_prompt_declined' });
    await expect(generateDALLE(Q, '', null, options)).rejects.toMatchObject({ code: 'image_prompt_declined' });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('as três gerações do editor passam o aviso e tratam o não sem marcar falha', () => {
    const calls = app.split('await generateDALLEWithRetry(').slice(1);
    // Direção de arte, parte 4: a arte de fundo do deck é a quarta geração.
    expect(calls).toHaveLength(4);
    for (const call of calls) expect(call.slice(0, 2600)).toContain('onPromptPlan: plan => imagePromptCutGateRef.current(plan,');
    expect(app.split("e?.code === 'image_prompt_declined'").length - 1).toBe(3);
    expect(app.split("?.code !== 'image_prompt_declined'").length - 1).toBe(2);
    expect(app).toContain("result?.reason === 'image_prompt_declined'");
    expect(app).toContain('createImagePromptCutGate({ ask: message => window.confirm(message) })');
  });
});
