// MOO-16 — cadastro, login e checkout anônimo não revelam se o e-mail tem conta.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { stripeMock, resetStripeMock } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));
vi.mock('../../api/lib/library-sync-store.js', () => ({
  getLibrarySyncMeta: vi.fn().mockResolvedValue(null),
}));
const tasks = vi.hoisted(() => []);
vi.mock('@vercel/functions', () => ({ waitUntil: promise => tasks.push(promise) }));

import { makeReq, makeRes, cookieValue } from '../helpers/http.js';
import { COOKIE_NAME } from '../../api/lib/access.js';
import { hashPassword } from '../../api/lib/password-auth.js';
import loginHandler from '../../api/auth/login.js';
import registerHandler from '../../api/auth/register.js';
import checkoutHandler from '../../api/stripe/checkout.js';

const post = body => makeReq({ method: 'POST', body });
let mail;

beforeEach(() => {
  resetStripeMock();
  tasks.length = 0;
  vi.stubEnv('RESEND_API_KEY', 're_test_not_real');
  vi.stubEnv('AUTH_EMAIL_FROM', 'Moont <acesso@teste.exemplo>');
  mail = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', mail);
});
afterEach(async () => {
  await Promise.all(tasks);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('login sem candidato faz o mesmo trabalho de scrypt (MOO-16a)', () => {
  it('e-mail inexistente ainda roda um scrypt antes de responder 401', async () => {
    stripeMock.customers.list.mockResolvedValue({ data: [] });
    const scrypt = vi.spyOn(crypto, 'scryptSync');
    const res = makeRes();
    await loginHandler(post({ email: 'ninguem@teste.exemplo', password: 'QualquerSenha123!' }), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('E-mail ou senha incorretos.');
    expect(scrypt).toHaveBeenCalledTimes(1);
  });

  it('conta só com Google (sem senha) também roda um scrypt', async () => {
    stripeMock.customers.list.mockResolvedValue({ data: [
      { id: 'cus_google', email: 'google@teste.exemplo', metadata: { vc_google_sub: 'sub-1' } },
    ] });
    const scrypt = vi.spyOn(crypto, 'scryptSync');
    const res = makeRes();
    await loginHandler(post({ email: 'google@teste.exemplo', password: 'QualquerSenha123!' }), res);
    expect(res.statusCode).toBe(401);
    expect(scrypt).toHaveBeenCalledTimes(1);
  });

  it('conta com senha errada roda o mesmo único scrypt e responde a mesma mensagem', async () => {
    const { salt, hash } = hashPassword('SenhaCerta123!');
    stripeMock.customers.list.mockResolvedValue({ data: [
      { id: 'cus_dona', email: 'dona@teste.exemplo', metadata: { vc_pw_salt: salt, vc_pw_hash: hash } },
    ] });
    const scrypt = vi.spyOn(crypto, 'scryptSync');
    const res = makeRes();
    await loginHandler(post({ email: 'dona@teste.exemplo', password: 'SenhaErrada123!' }), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('E-mail ou senha incorretos.');
    expect(scrypt).toHaveBeenCalledTimes(1);
  });
});

describe('cadastro de e-mail existente não revela a conta (MOO-16b)', () => {
  const existente = { id: 'cus_dona', email: 'dona@teste.exemplo', metadata: {} };

  it('responde 200 neutro, sem sessão, sem tocar na conta e avisa a dona por e-mail', async () => {
    stripeMock.customers.list.mockResolvedValue({ data: [existente] });
    const res = makeRes();
    await registerHandler(post({ email: 'Dona@Teste.Exemplo', password: 'SenhaDeAlguem123!' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ checkEmail: true });
    expect(res.body.requireLogin).toBeUndefined();
    expect(res.body.message).toMatch(/confira seu e-mail/i);
    expect(JSON.stringify(res.body)).not.toMatch(/já tem conta|já cadastrad/i);
    expect(cookieValue(res, COOKIE_NAME)).toBeNull();
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
    expect(stripeMock.customers.update).not.toHaveBeenCalled();

    await Promise.all(tasks);
    expect(mail).toHaveBeenCalledTimes(1);
    const [url, init] = mail.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    const sent = JSON.parse(init.body);
    expect(sent.to).toEqual(['dona@teste.exemplo']);
    expect(sent.text).toMatch(/já tem uma conta/i);
    expect(sent.text).toMatch(/Esqueci minha senha/);
    expect(sent.text).toContain('https://moont.ai/');
    expect(init.headers['Idempotency-Key']).toMatch(/^account-exists-mail-/);
  });

  it('o e-mail é enviado depois da resposta (waitUntil), sem atrasar o caminho do e-mail existente', async () => {
    stripeMock.customers.list.mockResolvedValue({ data: [existente] });
    const res = makeRes();
    await registerHandler(post({ email: existente.email, password: 'SenhaDeAlguem123!' }), res);
    expect(res.ended).toBe(true);
    expect(tasks).toHaveLength(1);
  });

  it('o caminho do e-mail existente também calcula o hash da senha (tempo parecido com o cadastro novo)', async () => {
    stripeMock.customers.list.mockResolvedValue({ data: [existente] });
    const scrypt = vi.spyOn(crypto, 'scryptSync');
    await registerHandler(post({ email: existente.email, password: 'SenhaDeAlguem123!' }), makeRes());
    expect(scrypt).toHaveBeenCalledTimes(1);
  });

  it('sem Resend configurado a resposta continua neutra e nada é enviado', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    stripeMock.customers.list.mockResolvedValue({ data: [existente] });
    const res = makeRes();
    await registerHandler(post({ email: existente.email, password: 'SenhaDeAlguem123!' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.checkEmail).toBe(true);
    await Promise.all(tasks);
    expect(mail).not.toHaveBeenCalled();
  });

  it('cadastro concorrente que perde a corrida recebe a mesma resposta neutra', async () => {
    stripeMock.customers.list.mockResolvedValue({ data: [], has_more: false });
    stripeMock.customers.create.mockResolvedValue({ id: 'cus_corrida', email: 'corrida@teste.exemplo', metadata: {} });
    stripeMock.customers.update.mockRejectedValue(Object.assign(new Error('same key'), { type: 'StripeIdempotencyError' }));
    const res = makeRes();
    await registerHandler(post({ email: 'corrida@teste.exemplo', password: 'SenhaCorrida123!' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.checkEmail).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/já tem conta|acabou de ser cadastrad/i);
    expect(cookieValue(res, COOKIE_NAME)).toBeNull();
  });

  it('cadastro novo continua entrando direto no plano grátis', async () => {
    const res = makeRes();
    await registerHandler(post({ email: 'nova@teste.exemplo', password: 'MinhaSenha123!' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ active: false, free: true, plan: 'free' });
    expect(res.body.checkEmail).toBeUndefined();
    expect(cookieValue(res, COOKIE_NAME)).toBeTruthy();
    await Promise.all(tasks);
    expect(mail).not.toHaveBeenCalled();
  });
});

describe('checkout anônimo com e-mail existente usa mensagem neutra (MOO-16)', () => {
  it('pede para entrar sem afirmar que o e-mail tem conta', async () => {
    stripeMock.customers.list.mockResolvedValue({ data: [{ id: 'cus_9', email: 'user9@teste.exemplo' }] });
    const res = makeRes();
    await checkoutHandler(post({ email: 'user9@teste.exemplo' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.requireLogin).toBe(true);
    expect(res.body.message).toMatch(/entre na sua conta/i);
    expect(res.body.message).not.toMatch(/já tem conta|já tem assinatura/i);
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
  });
});
