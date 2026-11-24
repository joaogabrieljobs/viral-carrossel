import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as providers from '../../src/config/ai-providers.js';
import { callCompatibleChat, callOpenAIChat, setAIRuntimeSettings } from '../../src/utils/ai-client.js';

// Auditoria 23/11 (GB-06): Configurar IA dizia que as chaves "só são enviadas
// ao provedor escolhido". Só a da OpenAI vai direto; Claude e Kimi passam pelo
// servidor do Moont (que não as guarda).
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const reply = (body) => ({ ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(body) });
const completion = { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] };
const withKeys = (keys) => setAIRuntimeSettings({ ...providers.DEFAULT_AI_SETTINGS, keys: { ...providers.DEFAULT_AI_SETTINGS.keys, ...keys } });

describe('auditoria 23/11 GB-06: o texto de privacidade das chaves descreve o caminho real', () => {
  afterEach(() => { vi.unstubAllGlobals(); setAIRuntimeSettings(providers.DEFAULT_AI_SETTINGS); });

  it('a chave do Kimi passa pelo servidor do Moont', async () => {
    withKeys({ kimi: 'chave-kimi' });
    const fetchMock = vi.fn(async () => reply(completion));
    vi.stubGlobal('fetch', fetchMock);
    await callCompatibleChat('kimi', 'oi', {});
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ai/compatible');
    expect(JSON.parse(options.body).apiKey).toBe('chave-kimi');
  });

  it('a chave do Claude passa pelo servidor do Moont em produção', () => {
    expect(JSON.parse(read('vercel.json')).build.env.VITE_ANTHROPIC_PROXY).toBe('true');
    expect(read('src/utils/ai-client.js')).toMatch(/headers\['x-anthropic-key'\] = anthropicKey/);
  });

  it('a chave da OpenAI vai direto do navegador para a OpenAI', async () => {
    const fetchMock = vi.fn(async () => reply(completion));
    vi.stubGlobal('fetch', fetchMock);
    await callOpenAIChat('oi', { key: 'chave-openai' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/^https:\/\/api\.openai\.com\//);
    expect(options.headers.Authorization).toBe('Bearer chave-openai');
  });

  it('o texto não promete envio só ao provedor e explica a passagem pelo servidor', () => {
    expect(providers.AI_KEY_PRIVACY_NOTE).toMatch(/Não guardamos suas chaves/);
    expect(providers.AI_KEY_PRIVACY_NOTE).toMatch(/OpenAI vai direto do seu navegador/);
    expect(providers.AI_KEY_PRIVACY_NOTE).toMatch(/passam pelo nosso servidor só para chegar ao provedor/);
    const modal = read('src/components/KeysModal.jsx');
    expect(modal).toContain('{AI_KEY_PRIVACY_NOTE}');
    expect(modal).not.toMatch(/só são enviadas ao provedor/);
  });
});
