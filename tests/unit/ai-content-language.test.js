import { afterEach, describe, expect, it, vi } from 'vitest';
import { callAI, setAIRuntimeSettings } from '../../src/utils/ai-client.js';

afterEach(() => {
  vi.unstubAllGlobals();
  setAIRuntimeSettings({});
});

// Assert the actual transport payload, not just an exported prompt constant:
// the old system message overruled English requested in the user's brief.
describe('idioma do conteúdo no transporte de texto', () => {
  it.each(['zai', 'kimi', 'openai', 'anthropic'])('preserva o pedido completo de idioma no provedor %s', async provider => {
    setAIRuntimeSettings({ textProvider: provider, keys: { [provider]: 'synthetic-key' } });
    const response = provider === 'anthropic'
      ? { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"slides":[]}' }] }
      : { choices: [{ finish_reason: 'stop', message: { content: '{"slides":[]}' } }] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const brief = 'MATÉRIA-PRIMA: A local business needs a clear mobile website.\nINSTRUÇÕES ADICIONAIS: Write everything in English.';
    await callAI(brief, { json: true });

    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    const payload = request.payload || request;
    const system = payload.system || payload.messages.find(message => message.role === 'system').content;
    const user = payload.messages.find(message => message.role === 'user').content;
    expect(user).toBe(brief);
    expect(system).toContain('inclusive nas Instruções adicionais, em TODO o texto visível');
    expect(system).toContain('title, subtitle, bodyAfterImage e caption');
    expect(system).toContain('Sem pedido explícito de idioma, siga a língua predominante do briefing');
    expect(system).toContain('Use português brasileiro apenas quando');
    expect(system).not.toContain('outro idioma apenas num campo isolado');
    expect(system).not.toContain('Use português brasileiro em todo texto visível');
  });

  it('não adivinha idioma por palavras isoladas e mantém a regra também na revisão', async () => {
    setAIRuntimeSettings({ textProvider: 'zai' });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content: '{"edits":[]}' } }],
    }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    const prompts = [
      'Campanha de Black Friday: escreva em português brasileiro. imageQuery em inglês.',
      'REVISÃO EDITORIAL: preserve a língua do rascunho. {"title":"Your next step","subtitle":"Request a website review."}',
    ];
    for (const prompt of prompts) await callAI(prompt, { json: true });
    const payloads = fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body).payload);
    expect(payloads[0].messages[0].content).toBe(payloads[1].messages[0].content);
    expect(payloads[1].messages[0].content).toContain('Em revisão ou refinamento, preserve a língua do conteúdo atual');
    expect(payloads[1].messages[0].content).toContain('palavras-chave de imagem não definem o idioma');
    expect(payloads.map(payload => payload.messages[1].content)).toEqual(prompts);
  });
});
