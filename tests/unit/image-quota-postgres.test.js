import { describe, expect, it, vi } from 'vitest';
import { createImageQuotaPostgres } from '../../api/lib/image-quota-postgres.js';

function fakeDatabase() {
  const periods = new Map();
  const operations = new Map();
  let clock = Date.parse('2026-10-13T12:00:00.000Z');
  let mutex = Promise.resolve();
  const copy = (item) => structuredClone(item);
  const periodKey = (owner, start) => `${owner}\0${start}`;
  const opKey = (owner, start, id) => `${owner}\0${start}\0${id}`;

  function client(currentPeriods, currentOperations) {
    return {
      async unsafe(query, params) {
        const operation = /\/\* (moont_image_quota_\w+) \*\//.exec(query)?.[1];
        if (operation === 'moont_image_quota_stale_reservations') {
          // $1 = minutos, $2 = limite. Espelha o filtro SQL: só `reserved`,
          // mais velha que o corte e fora do namespace `mcp_` do agente.
          const cutoff = clock - Number(params[0]) * 60_000;
          return [...currentOperations.values()]
            .filter((row) => row.status === 'reserved'
              && Date.parse(row.created_at) < cutoff
              && row.operation_id.slice(0, 4).toLowerCase() !== 'mcp_')
            .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)))
            .slice(0, Number(params[1]))
            .map(copy);
        }
        const [owner, start, id] = params;
        const key = periodKey(owner, start);
        if (operation === 'moont_image_quota_period' || operation === 'moont_image_quota_locked_period') {
          const row = currentPeriods.get(key);
          return row ? [copy(row)] : [];
        }
        if (operation === 'moont_image_quota_insert_period') {
          if (!currentPeriods.has(key)) {
            currentPeriods.set(key, {
              owner_id: owner, period_start_sec: start, period_end_sec: id,
              used: params[3], legacy_used: params[3],
            });
          }
          return [];
        }
        if (operation === 'moont_image_quota_operation') {
          const row = currentOperations.get(opKey(owner, start, id));
          return row ? [copy(row)] : [];
        }
        if (operation === 'moont_image_quota_activity') {
          return [...currentOperations.values()]
            .filter((row) => row.owner_id === owner && row.period_start_sec === start)
            .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
            .slice(0, Number(id))
            .map(copy);
        }
        if (operation === 'moont_image_quota_insert_operation') {
          const keyForOperation = opKey(owner, start, id);
          if (currentOperations.has(keyForOperation)) throw new Error('unique violation');
          const now = new Date(clock += 1_000).toISOString();
          currentOperations.set(keyForOperation, {
            owner_id: owner,
            period_start_sec: start,
            operation_id: id,
            status: 'reserved',
            metadata: JSON.parse(params[3] || '{}'),
            created_at: now,
            updated_at: now,
          });
          return [];
        }
        if (operation === 'moont_image_quota_update_operation') {
          const current = currentOperations.get(opKey(owner, start, id));
          currentOperations.set(opKey(owner, start, id), {
            ...current,
            status: params[3],
            metadata: { ...(current?.metadata || {}), ...JSON.parse(params[4] || '{}') },
            updated_at: new Date(clock += 1_000).toISOString(),
          });
          return [];
        }
        if (operation === 'moont_image_quota_merge_operation_metadata') {
          const current = currentOperations.get(opKey(owner, start, id));
          currentOperations.set(opKey(owner, start, id), {
            ...current,
            metadata: { ...(current?.metadata || {}), ...JSON.parse(params[3] || '{}') },
            updated_at: new Date(clock += 1_000).toISOString(),
          });
          return [];
        }
        if (operation === 'moont_image_quota_change_used') {
          const current = currentPeriods.get(key);
          const updated = { ...current, used: current.used + id };
          if (updated.used < updated.legacy_used) throw new Error('check violation');
          currentPeriods.set(key, updated);
          return [{ used: updated.used }];
        }
        throw new Error(`Query desconhecida: ${operation}`);
      },
      async begin(action) {
        let release;
        const next = new Promise((resolve) => { release = resolve; });
        const previous = mutex;
        mutex = next;
        await previous;
        try {
          const nextPeriods = new Map([...periods].map(([key, value]) => [key, copy(value)]));
          const nextOperations = new Map([...operations].map(([key, value]) => [key, copy(value)]));
          const result = await action(client(nextPeriods, nextOperations));
          periods.clear();
          operations.clear();
          for (const [key, value] of nextPeriods) periods.set(key, value);
          for (const [key, value] of nextOperations) operations.set(key, value);
          return result;
        } finally { release(); }
      },
    };
  }

  return {
    sql: client(periods, operations),
    snapshot() { return { periods: copy([...periods]), operations: copy([...operations]) }; },
    advance(ms) { clock += ms; },
    operation(owner, start, id) { return copy(operations.get(opKey(owner, start, id))); },
  };
}

