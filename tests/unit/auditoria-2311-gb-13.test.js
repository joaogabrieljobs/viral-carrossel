// Auditoria 23/11 — GB-13: "Sair e apagar deste aparelho" pedia senha a quem
// entra só com Google. O diálogo pergunta ao servidor antes de pedir a senha.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStripeMock, stripeMock } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));

import { makeReq, makeRes } from '../helpers/http.js';
import { createAccessToken, COOKIE_NAME } from '../../api/lib/access.js';
import { hashPassword } from '../../api/lib/password-auth.js';
import loginHandler from '../../api/auth/login.js';
import { accountHasPassword } from '../../src/lib/billing.js';
import { WipeDeviceDialog } from '../../src/components/AccountProfile.jsx';

const cookieFor = (customerId, email) => `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId, email }))}`;
const confirmar = async (cookie, password) => {
  const res = makeRes();
  await loginHandler(makeReq({ method: 'POST', cookie, body: { purpose: 'confirm', password } }), res);
  return res;
};

beforeEach(resetStripeMock);
afterEach(() => vi.unstubAllGlobals());

describe('GB-13 — o servidor diz se a conta tem senha sem gastar tentativa', () => {
  it('conta só com Google: pergunta sem senha responde hasPassword: false', async () => {
    stripeMock.customers.retrieve.mockResolvedValue({ id: 'cus_gb13_google', email: 'g@teste.exemplo', metadata: { vc_google_sub: 'sub' } });
    const res = await confirmar(cookieFor('cus_gb13_google', 'g@teste.exemplo'), '');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ verified: false, hasPassword: false });
  });

  it('conta com senha: pergunta sem senha não confirma nada e não consome o limite de tentativas', async () => {
    const { salt, hash } = hashPassword('SenhaDaConta123!');
    const customer = { id: 'cus_gb13_senha', email: 'dona@teste.exemplo', metadata: { vc_pw_salt: salt, vc_pw_hash: hash } };
    stripeMock.customers.retrieve.mockResolvedValue(customer);
    const cookie = cookieFor(customer.id, customer.email);
    for (let i = 0; i < 8; i += 1) {
      const res = await confirmar(cookie, i % 2 ? '' : undefined);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ verified: false, hasPassword: true });
    }
    // Depois de 8 perguntas, a senha certa ainda passa: o teto de 5 é só para palpites.
    expect((await confirmar(cookie, 'SenhaDaConta123!')).body).toEqual({ verified: true, hasPassword: true });
  });

  it('sem sessão a pergunta não responde nada sobre senha', async () => {
    const res = await confirmar('', '');
    expect(res.statusCode).toBe(401);
    expect(res.body.hasPassword).toBeUndefined();
  });
});

describe('GB-13 — o cliente pergunta antes de pedir a senha', () => {
  it('accountHasPassword envia a pergunta sem senha e lê a resposta', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ verified: false, hasPassword: false }) });
    vi.stubGlobal('fetch', fetchSpy);
    await expect(accountHasPassword()).resolves.toBe(false);
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({ purpose: 'confirm', password: '' });
    fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ verified: false, hasPassword: true }) });
    await expect(accountHasPassword()).resolves.toBe(true);
  });

  const dialog = (props) => renderToStaticMarkup(React.createElement(WipeDeviceDialog, {
    open: true, email: 'g@teste.exemplo', onClose() {}, onConfirmed() {}, ...props,
  }));

  it('conta sem senha abre o diálogo já pedindo o e-mail', () => {
    const html = dialog({ hasPassword: false });
    expect(html).toContain('Digite seu e-mail para confirmar');
    expect(html).toContain('type="email"');
    expect(html).not.toContain('type="password"');
  });

  it('enquanto não sabe, o diálogo não pede senha', () => {
    const html = dialog({});
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain('type="email"');
    expect(html).toContain('Verificando');
  });

  it('conta com senha continua confirmando pela senha', () => {
    const html = dialog({ hasPassword: true });
    expect(html).toContain('type="password"');
    expect(html).not.toContain('Digite seu e-mail para confirmar');
  });
});
