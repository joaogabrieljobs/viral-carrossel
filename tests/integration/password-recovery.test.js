import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { stripeMock, resetStripeMock } from '../helpers/stripe-mock.js';
vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));
const tasks = vi.hoisted(() => []);
vi.mock('@vercel/functions', () => ({ waitUntil: promise => tasks.push(promise) }));
import { makeReq, makeRes, setCookies } from '../helpers/http.js';
import { hashPassword, verifyPassword } from '../../api/lib/password-auth.js';
import { createPasswordResetToken, readPasswordResetToken, RESET_TTL_MS, passwordResetUrl } from '../../api/lib/password-reset.js';
import { createAccessToken, readCurrentAccessCookie, COOKIE_NAME } from '../../api/lib/access.js';
import forgot from '../../api/auth/forgot-password.js';
import reset from '../../api/auth/reset-password.js';

let customer;
let mail;
beforeEach(() => {
  resetStripeMock(); tasks.length = 0;
  vi.stubEnv('RESEND_API_KEY', 're_test_not_real');
  vi.stubEnv('AUTH_EMAIL_FROM', 'Viral <acesso@teste.exemplo>');
  const old = hashPassword('SenhaAnterior123!');
  customer = { id: 'cus_reset', email: 'pessoa@teste.exemplo', metadata: { vc_pw_salt: old.salt, vc_pw_hash: old.hash, vc_img_periodo: '7' } };
  stripeMock.customers.list.mockImplementation(async ({ email }) => ({ data: email === customer.email ? [customer] : [] }));
  stripeMock.customers.retrieve.mockImplementation(async () => structuredClone(customer));
  const operations = new Set();
  stripeMock.customers.update.mockImplementation(async (_, data, { idempotencyKey }) => {
    if (operations.has(idempotencyKey)) throw Object.assign(new Error('concurrent'), { type: 'StripeIdempotencyError' });
    operations.add(idempotencyKey);
    customer.metadata = { ...customer.metadata, ...data.metadata };
    return structuredClone(customer);
  });
  mail = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', mail);
});
afterEach(async () => { await Promise.all(tasks); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); vi.restoreAllMocks(); });
const record = () => ({ customerId: customer.id, email: customer.email, salt: customer.metadata.vc_pw_salt, hash: customer.metadata.vc_pw_hash });
async function request(handler, body, overrides = {}) {
  const res = makeRes();
  await handler(makeReq({ method: 'POST', body, ...overrides }), res);
  return res;
}
const change = token => request(reset, { token, password: 'SenhaNova123!', confirmPassword: 'SenhaNova123!' });

describe('recuperação por e-mail', () => {
  it('envia link de 30 minutos no domínio configurado sem expor token na resposta', async () => {
    const response = await request(forgot, { email: ' PESSOA@TESTE.EXEMPLO ' }, { headers: { host: 'evil.invalid', 'x-forwarded-host': 'evil.invalid' } });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(expect.objectContaining({ ok: true }));
    await Promise.all(tasks);
    const [url, options] = mail.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    const sent = JSON.parse(options.body);
    expect(sent.to).toEqual([customer.email]);
    const link = sent.text.match(/https:\/\/\S+/)[0];
    expect(link).toMatch(/^https:\/\/viralcarrossel.com.br\/redefinir-senha#token=/);
    const token = new URLSearchParams(new URL(link).hash.slice(1)).get('token');
    const parsed = readPasswordResetToken(token);
    expect(parsed.exp - Date.now()).toBeGreaterThan(RESET_TTL_MS - 1000);
    expect(JSON.stringify(response.body)).not.toContain(token);
    expect(stripeMock.customers.update).not.toHaveBeenCalled();
  });

  it('conta inexistente recebe a mesma resposta e não cria conta nem e-mail', async () => {
    const unknown = await request(forgot, { email: 'ninguem@teste.exemplo' });
    await Promise.all(tasks); expect(mail).not.toHaveBeenCalled();
    const known = await request(forgot, { email: customer.email });
    expect(unknown.body).toEqual(known.body);
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
  });

  it('não depende do tempo de resposta do provedor e contém falhas sem expor segredos', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mail.mockRejectedValue(new Error('re_secret https://token-privado'));
    expect((await request(forgot, { email: customer.email })).statusCode).toBe(200);
    await Promise.all(tasks);
    expect(log).toHaveBeenCalledWith('[auth/forgot-password] delivery_failed', { code: 'service_error' });
  });

  it('limita repetição por IP e usa a mesma chave de envio por conta/janela entre instâncias', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-29T00:00:00Z'));
    for (let i = 0; i < 5; i++) expect((await request(forgot, { email: customer.email })).statusCode).toBe(200);
    const limited = await request(forgot, { email: customer.email });
    expect(limited.statusCode).toBe(429); expect(limited.headers['retry-after']).toBeTruthy();
    await Promise.all(tasks);
    expect(new Set(mail.mock.calls.map(([, opts]) => opts.headers['Idempotency-Key'])).size).toBe(1);
  });

  it('erro de configuração é visível para qualquer e-mail; valida formato e método', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    expect((await request(forgot, { email: customer.email })).statusCode).toBe(503);
    expect((await request(forgot, { email: 'x@teste.exemplo' })).statusCode).toBe(503);
    expect((await request(forgot, { email: 'inválido' })).statusCode).toBe(400);
    expect((await request(forgot, {}, { method: 'GET' })).statusCode).toBe(405);
    expect(mail).not.toHaveBeenCalled();
  });
});

