import { afterEach, describe, expect, it, vi } from 'vitest';
import { callAI, setAIRuntimeSettings } from '../../src/utils/ai-client.js';

afterEach(() => { vi.unstubAllGlobals(); setAIRuntimeSettings({}); });

describe('saída programática de apresentações', () => {
  it('reserva a resposta para JSON nas apresentações sem alterar outras chamadas', async () => {
    setAIRuntimeSettings({ textProvider: 'zai', keys: { zai: 'synthetic-key' } });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }], usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 } }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    const metadata = vi.fn();
    await callAI('planejar', { json: true, contentMode: 'presentation', thinking: 'disabled', onResponseMetadata: metadata });
    await callAI('publicação', { json: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).payload.thinking).toEqual({ type: 'disabled' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).payload.thinking).toBeUndefined();
    expect(metadata).toHaveBeenCalledWith(expect.objectContaining({ provider: 'zai', finishReason: 'stop', completionTokens: 30 }));
    expect(JSON.stringify(metadata.mock.calls)).not.toContain('synthetic-key');
    expect(JSON.stringify(metadata.mock.calls)).not.toContain('"ok"');
  });

  it('preserva diagnóstico de corte sem expor texto ou raciocínio', async () => {
    setAIRuntimeSettings({ textProvider: 'zai', keys: { zai: 'synthetic-key' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: 'PRIVATE-CONTENT', reasoning_content: 'PRIVATE-REASONING' } }], usage: { prompt_tokens: 12, completion_tokens: 4096, total_tokens: 4108 } }), { status: 200 })));
    let failure;
    try { await callAI('roteiro', { json: true }); } catch (error) { failure = error; }
    expect(failure).toMatchObject({ code: 'ai_output_truncated', aiDiagnostics: { provider: 'zai', maxTokens: 4096, completionTokens: 4096, finishReason: 'length' } });
    expect(JSON.stringify(failure)).not.toContain('PRIVATE');
  });
  it('usa a temperatura da etapa planejada sem alterar o padrão social seguinte', async () => {
    setAIRuntimeSettings({ textProvider: 'zai', keys: { zai: 'synthetic-key' } });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }] }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    await callAI('planejamento', { json: true, contentMode: 'presentation', temperature: 0.2 });
    await callAI('publicação', { json: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).payload.temperature).toBe(0.2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).payload.temperature).toBe(0.8);
  });

  it.each(['zai', 'kimi', 'openai', 'anthropic'])('não tenta recuperar JSON cortado do provedor %s', async provider => {
    setAIRuntimeSettings({ textProvider: provider, keys: { [provider]: 'synthetic-key' } });
    const data = provider === 'anthropic'
      ? { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"slides":[]}' }] }
      : { choices: [{ finish_reason: 'length', message: { content: '{"slides":[]}' } }] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(callAI('roteiro', { json: true, contentMode: 'presentation' })).rejects.toMatchObject({ code: 'ai_output_truncated' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
