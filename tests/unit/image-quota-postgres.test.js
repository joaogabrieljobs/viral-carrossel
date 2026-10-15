import { describe, expect, it, vi } from 'vitest';
import { createImageQuotaPostgres } from '../../api/lib/image-quota-postgres.js';

function fakeDatabase() {
  const periods = new Map();
  const operations = new Map();
  let mutex = Promise.resolve();
  const copy = (item) => structuredClone(item);
  const periodKey = (owner, start) => `${owner}\0${start}`;
  const opKey = (owner, start, id) => `${owner}\0${start}\0${id}`;

  function client(currentPeriods, currentOperations) {
    return {
      async unsafe(query, params) {
        const operation = /\/\* (moont_image_quota_\w+) \*\//.exec(query)?.[1];
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
        if (operation === 'moont_image_quota_insert_operation') {
          const keyForOperation = opKey(owner, start, id);
          if (currentOperations.has(keyForOperation)) throw new Error('unique violation');
          currentOperations.set(keyForOperation, { status: 'reserved' });
          return [];
        }
        if (operation === 'moont_image_quota_update_operation') {
          const current = currentOperations.get(opKey(owner, start, id));
          currentOperations.set(opKey(owner, start, id), { ...current, status: params[3] });
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