function quota(db, readLegacyUsage = vi.fn(async () => ({ used: 0 }))) {
  return createImageQuotaPostgres({ sql: db.sql, readLegacyUsage });
}

const args = {
  customerId: 'cus_janine', periodStartSec: 1_760_000_000,
  periodEndSec: 1_762_592_000, limit: 50,
};

describe('quota transacional de imagens', () => {
  it('migra a contagem antiga uma vez, sem reiniciar créditos do ciclo', async () => {
    const db = fakeDatabase();
    const legacy = vi.fn(async () => ({ used: 48 }));
    const adapter = quota(db, legacy);
    expect(await adapter.getQuotaUsage(args)).toMatchObject({ used: 48, remaining: 2 });
    expect((await adapter.consumeImageCredit({ ...args, operationId: 'img-1' })).used).toBe(49);
    expect((await adapter.consumeImageCredit({ ...args, operationId: 'img-2' })).used).toBe(50);
    expect(await adapter.consumeImageCredit({ ...args, operationId: 'img-3' }))
      .toMatchObject({ allowed: false, reason: 'exhausted', used: 50 });
    expect(legacy).toHaveBeenCalledTimes(1);
    expect(db.snapshot().periods[0][1].legacy_used).toBe(48);
  });

  it('serializa gerações simultâneas e uma repetição da mesma operação', async () => {
    const db = fakeDatabase();
    const adapter = quota(db);
    const calls = await Promise.all(Array.from({ length: 12 }, (_, i) => adapter.consumeImageCredit({
      ...args, limit: 3, operationId: `img-${i}`,
    })));
    expect(calls.filter((item) => item.allowed)).toHaveLength(3);
    expect(calls.filter((item) => item.reason === 'exhausted')).toHaveLength(9);
    expect((await adapter.getQuotaUsage({ ...args, limit: 3 })).used).toBe(3);

    const replay = await adapter.consumeImageCredit({ ...args, limit: 3, operationId: 'img-0' });
    expect(replay).toMatchObject({ allowed: false, replayed: true, reason: 'already_reserved', used: 3 });
    expect(db.snapshot().operations).toHaveLength(3);
  });

  it('confirma uma imagem e reembolsa falhas uma única vez, sem tocar na parcela legada', async () => {
    const db = fakeDatabase();
    const adapter = quota(db, async () => ({ used: 7 }));
    const first = await adapter.consumeImageCredit({ ...args, operationId: 'success' });
    expect(first).toMatchObject({ allowed: true, used: 8, status: 'reserved' });
    expect(await adapter.settleImageCredit({ ...args, operationId: 'success' }))
      .toEqual({ used: 8, status: 'consumed' });
    expect(await adapter.settleImageCredit({ ...args, operationId: 'success' }))
      .toEqual({ used: 8, status: 'consumed' });

    await adapter.consumeImageCredit({ ...args, operationId: 'failure' });
    expect(await adapter.refundImageCredit({ ...args, operationId: 'failure' }))
      .toEqual({ used: 8, refunded: true });
    expect(await adapter.refundImageCredit({ ...args, operationId: 'failure' }))
      .toEqual({ used: 8, refunded: false });
    expect(await adapter.consumeImageCredit({ ...args, operationId: 'failure' }))
      .toMatchObject({ allowed: false, replayed: true, reason: 'already_refunded', used: 8 });
    expect((await adapter.getQuotaUsage(args)).used).toBe(8);
    expect(db.snapshot().periods[0][1].legacy_used).toBe(7);
  });

  it('lista a atividade do ciclo com origem, estado e ordem mais recente', async () => {
    const db = fakeDatabase();
    const adapter = quota(db);
    await adapter.consumeImageCredit({
      ...args,
      operationId: 'editor-ready',
      metadata: {
        projectId: 'project-eter', projectName: 'Éter\u0000 Pitch',
        cardId: 'slide-3', cardNumber: 3, ignored: 'não persistir',
      },
    });
    await adapter.settleImageCredit({
      ...args,
      operationId: 'editor-ready',
      metadata: { assetId: 'original_abc', imageId: 'task-123' },
    });
    await adapter.consumeImageCredit({ ...args, operationId: 'mcp_generate-7' });
    await adapter.consumeImageCredit({ ...args, operationId: 'editor-failed' });
    await adapter.refundImageCredit({ ...args, operationId: 'editor-failed' });

    expect(await adapter.getImageQuotaActivity({
      customerId: args.customerId,
      periodStartSec: args.periodStartSec,
      limit: 10,
    })).toEqual([
      expect.objectContaining({ source: 'editor', status: 'refunded', createdAt: expect.any(String), updatedAt: expect.any(String) }),
      expect.objectContaining({ source: 'mcp', status: 'reserved', createdAt: expect.any(String), updatedAt: expect.any(String) }),
      expect.objectContaining({
        source: 'editor', status: 'consumed', createdAt: expect.any(String), updatedAt: expect.any(String),
        projectId: 'project-eter', projectName: 'Éter Pitch', cardId: 'slide-3', cardNumber: 3,
        assetId: 'original_abc', imageId: 'task-123',
      }),
    ]);
    expect(db.snapshot().operations.find(([, row]) => row.operation_id === 'editor-ready')?.[1]?.metadata)
      .not.toHaveProperty('ignored');
  });

  it('trata reembolso de commit ambíguo sem reserva como no-op', async () => {
    const db = fakeDatabase();
    const adapter = quota(db, async () => ({ used:7 }));
    await adapter.getQuotaUsage(args);
    expect(await adapter.refundImageCredit({ ...args, operationId:'missing-operation' }))
      .toEqual({ used:7, refunded:false, reason:'not_found' });
    expect((await adapter.getQuotaUsage(args)).used).toBe(7);
  });

  it('falha fechado quando não consegue consultar o contador antigo', async () => {
    const db = fakeDatabase();
    const adapter = quota(db, async () => { throw new Error('Stripe indisponível'); });
    await expect(adapter.consumeImageCredit({ ...args, operationId: 'img-1' }))
      .rejects.toMatchObject({ code: 'quota_store_unavailable' });
    expect(db.snapshot().periods).toEqual([]);
    expect(db.snapshot().operations).toEqual([]);
  });

  it('não interpreta saldo legado desconhecido como zero disponível', async () => {
    for (const unknown of [null, { used: null }, { used: 0, available: false }]) {
      const db = fakeDatabase();
      const adapter = quota(db, async () => unknown);
      await expect(adapter.getQuotaUsage(args))
        .rejects.toMatchObject({ code: 'quota_store_unavailable' });
      expect(db.snapshot().periods).toEqual([]);
    }
  });

  it('isola contas e períodos e exige um ID para impedir cobrança ambígua', async () => {
    const db = fakeDatabase();
    const adapter = quota(db);
    await expect(adapter.consumeImageCredit(args)).rejects.toMatchObject({ code: 'quota_bad_operation' });
    await adapter.consumeImageCredit({ ...args, limit: 1, operationId: 'same' });
    expect((await adapter.consumeImageCredit({ ...args, customerId: 'cus_outro', limit: 1, operationId: 'same' })).allowed).toBe(true);
    expect((await adapter.consumeImageCredit({ ...args, periodStartSec: args.periodEndSec,
      periodEndSec: args.periodEndSec + 10, limit: 1, operationId: 'same' })).allowed).toBe(true);
    expect(db.snapshot().periods).toHaveLength(3);
  });
});

