import { afterEach, describe, expect, it, vi } from 'vitest';
import { callAI, setAIRuntimeSettings } from '../../src/utils/ai-client.js';

afterEach(() => { vi.unstubAllGlobals(); setAIRuntimeSettings({}); });

describe('saída programática de apresentações', () => {
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