describe('redefinição da senha', () => {
  it('altera só a senha da conta do link, preserva quota e invalida todos os links anteriores', async () => {
    const token = createPasswordResetToken(record());
    const second = createPasswordResetToken(record());
    const result = await change(token);
    expect(result.statusCode).toBe(200);
    expect(customer.metadata.vc_img_periodo).toBe('7');
    expect(verifyPassword('SenhaNova123!', { salt: customer.metadata.vc_pw_salt, hash: customer.metadata.vc_pw_hash })).toBe(true);
    expect(verifyPassword('SenhaAnterior123!', { salt: customer.metadata.vc_pw_salt, hash: customer.metadata.vc_pw_hash })).toBe(false);
    expect((await change(token)).body.code).toBe('invalid_reset_link');
    expect((await change(second)).body.code).toBe('invalid_reset_link');
    expect(setCookies(result).join()).toContain('Max-Age=0');
    await Promise.all(tasks);
    expect(JSON.parse(mail.mock.calls[0][1].body).text).not.toContain('SenhaNova');
  });

  it('tokens adulterados, expirados, de sessão e vazios não alteram senha', async () => {
    const token = createPasswordResetToken(record());
    const expired = createPasswordResetToken(record(), Date.now() - RESET_TTL_MS);
    for (const value of [token + 'x', expired, '', createAccessToken({ customerId: customer.id, email: customer.email }), null]) {
      expect((await change(value)).body.code).toBe('invalid_reset_link');
    }
    expect(stripeMock.customers.update).not.toHaveBeenCalled();
  });

  it('duas submissões simultâneas não podem consumir a mesma versão da senha duas vezes', async () => {
    const token = createPasswordResetToken(record());
    const another = createPasswordResetToken(record());
    const results = await Promise.all([change(token), change(another)]);
    expect(results.map(r => r.statusCode).sort()).toEqual([200, 400]);
    const keys = stripeMock.customers.update.mock.calls.map(call => call[2].idempotencyKey);
    expect(new Set(keys).size).toBe(1);
  });

  it('senha curta, longa, não textual ou confirmação diferente são rejeitadas antes da alteração', async () => {
    const token = createPasswordResetToken(record());
    for (const password of ['curta', 'x'.repeat(129), 12345678]) {
      expect((await request(reset, { token, password, confirmPassword: password })).statusCode).toBe(400);
    }
    expect((await request(reset, { token, password: 'SenhaNova123!', confirmPassword: 'OutraSenha123!' })).statusCode).toBe(400);
    expect(stripeMock.customers.update).not.toHaveBeenCalled();
  });

  it('revoga cookies anteriores, incluindo legados, e permite login novo', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-29T00:00:00Z'));
    const cookie = `${COOKIE_NAME}=${createAccessToken({ customerId: customer.id, email: customer.email })}`;
    const legacyBody = Buffer.from(JSON.stringify({ customerId: customer.id, email: customer.email, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
    const legacySignature = crypto.createHmac('sha256', process.env.ACCESS_COOKIE_SECRET).update(legacyBody).digest('base64url');
    const legacyCookie = `${COOKIE_NAME}=${legacyBody}.${legacySignature}`;
    expect(await readCurrentAccessCookie(makeReq({ cookie }))).toBeTruthy();
    expect(await readCurrentAccessCookie(makeReq({ cookie: legacyCookie }))).toBeTruthy();
    vi.setSystemTime(Date.now() + 1000);
    await change(createPasswordResetToken(record()));
    expect(await readCurrentAccessCookie(makeReq({ cookie }))).toBeNull();
    expect(await readCurrentAccessCookie(makeReq({ cookie: legacyCookie }))).toBeNull();
    vi.setSystemTime(Date.now() + 1000);
    const newCookie = `${COOKIE_NAME}=${createAccessToken({ customerId: customer.id, email: customer.email })}`;
    expect(await readCurrentAccessCookie(makeReq({ cookie: newCookie }))).toBeTruthy();
  });

  it('troca de e-mail ou senha fora do fluxo invalida o link; falha Stripe não vaza detalhes', async () => {
    const token = createPasswordResetToken(record());
    customer.email = 'outra@teste.exemplo';
    expect((await change(token)).body.code).toBe('invalid_reset_link');
    const current = createPasswordResetToken(record());
    stripeMock.customers.update.mockRejectedValueOnce(new Error('sk_live_private'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await change(current);
    expect(result.statusCode).toBe(503); expect(JSON.stringify(result)).not.toContain('sk_live');
  });

  it('não aceita origem insegura para links', () => {
    vi.stubEnv('APP_URL', 'http://evil.invalid');
    expect(() => passwordResetUrl('fake')).toThrow('reset_origin_invalid');
  });
});
