import { afterEach, describe, expect, it, vi } from 'vitest';
import { TEXT_PROVIDERS } from '../../src/config/ai-providers.js';
import { callAnthropic, callOpenAIChat, setAIRuntimeSettings } from '../../src/utils/ai-client.js';

// Teste de custo 22/11: GLM-4.7 × Claude Haiku 5.5 × GPT-6 Luna pela própria
// tela "Configurar IA" (chave do usuário). Os dois modelos não estavam na lista.
function stubFetch(responseBody) {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(responseBody), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

describe('Haiku 5.5 e GPT-6 Luna na chave própria', () => {
  it('os dois modelos aparecem em Configurar IA', () => {
    expect(TEXT_PROVIDERS.anthropic.models.map(model => model.id)).toContain('claude-haiku-5-5');
    expect(TEXT_PROVIDERS.openai.models.map(model => model.id)).toContain('gpt-6-luna');
  });

  it('Haiku 5.5 recebe o raciocínio desligado quando a geração pede (como o GLM)', async () => {
    setAIRuntimeSettings({ textProvider: 'anthropic', textModels: { anthropic: 'claude-haiku-5-5' }, keys: { anthropic: 'sk-ant-teste' } });
    const calls = stubFetch({ content: [{ type: 'text', text: '{"ok":true}' }], stop_reason: 'end_turn' });
    expect(await callAnthropic('pedido', { json: true, thinking: 'disabled' })).toEqual({ ok: true });
    expect(calls[0].body).toMatchObject({ model: 'claude-haiku-5-5', thinking: { type: 'disabled' } });
    expect(calls[0].body).not.toHaveProperty('temperature');
  });

  it('modelos Claude anteriores não recebem o campo novo', async () => {
    setAIRuntimeSettings({ textProvider: 'anthropic', textModels: { anthropic: 'claude-sonnet-5' }, keys: { anthropic: 'sk-ant-teste' } });
    const calls = stubFetch({ content: [{ type: 'text', text: '{"ok":true}' }], stop_reason: 'end_turn' });
    await callAnthropic('pedido', { json: true, thinking: 'disabled' });
    expect(calls[0].body).not.toHaveProperty('thinking');
  });

  it('GPT-6 Luna recebe reasoning_effort none e o JSON vem pelo pedido', async () => {
    setAIRuntimeSettings({ textProvider: 'openai', textModels: { openai: 'gpt-6-luna' }, keys: { openai: 'sk-proj-teste' } });
    const calls = stubFetch({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }] });
    expect(await callOpenAIChat('pedido', { json: true, thinking: 'disabled', key: 'sk-proj-teste' })).toEqual({ ok: true });
    expect(calls[0].body).toMatchObject({ model: 'gpt-6-luna', reasoning_effort: 'none' });
    expect(calls[0].body).not.toHaveProperty('response_format');
  });

  it('GPT-5.6 continua como antes', async () => {
    setAIRuntimeSettings({ textProvider: 'openai', textModels: { openai: 'gpt-5.6-luna' }, keys: { openai: 'sk-proj-teste' } });
    const calls = stubFetch({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }] });
    await callOpenAIChat('pedido', { json: true, thinking: 'disabled', key: 'sk-proj-teste' });
    expect(calls[0].body.response_format).toEqual({ type: 'json_object' });
    expect(calls[0].body).not.toHaveProperty('reasoning_effort');
  });
});
