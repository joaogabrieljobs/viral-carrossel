import { describe, expect, it, vi } from 'vitest';

// MOO-40 / UX-01 (auditoria 20/11): falha interna no login, checkout, portal e
// criação de senha devolvia ao usuário a mensagem crua da exceção (inglês,
// endereço do banco) ou o código "login_error".
const records = vi.hoisted(() => vi.fn());
vi.mock('../../api/lib/password-auth.js', async (original) => ({
  ...(await original()),
  passwordAuthConfigured: () => true,
  getAuthRecordsMatchingPassword: records,
}));
const { default: login } = await import('../../api/auth/login.js');
const { publicErrorBody } = await import('../../api/lib/public-error.js');

function res() {
  const out = { statusCode: 200, headers: {} };
  out.setHeader = (k, v) => { out.headers[k.toLowerCase()] = v; };
  out.getHeader = k => out.headers[k.toLowerCase()];
  out.status = code => { out.statusCode = code; return out; };
  out.json = body => { out.body = body; return out; };
  out.end = () => out;
  return out;
}

describe('MOO-40 — erro interno vira mensagem em português', () => {
  it('login com banco fora do ar não expõe a exceção', async () => {
    records.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.7:5432'));
    const r = res();
    await login({ method: 'POST', url: '/', socket: {}, headers: { 'x-real-ip': '10.9.9.9', 'content-type': 'application/json' },
      body: { email: 'pessoa@example.test', password: 'senha-qualquer-1' } }, r);
    expect(r.statusCode).toBe(500);
    expect(r.body.error).not.toMatch(/ECONNREFUSED|5432|login_error/);
    expect(r.body.error).toMatch(/Não foi possível entrar agora/);
    expect(r.body.code).toBe('login_error');
  });

  it('erro da própria aplicação com código e status 503 mantém a frase em português', () => {
    const appError = Object.assign(new Error('Não foi possível verificar o acesso da conta. Tente novamente.'), { status: 503, code: 'entitlement_store_unavailable' });
    expect(publicErrorBody(appError, 'login_error', 'fallback')).toEqual({ error: appError.message, code: 'entitlement_store_unavailable' });
  });

  it('exceção de biblioteca externa (Stripe, pg) usa a frase padrão', () => {
    const stripe = Object.assign(new Error('No such customer: cus_123'), { type: 'StripeInvalidRequestError' });
    expect(publicErrorBody(stripe, 'portal_error', 'Não foi possível abrir o portal.')).toEqual({ error: 'Não foi possível abrir o portal.', code: 'portal_error' });
  });
});