// MOO-28: a reserva do editor só era devolvida no catch do mesmo processo.
// Se a função da Vercel morre entre a reserva e o settle/refund, o crédito
// fica contado para sempre. O cron passa a liquidar essas reservas antigas.
describe('reconciliação de reservas do editor abandonadas', () => {
  const owner = args.customerId;
  const start = args.periodStartSec;

  it('devolve reserva do editor sem imagem guardada depois de 15 minutos', async () => {
    const db = fakeDatabase();
    const adapter = quota(db);
    await adapter.consumeImageCredit({ ...args, operationId: 'editor-op-morta' });
    expect((await adapter.getQuotaUsage(args)).used).toBe(1);
    db.advance(16 * 60_000);
    const result = await adapter.reconcileStaleEditorReservations({ limit: 100 });
    expect(result).toMatchObject({ scanned: 1, refunded: 1, consumed: 0, failed: 0 });
    expect((await adapter.getQuotaUsage(args)).used).toBe(0);
    expect(db.operation(owner, start, 'editor-op-morta').status).toBe('refunded');
  });

  it('confirma em vez de devolver quando a imagem já foi guardada para a repetição (MOO-10)', async () => {
    const db = fakeDatabase();
    const adapter = quota(db);
    await adapter.consumeImageCredit({ ...args, operationId: 'editor-entregue' });
    await adapter.rememberImageResult({ ...args, operationId: 'editor-entregue', url: 'https://cdn.example/img.png' });
    db.advance(16 * 60_000);
    const result = await adapter.reconcileStaleEditorReservations({ limit: 100 });
    expect(result).toMatchObject({ scanned: 1, refunded: 0, consumed: 1 });
    expect((await adapter.getQuotaUsage(args)).used).toBe(1);
    expect(db.operation(owner, start, 'editor-entregue').status).toBe('consumed');
    // A repetição com o mesmo operationId continua recebendo a mesma imagem.
    expect(await adapter.recallImageResult({ ...args, operationId: 'editor-entregue' }))
      .toBe('https://cdn.example/img.png');
  });

  it('não toca em reserva recente, em operação já liquidada nem em operação do agente (mcp_)', async () => {
    const db = fakeDatabase();
    const adapter = quota(db);
    await adapter.consumeImageCredit({ ...args, operationId: 'mcp_job-1' });
    await adapter.consumeImageCredit({ ...args, operationId: 'editor-ok' });
    await adapter.settleImageCredit({ ...args, operationId: 'editor-ok' });
    await adapter.consumeImageCredit({ ...args, operationId: 'editor-falhou' });
    await adapter.refundImageCredit({ ...args, operationId: 'editor-falhou' });
    db.advance(16 * 60_000);
    await adapter.consumeImageCredit({ ...args, operationId: 'editor-em-andamento' });
    const result = await adapter.reconcileStaleEditorReservations({ limit: 100 });
    expect(result).toMatchObject({ scanned: 0, refunded: 0, consumed: 0, failed: 0 });
    expect(db.operation(owner, start, 'mcp_job-1').status).toBe('reserved');
    expect(db.operation(owner, start, 'editor-em-andamento').status).toBe('reserved');
    expect((await adapter.getQuotaUsage(args)).used).toBe(3);
  });

  it('é idempotente: rodar duas vezes não devolve o mesmo crédito duas vezes', async () => {
    const db = fakeDatabase();
    const adapter = quota(db);
    await adapter.consumeImageCredit({ ...args, operationId: 'editor-a' });
    await adapter.consumeImageCredit({ ...args, operationId: 'editor-b' });
    db.advance(16 * 60_000);
    const [first, second] = await Promise.all([
      adapter.reconcileStaleEditorReservations({ limit: 100 }),
      adapter.reconcileStaleEditorReservations({ limit: 100 }),
    ]);
    expect(first.refunded + second.refunded).toBe(2);
    expect((await adapter.getQuotaUsage(args)).used).toBe(0);
  });
});
