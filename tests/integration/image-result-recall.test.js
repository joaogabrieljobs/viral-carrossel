// MOO-10 (auditoria 20/11), caminho Postgres: o endereço da imagem paga fica
// guardado na operação e volta na repetição; operação estornada não devolve.
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createImageQuotaPostgres } from '../../api/lib/image-quota-postgres.js';

vi.setConfig({ testTimeout: 30_000 });
let db; let quota;
const base = { customerId: 'cus_img', periodStartSec: 1_790_000_000 };
beforeAll(async () => {
  db = new PGlite();
  const dir = new URL('../../db/migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(f, dir), 'utf8'));
  const sql = {
    unsafe: (s, p = []) => db.query(s, p).then((r) => r.rows),
    begin: (work) => db.transaction((tx) => work({ unsafe: (s, p = []) => tx.query(s, p).then((r) => r.rows) })),
  };
  quota = createImageQuotaPostgres({ sql, readLegacyUsage: async () => 0 });
}, 60_000);
afterAll(async () => { await db?.close(); });

describe('MOO-10 — resultado da imagem guardado por operação', () => {
  it('operação paga devolve o endereço guardado e a atividade não o expõe', async () => {
    const op = { ...base, operationId: 'op-recall-1', limit: 50, periodEndSec: base.periodStartSec + 2_592_000 };
    expect((await quota.consumeImageCredit(op)).allowed).toBe(true);
    await quota.rememberImageResult({ ...base, operationId: 'op-recall-1', url: 'https://cdn.exemplo/a.png' });
    await quota.settleImageCredit({ ...base, operationId: 'op-recall-1', metadata: { imageId: 't1' } });
    expect(await quota.recallImageResult({ ...base, operationId: 'op-recall-1' })).toBe('https://cdn.exemplo/a.png');
    const [activity] = await quota.getImageQuotaActivity({ ...base });
    expect(activity).not.toHaveProperty('resultUrl');
  });

  it('operação estornada não devolve imagem', async () => {
    const op = { ...base, operationId: 'op-recall-2', limit: 50, periodEndSec: base.periodStartSec + 2_592_000 };
    await quota.consumeImageCredit(op);
    await quota.rememberImageResult({ ...base, operationId: 'op-recall-2', url: 'https://cdn.exemplo/b.png' });
    await quota.refundImageCredit({ ...base, operationId: 'op-recall-2' });
    expect(await quota.recallImageResult({ ...base, operationId: 'op-recall-2' })).toBeNull();
  });

  it('endereço que não é https não é guardado', async () => {
    expect(await quota.rememberImageResult({ ...base, operationId: 'op-recall-1', url: 'http://interno/x.png' })).toBe(false);
  });
});

// MOO-29 (b): a tarefa SJinn criada fica registrada na operação, para
// suporte e auditoria de custo; a atividade da conta não a expõe.
describe('MOO-29 — tarefa SJinn registrada na operação', () => {
  it('guarda o taskId na metadata sem expor na atividade nem mudar o estorno', async () => {
    const op = { ...base, operationId: 'op-task-1', limit: 50, periodEndSec: base.periodStartSec + 2_592_000 };
    await quota.consumeImageCredit(op);
    expect(await quota.rememberImageTask({ ...base, operationId: 'op-task-1', taskId: 'task_abc123' })).toBe(true);
    const [linha] = await db.query(`SELECT status, metadata FROM moont.image_quota_operations WHERE operation_id = 'op-task-1'`).then((r) => r.rows);
    expect(linha).toMatchObject({ status: 'reserved', metadata: { sjinnTaskId: 'task_abc123' } });
    const activity = await quota.getImageQuotaActivity({ ...base });
    expect(activity.find((a) => a.status === 'reserved')).not.toHaveProperty('sjinnTaskId');
    expect(await quota.rememberImageTask({ ...base, operationId: 'op-task-1', taskId: 'x y' })).toBe(false);
  });
});
