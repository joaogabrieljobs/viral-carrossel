import { afterEach, describe, expect, it, vi } from 'vitest';
import { callAnthropic, callCompatibleChat, setAIRuntimeSettings } from '../../src/utils/ai-client.js';
import { DEFAULT_AI_SETTINGS } from '../../src/config/ai-providers.js';
import { requireActiveSubscription, resetActiveAccessCacheForTests } from '../../api/lib/require-access.js';
import { makeReq, makeRes } from '../helpers/http.js';

// Auditoria 23/11 (IA-07): o 401 do provedor (chave própria errada, chave da
// plataforma vencida) chegava ao usuário como "Sessão expirada".
const reply = (status, body, headers = {}) => ({ ok: status < 400, status, headers: new Headers(headers), text: async () => JSON.stringify(body) });
const withKeys = (keys) => setAIRuntimeSettings({ ...DEFAULT_AI_SETTINGS, keys: { ...DEFAULT_AI_SETTINGS.keys, ...keys } });

describe('auditoria 23/11 IA-07: 401 do provedor não é sessão expirada', () => {
  afterEach(() => { vi.unstubAllGlobals(); setAIRuntimeSettings(DEFAULT_AI_SETTINGS); resetActiveAccessCacheForTests(); });

  it('Kimi com chave própria recusada pede para conferir a chave', async () => {
    withKeys({ kimi: 'chave-errada' });
    vi.stubGlobal('fetch', vi.fn(async () => reply(401, { error: { message: 'Invalid Authentication', type: 'invalid_authentication_error' } })));
    const error = await callCompatibleChat('kimi', 'oi', {}).catch((e) => e);
    expect(error.message).toMatch(/Chave recusada pelo provedor/);
    expect(error.message).toMatch(/Configurar IA/);
    expect(error.code).toBe('provider_key_rejected');
  });

  it('Claude com chave própria recusada pede para conferir a chave', async () => {
    withKeys({ anthropic: 'chave-errada' });
    vi.stubGlobal('fetch', vi.fn(async () => reply(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } })));
    const error = await callAnthropic('oi', {}).catch((e) => e);
    expect(error.message).toMatch(/Chave recusada pelo provedor/);
    expect(error.code).toBe('provider_key_rejected');
  });

  it('chave da plataforma recusada diz que a IA do plano está indisponível', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(401, { error: { message: 'token expired or incorrect', code: '1000' } })));
    const error = await callCompatibleChat('zai', 'oi', {}).catch((e) => e);
    expect(error.message).toMatch(/IA incluída no plano está indisponível/);
    expect(error.code).not.toBe('session_required');
  });

  it('401 marcado pelo portão do Moont continua sendo sessão expirada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(401, { error: { message: 'Faça login pela assinatura para usar este recurso.', code: 'session_required' } }, { 'x-moont-gate': 'session' })));
    const error = await callCompatibleChat('zai', 'oi', {}).catch((e) => e);
    expect(error.message).toMatch(/Sessão expirada/);
    expect(error).toMatchObject({ status: 401, code: 'session_required' });
  });

  it('402 marcado pelo portão continua sendo assinatura inativa', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(402, { error: { message: 'Assinatura inativa. Renove o plano para continuar.', code: 'subscription_inactive' } })));
    const error = await callCompatibleChat('zai', 'oi', {}).catch((e) => e);
    expect(error).toMatchObject({ status: 402, code: 'subscription_inactive' });
  });

  it('o portão marca a própria recusa no cabeçalho e no corpo, sem mudar a mensagem', async () => {
    const res = makeRes();
    const access = await requireActiveSubscription(makeReq({ method: 'POST' }), res, { errorShape: 'nested' });
    expect(access).toBeNull();
    expect(res.statusCode).toBe(401);
    expect(res.getHeader('x-moont-gate')).toBe('session');
    expect(res.body.error).toMatchObject({ message: 'Faça login pela assinatura para usar este recurso.', code: 'session_required' });
  });

  it('no formato simples o corpo do portão não muda', async () => {
    const res = makeRes();
    await requireActiveSubscription(makeReq({ method: 'POST' }), res);
    expect(res.body).toEqual({ error: 'Faça login pela assinatura para usar este recurso.' });
    expect(res.getHeader('x-moont-gate')).toBe('session');
  });
});
