// MOO-11 (auditoria 20/11): o texto incluso no plano não tinha cota por conta;
// várias origens multiplicavam o custo da chave da plataforma.
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createTextQuota, textDailyLimit } from '../../api/lib/text-quota.js';

vi.setConfig({ testTimeout: 30_000 });
let db; let quota;
beforeAll(async () => {
  db = new PGlite();
  const dir = new URL('../../db/migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(f, dir), 'utf8'));
  quota = createTextQuota({ sql: { unsafe: (s, p = []) => db.query(s, p).then((r) => r.rows) } });
}, 60_000);
afterAll(async () => { await db?.close(); });

describe('MOO-11 — cota diária de texto por conta', () => {
  const now = Date.parse('2026-11-21T15:00:00-03:00');
  it('aceita até o limite e recusa o pedido seguinte', async () => {
    const results = [];
    for (let i = 0; i < 4; i += 1) results.push(await quota.consume({ customerId: 'cus_texto', limit: 3, now }));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3]).toMatchObject({ used: 3, limit: 3 });
  });

  it('outra conta tem a própria cota', async () => {
    expect((await quota.consume({ customerId: 'cus_outra', limit: 3, now })).allowed).toBe(true);
  });

  it('no dia seguinte (Brasília) a cota volta', async () => {
    const amanha = Date.parse('2026-11-22T00:30:00-03:00');
    expect((await quota.consume({ customerId: 'cus_texto', limit: 3, now: amanha })).allowed).toBe(true);
  });
});

// Auditoria Ingrid 23/11 (D-3): 800 pedidos por dia valiam para qualquer plano.
describe('teto diário de texto por plano', () => {
  it('padrão 150/400/800/800 e plano desconhecido cai no menor', () => {
    expect(['essential', 'creator', 'pro', 'max', undefined, 'free'].map((t) => textDailyLimit(t, {})))
      .toEqual([150, 400, 800, 800, 150, 150]);
  });

  it('variável por plano ajusta só aquele plano', () => {
    const env = { TEXT_DAILY_LIMIT_ESSENTIAL: '200', TEXT_DAILY_LIMIT_MAX: 'abc' };
    expect(textDailyLimit('essential', env)).toBe(200);
    expect(textDailyLimit('max', env)).toBe(800);
  });

  it('conta Essencial é recusada no pedido 151', async () => {
    const now = Date.parse('2026-11-23T10:00:00-03:00');
    const limit = textDailyLimit('essential', {});
    let last;
    for (let i = 0; i < 151; i += 1) last = await quota.consume({ customerId: 'cus_essencial', limit, now });
    expect(last).toMatchObject({ allowed: false, limit: 150 });
  });
});
