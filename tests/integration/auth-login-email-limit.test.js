import { describe, expect, it, vi } from 'vitest';

// MOO-05 (auditoria 20/11): o login por senha só limitava por IP; com vários
// IPs dava para testar senhas sem fim contra o mesmo e-mail, e cada tentativa
// consultava o Stripe.
const records = vi.hoisted(() => vi.fn(async () => []));
vi.mock('../../api/lib/password-auth.js', async (original) => ({
  ...(await original()),
  passwordAuthConfigured: () => true,
  getAuthRecordsMatchingPassword: records,
}));
const { default: login } = await import('../../api/auth/login.js');

function res() {
  const out = { statusCode: 200, headers: {} };
  out.setHeader = (k, v) => { out.headers[k.toLowerCase()] = v; };
  out.getHeader = k => out.headers[k.toLowerCase()];
  out.status = code => { out.statusCode = code; return out; };
  out.json = body => { out.body = body; return out; };
  out.end = () => out;
  return out;
}
const attempt = (ip, email) => {
  const r = res();
  return login({ method: 'POST', url: '/', socket: {}, headers: { 'x-real-ip': ip, 'content-type': 'application/json' },
    body: { email, password: 'senha-errada-123' } }, r).then(() => r);
};

describe('MOO-05 — login por senha tem limite por e-mail', () => {
  it('101ª tentativa no mesmo e-mail, de IPs diferentes, recebe 429 sem consultar senha nem Stripe', async () => {
    records.mockClear();
    const statuses = [];
    for (let i = 1; i <= 101; i += 1) statuses.push((await attempt(`10.0.${Math.floor(i / 200)}.${i}`, 'alvo@example.test')).statusCode);
    expect(statuses.slice(0, 100)).toEqual(Array(100).fill(401));
    expect(statuses[100]).toBe(429);
    expect(records).toHaveBeenCalledTimes(100);
  });

  it('o limite de um e-mail não bloqueia outro e-mail no mesmo IP', async () => {
    expect((await attempt('10.0.1.1', 'outra@example.test')).statusCode).toBe(401);
  });
});

// AUTH-01 (auditoria 23/11): o limite de 10 por e-mail contava tentativa de
// qualquer origem. Quem soubesse o e-mail gastava as 10 no começo de cada
// janela e a dona da conta, com a senha certa, recebia 429.
describe('AUTH-01 — errar a senha de outra pessoa não bloqueia a entrada dela', () => {
  it('10 tentativas erradas de um IP não barram a tentativa da dona da conta vinda de outro IP', async () => {
    records.mockClear();
    for (let i = 0; i < 10; i += 1) expect((await attempt('172.16.0.9', 'vitima@example.test')).statusCode).toBe(401);
    const dona = await attempt('172.16.0.77', 'vitima@example.test');
    expect(dona.statusCode).not.toBe(429);
    // A tentativa dela chegou à conferência de senha.
    expect(records).toHaveBeenCalledTimes(11);
  });

  it('a 11ª tentativa do mesmo IP no mesmo e-mail recebe 429 sem consultar a senha', async () => {
    records.mockClear();
    const statuses = [];
    for (let i = 0; i < 11; i += 1) statuses.push((await attempt('172.16.1.9', 'forca-bruta@example.test')).statusCode);
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(statuses[10]).toBe(429);
    expect(records).toHaveBeenCalledTimes(10);
  });
});
