import { afterEach, describe, expect, it, vi } from 'vitest';
import { callCompatibleChat } from '../../src/utils/ai-client.js';
import { presentationInterruptionMessage } from '../../src/components/EditorialReviewNotice.jsx';

// Auditoria 23/11 (IA-01): quem batia no limite diário de texto lia "Aguarde
// um momento e tente novamente" e o app repetia o pedido em cascata.
const SERVER_MESSAGE = 'Você atingiu o limite diário de 150 pedidos de texto incluídos no plano. Ele volta à meia-noite, ou use sua própria chave em Configurar IA.';
const reply = (status, body, headers = {}) => ({ ok: status < 400, status, headers: new Headers(headers), text: async () => JSON.stringify(body) });

describe('auditoria 23/11 IA-01: limite diário de texto no cliente', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('para no primeiro pedido e mostra a frase do servidor', async () => {
    const fetchMock = vi.fn(async () => reply(429, { error: { message: SERVER_MESSAGE, code: 'text_quota_exhausted' } }));
    vi.stubGlobal('fetch', fetchMock);
    const error = await callCompatibleChat('zai', 'oi', {}).catch((e) => e);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({ status: 429, code: 'text_quota_exhausted' });
    expect(error.message).toMatch(/limite diário/);
    expect(error.message).toMatch(/Configurar IA/);
  });

  it('429 de sobrecarga do provedor continua tentando o próximo modelo', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reply(429, { error: { message: 'Rate limit reached', code: '1302' } }))
      .mockResolvedValue(reply(200, { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(callCompatibleChat('zai', 'oi', {})).resolves.toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('na apresentação, o aviso cita o limite diário', () => {
    expect(presentationInterruptionMessage('text_quota_exhausted')).toMatch(/limite diário/);
  });
});
