import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStripeMock, stripeMock } from '../helpers/stripe-mock.js';
vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));
vi.mock('../../api/lib/image-quota.js', () => ({
  getQuotaUsage: vi.fn(),
  getImageQuotaActivity: vi.fn(),
}));
import { getImageQuotaActivity, getQuotaUsage } from '../../api/lib/image-quota.js';
import { createAccessToken, COOKIE_NAME } from '../../api/lib/access.js';
import sessionHandler from '../../api/auth/session.js';
import { imageAuditAccounts, imageAuditEnabledFor } from '../../api/lib/image-audit-flag.js';
import { accessStateFromSession } from '../../src/hooks/useAccess.js';
import { makeReq, makeRes } from '../helpers/http.js';

// Spec 1.1, entrega 5: a auditoria de imagem fica atrás de uma lista de contas
// em variável de ambiente (mesmo padrão de MOONT_ADMIN_ACCOUNTS), desligada por
// padrão, sem migração. A sessão expõe só um booleano.
const start = 1791846000;
const end = 1794524400;
const subscription = { id: 'sub_audit', status: 'active', metadata: { product: 'viral-carrossel', tier: 'creator' },
  items: { data: [{ current_period_start: start, current_period_end: end }] } };

async function session(customerId = 'cus_piloto') {
  stripeMock.subscriptions.list.mockResolvedValue({ data: [subscription] });
  const cookie = `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId, email: 'piloto@teste.exemplo' }))}`;
  const res = makeRes();
  await sessionHandler(makeReq({ cookie }), res);
  return res;
}

beforeEach(() => {
  resetStripeMock();
  getQuotaUsage.mockReset().mockResolvedValue({ used: 1, limit: 50, remaining: 49, allowed: true });
  getImageQuotaActivity.mockReset().mockResolvedValue([]);
});
afterEach(() => { delete process.env.MOONT_IMAGE_AUDIT_ACCOUNTS; });

describe('spec 1.1 entrega 5 — flag da auditoria de imagem por conta', () => {
  it('lê a lista como MOONT_ADMIN_ACCOUNTS: vírgula, espaço ou ponto e vírgula, ids válidos', () => {
    const env = { MOONT_IMAGE_AUDIT_ACCOUNTS: ' cus_a, cus_b;cus_c  bad id!' };
    expect([...imageAuditAccounts(env)]).toEqual(['cus_a', 'cus_b', 'cus_c', 'bad']);
    expect(imageAuditEnabledFor('cus_b', env)).toBe(true);
    expect(imageAuditEnabledFor('cus_x', env)).toBe(false);
    expect(imageAuditEnabledFor('', env)).toBe(false);
    expect(imageAuditEnabledFor('cus_a', {})).toBe(false);
  });

  it('desligada por padrão: sem a variável a sessão manda imageAudit false', async () => {
    const res = await session();
    expect(res.statusCode).toBe(200);
    expect(res.body.active).toBe(true);
    expect(res.body.imageAudit).toBe(false);
  });

  it('conta da lista recebe imageAudit true; outra conta continua false', async () => {
    process.env.MOONT_IMAGE_AUDIT_ACCOUNTS = 'cus_outra,cus_piloto';
    expect((await session('cus_piloto')).body.imageAudit).toBe(true);
    expect((await session('cus_fora')).body.imageAudit).toBe(false);
  });

  it('o app só liga com true literal vindo da sessão de conta ativa', () => {
    expect(accessStateFromSession({ active: true, imageAudit: true }).imageAudit).toBe(true);
    expect(accessStateFromSession({ active: true, imageAudit: 'true' }).imageAudit).toBe(false);
    expect(accessStateFromSession({ active: true }).imageAudit).toBe(false);
    expect(accessStateFromSession({ active: false, imageAudit: true }).imageAudit).toBe(false);
  });

  it('.env.example documenta a variável sem valor', () => {
    const example = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8');
    expect(example).toMatch(/^# MOONT_IMAGE_AUDIT_ACCOUNTS=$/m);
  });
});
