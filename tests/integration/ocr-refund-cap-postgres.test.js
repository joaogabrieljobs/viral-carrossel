// MOO-29 (a) no backend Postgres da cota de OCR: estorno de timeout só até o
// teto diário por conta; erro explícito do provedor continua estornado.
import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const holder = vi.hoisted(() => ({ sql: null }));
vi.mock('../../api/lib/postgres-connection.js', () => ({ getPostgresConnection: () => holder.sql }));

import { consumeOcrCredit, refundOcrCredit } from '../../api/lib/ocr-quota.js';

vi.setConfig({ testTimeout: 30_000 });
let db;
beforeAll(async () => {
  db = new PGlite();
  const dir = new URL('../../db/migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(f, dir), 'utf8'));
  holder.sql = {
    unsafe: (s, p = []) => db.query(s, p).then((r) => r.rows),
    begin: (work) => db.transaction((tx) => work({ unsafe: (s, p = []) => tx.query(s, p).then((r) => r.rows) })),
  };
  process.env.OCR_QUOTA_BACKEND = 'postgres';
}, 60_000);
afterAll(async () => { delete process.env.OCR_QUOTA_BACKEND; await db?.close(); });
afterEach(() => { delete process.env.OCR_REFUND_DAILY_LIMIT; delete process.env.OCR_DAILY_LIMIT; });

describe('MOO-29: teto diário de estornos do OCR (Postgres)', () => {
  const now = Date.parse('2026-11-21T15:00:00-03:00');
  it('timeout estorna até o teto; acima dele a reserva fica como uso', async () => {
    process.env.OCR_REFUND_DAILY_LIMIT = '2';
    for (let i = 0; i < 4; i += 1) {
      const operationId = `timeout-${i}`;
      expect((await consumeOcrCredit({ customerId: 'cus_ocr', now, operationId })).allowed).toBe(true);
      await refundOcrCredit({ customerId: 'cus_ocr', now, operationId, capped: true });
    }
    const [linha] = await holder.sql.unsafe(`SELECT used FROM moont.ocr_daily_quotas WHERE owner_id = 'cus_ocr'`);
    expect(linha.used).toBe(2);
  });

  it('erro explícito do provedor estorna mesmo acima do teto', async () => {
    process.env.OCR_REFUND_DAILY_LIMIT = '0';
    await consumeOcrCredit({ customerId: 'cus_ocr2', now, operationId: 'erro-1' });
    await refundOcrCredit({ customerId: 'cus_ocr2', now, operationId: 'erro-1' });
    const [linha] = await holder.sql.unsafe(`SELECT used FROM moont.ocr_daily_quotas WHERE owner_id = 'cus_ocr2'`);
    expect(linha.used).toBe(0);
  });
});
