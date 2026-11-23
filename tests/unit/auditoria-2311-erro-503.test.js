import { afterEach, describe, expect, it, vi } from 'vitest';
import { enhanceNetworkError, callCompatibleChat } from '../../src/utils/ai-client.js';

// Auditoria 23/11 (B5): 2 de 19 gerações do teste real falharam com
// "Moont AI: falha de rede... Verifique sua conexão com a internet" enquanto a
// aba Rede mostrava 503 em /api/ai/compatible.
describe('auditoria 23/11 B5: erro do servidor não vira falha de internet', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('com status 5xx a mensagem diz que o serviço falhou', () => {
    const error = enhanceNetworkError(Object.assign(new TypeError('network error'), { status: 503 }), 'Moont AI');
    expect(error.message).toContain('HTTP 503');
    expect(error.message).not.toMatch(/internet|conex/i);
  });

  it('o corpo do 503 que cai no meio leva o status até a mensagem', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, headers: new Headers(), text: async () => { throw new TypeError('network error'); } })));
    await expect(callCompatibleChat('zai', 'oi', {})).rejects.toThrow(/HTTP 503/);
  });

  it('sem resposta nenhuma continua falando de conexão', () => {
    expect(enhanceNetworkError(new TypeError('Failed to fetch'), 'Moont AI').message).toMatch(/falha de rede/);
  });
});
