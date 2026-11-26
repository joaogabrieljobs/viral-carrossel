import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackEvent } from '../../src/utils/telemetry.js';
import { registerWithPassword, startCheckout } from '../../src/lib/billing.js';

function janela() {
  const ga4 = vi.fn();
  const plausible = vi.fn();
  vi.stubGlobal('window', { moontGA4: { evento: ga4 }, plausible });
  return { ga4, plausible };
}

function resposta(ok, corpo = {}) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => corpo })));
}

afterEach(() => vi.unstubAllGlobals());

describe('eventos do GA4', () => {
  it('repassa só a lista permitida, sem propriedades', () => {
    const { ga4, plausible } = janela();
    for (const nome of ['landing_complete', 'paywall_open', 'sign_up', 'begin_checkout']) {
      trackEvent(nome, { email: 'a@b.c' });
    }
    trackEvent('logout');
    expect(ga4.mock.calls).toEqual([['landing_complete'], ['paywall_open'], ['sign_up'], ['begin_checkout']]);
    expect(plausible).toHaveBeenCalledTimes(5);
  });

  it('chega ao GA4 mesmo com o Plausible bloqueado', () => {
    const ga4 = vi.fn();
    vi.stubGlobal('window', { moontGA4: { evento: ga4 } });
    trackEvent('paywall_open');
    expect(ga4).toHaveBeenCalledWith('paywall_open');
  });

  it('cadastro com sucesso dispara sign_up; com erro não dispara', async () => {
    const { ga4 } = janela();
    resposta(true, { ok: true });
    await registerWithPassword('a@b.c', 'senha-de-teste');
    expect(ga4.mock.calls).toEqual([['sign_up']]);

    ga4.mockClear();
    resposta(false, { error: 'já existe' });
    await expect(registerWithPassword('a@b.c', 'senha-de-teste')).rejects.toThrow('já existe');
    expect(ga4).not.toHaveBeenCalled();
  });

  it('checkout com sucesso dispara begin_checkout; com erro não dispara', async () => {
    const { ga4 } = janela();
    resposta(true, { url: 'https://checkout.stripe.com/x' });
    await startCheckout('a@b.c');
    expect(ga4.mock.calls).toEqual([['begin_checkout']]);

    ga4.mockClear();
    resposta(false, { error: 'falhou' });
    await expect(startCheckout('a@b.c')).rejects.toThrow('falhou');
    expect(ga4).not.toHaveBeenCalled();
  });
});
