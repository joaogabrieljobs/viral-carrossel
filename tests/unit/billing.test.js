// Task 02 — RF-03: client de billing (fetch stubado — RNF-02, sem rede).
// NOTA: em Vitest import.meta.env.DEV === true, então os caminhos de fallback
// dev de fetchAccessSession são os testáveis aqui; os de produção ficam pro E2E.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchAccessSession,
  startCheckout,
  confirmCheckoutSession,
  openBillingPortal,
  logoutAccess,
} from '../../src/lib/billing.js';

const jsonResponse = (body, ok = true) => ({
  ok,
  json: () => Promise.resolve(body),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchAccessSession', () => {
  it('sessão ativa retorna o JSON do servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ active: true, email: 'user1@teste.exemplo', status: 'active' }),
    ));
    const s = await fetchAccessSession();
    expect(s.active).toBe(true);
    expect(s.email).toBe('user1@teste.exemplo');
    expect(fetch).toHaveBeenCalledWith('/api/auth/session', expect.objectContaining({ credentials: 'include' }));
  });

  it('falha de rede em DEV cai no fallback local (billingDisabled)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const s = await fetchAccessSession();
    expect(s).toEqual({ active: true, billingDisabled: true, devFallback: true });
  });
});

describe('startCheckout / confirmCheckoutSession / openBillingPortal', () => {
  it('guarda o checkout na aba e confirma sem expor id na URL', async () => {
    const values = new Map();
    vi.stubGlobal('sessionStorage', {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    });
    const spy = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ url: 'https://checkout.stripe.com/x', sessionId: 'cs_aba_1' }))
      .mockResolvedValueOnce(jsonResponse({ active: true }));
    vi.stubGlobal('fetch', spy);
    await startCheckout('user1@teste.exemplo');
    expect(values.get('vc_pending_checkout')).toBe('cs_aba_1');
    await confirmCheckoutSession();
    expect(JSON.parse(spy.mock.calls[1][1].body)).toEqual({ sessionId: 'cs_aba_1' });
    expect(values.has('vc_pending_checkout')).toBe(false);
  });

  it('checkout ok devolve url; erro lança a mensagem do servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ url: 'https://checkout.stripe.com/x' })));
    await expect(startCheckout('user1@teste.exemplo')).resolves.toEqual({ url: 'https://checkout.stripe.com/x' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Informe um e-mail válido' }, false)));
    await expect(startCheckout('x')).rejects.toThrow('Informe um e-mail válido');
  });

  it('confirm envia sessionId no body e propaga erro', async () => {
    const spy = vi.fn().mockResolvedValue(jsonResponse({ active: true }));
    vi.stubGlobal('fetch', spy);
    await confirmCheckoutSession('cs_teste_1');
    expect(JSON.parse(spy.mock.calls[0][1].body)).toEqual({ sessionId: 'cs_teste_1' });

    const bare = vi.fn().mockResolvedValue(jsonResponse({ active: true }));
    vi.stubGlobal('fetch', bare);
    await confirmCheckoutSession();
    expect(JSON.parse(bare.mock.calls[0][1].body)).toEqual({});

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false)));
    await expect(confirmCheckoutSession('cs_x')).rejects.toThrow('Não foi possível confirmar a assinatura');
  });

  it('portal ok devolve url do Stripe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ url: 'https://billing.stripe.com/p' })));
    await expect(openBillingPortal()).resolves.toEqual({ url: 'https://billing.stripe.com/p' });
  });
});

describe('logoutAccess', () => {
  it('propaga falha de rede para não fingir que o cookie saiu', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(logoutAccess()).rejects.toThrow('offline');
  });

  it('retorna aviso quando apenas o cookie local foi limpo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      ok: true, localCookieCleared: true, sessionsRevoked: false, warning: 'revocation_failed',
    })));
    await expect(logoutAccess()).resolves.toMatchObject({ sessionsRevoked: false, warning: 'revocation_failed' });
  });

  it('resposta inválida não confirma logout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: false }, false)));
    await expect(logoutAccess()).rejects.toThrow('Não foi possível confirmar a saída');
  });
});
