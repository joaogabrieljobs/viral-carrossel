import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindAccountDataWriteOwner, SK } from '../../src/utils/storage.js';
import {
  acknowledgeProjectOp, flushProjectOutbox, getPendingProjectOp,
  listPendingProjectOps, queueProjectDelete, queueProjectPut,
} from '../../src/utils/projects-outbox.js';

const ALICE = 'email:alice@example.test';
const BOB = 'email:bob@example.test';

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
  };
}

/** Simula requests e conclusão de transações IndexedDB sem cache em memória no cliente. */
function fakeIndexedDB() {
  const records = new Map();
  let created = false;
  let failWrite = false;
  const db = {
    objectStoreNames: { contains: () => created },
    createObjectStore() { created = true; return { createIndex() {} }; },
    close() {},
    transaction(_store, mode) {
      const staged = new Map(records);
      let pending = 0;
      let aborted = false;
      let completionScheduled = false;
      const tx = {
        error: null,
        abort() {
          if (aborted) return;
          aborted = true;
          queueMicrotask(() => tx.onabort?.());
        },
        objectStore() {
          const request = (run) => {
            const req = { result: undefined, transaction: tx };
            pending += 1;
            queueMicrotask(() => {
              if (!aborted) {
                try { req.result = run(); req.onsuccess?.(); }
                catch (error) { tx.error = error; tx.abort(); }
              }
              pending -= 1;
              scheduleCompletion();
            });
            return req;
          };
          return {
            get(key) { return request(() => structuredClone(staged.get(key))); },
            put(value) { return request(() => {
              if (failWrite) throw new DOMException('Quota full', 'QuotaExceededError');
              staged.set(value.key, structuredClone(value));
              return value.key;
            }); },
            delete(key) { return request(() => staged.delete(key)); },
            index() {
              return { getAll(owner) { return request(() => [...staged.values()]
                .filter((row) => row.owner === owner).map((row) => structuredClone(row))); } };
            },
          };
        },
      };
      function scheduleCompletion() {
        if (aborted || pending || completionScheduled) return;
        completionScheduled = true;
        queueMicrotask(() => {
          completionScheduled = false;
          if (aborted || pending) return;
          if (mode === 'readwrite') {
            records.clear();
            for (const [key, value] of staged) records.set(key, value);
          }
          tx.oncomplete?.();
        });
      }
      return tx;
    },
  };
  return {
    open: () => {
      const request = { result: db };
      queueMicrotask(() => {
        if (!created) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
    setFailWrite: (value) => { failWrite = value; },
    records,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status });
}

function setOwner(owner) {
  localStorage.setItem(SK.dataOwner, JSON.stringify(owner));
  bindAccountDataWriteOwner(owner, { switchedHere: true });
}

function session(owner = ALICE) {
  const email = owner === ALICE ? 'alice@example.test' : 'bob@example.test';
  return json({ active: true, customerId: owner === ALICE ? 'cus_alice' : 'cus_bob', email });
}

let idb;
beforeEach(() => {
  vi.stubGlobal('localStorage', storage());
  vi.stubGlobal('sessionStorage', storage());
  idb = fakeIndexedDB();
  vi.stubGlobal('indexedDB', idb);
  vi.stubGlobal('fetch', vi.fn());
  setOwner(ALICE);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('outbox durável por projeto', () => {
  it('guarda a edição no IndexedDB mesmo com localStorage cheio e só confirma após a transação', async () => {
    localStorage.setItem = () => { throw new DOMException('Quota full', 'QuotaExceededError'); };
    const op = await queueProjectPut(ALICE, { id: 'janine', doc: { title: 'Novo' } });
    expect(op).toMatchObject({ projectId: 'janine', kind: 'put', baseVersion: 0 });
    expect(op.opId).toBeTruthy();
    expect(await listPendingProjectOps(ALICE)).toEqual([op]);
    idb.setFailWrite(true);
    await expect(queueProjectPut(ALICE, { id: 'outro' })).rejects.toBeTruthy();
    expect(await listPendingProjectOps(ALICE)).toEqual([op]);
  });

  it('mantém a última edição e atualiza sua versão quando um envio anterior termina', async () => {
    const original = await queueProjectPut(ALICE, { id: 'janine', doc: { title: 'Primeiro' } });
    const next = await queueProjectPut(ALICE, { id: 'janine', doc: { title: 'Segundo' } }, { baseVersion: 9 });
    expect(next.opId).not.toBe(original.opId);
    expect(next.baseVersion).toBe(0);
    expect(await acknowledgeProjectOp(ALICE, original, 1)).toBe(false);
    expect(await getPendingProjectOp(ALICE, 'janine')).toMatchObject({
      opId: next.opId, baseVersion: 1, entry: { doc: { title: 'Segundo' } },
    });
    expect(await acknowledgeProjectOp(ALICE, next, 2)).toBe(true);
    expect(await listPendingProjectOps(ALICE)).toEqual([]);
  });

  it('não transmite dados de outra conta, mesmo quando o cookie mudou antes do flush', async () => {
    await queueProjectPut(ALICE, { id: 'janine', doc: { title: 'Privado' } });
    setOwner(BOB);
    expect(await listPendingProjectOps(BOB)).toEqual([]);
    await expect(flushProjectOutbox(ALICE)).rejects.toMatchObject({ code: 'project_owner_changed' });
    expect(fetch).not.toHaveBeenCalled();

    setOwner(ALICE);
    fetch.mockResolvedValueOnce(session(BOB));
    await expect(flushProjectOutbox(ALICE)).rejects.toMatchObject({ code: 'project_owner_changed' });
    expect(fetch).toHaveBeenCalledTimes(1); // só sessão, nenhum PUT
    expect(await listPendingProjectOps(ALICE)).toHaveLength(1);
  });

  it('preserva operação após perda de resposta e reconhece reenvio já aplicado', async () => {
    const entry = { id: 'janine', doc: { title: 'Versão 23 cards' } };
    const op = await queueProjectPut(ALICE, entry);
    fetch.mockResolvedValueOnce(session()).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(flushProjectOutbox(ALICE)).rejects.toMatchObject({ code: 'project_network_error' });
    expect(await getPendingProjectOp(ALICE, 'janine')).toMatchObject({ opId: op.opId });

    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ error: 'Conflito', code: 'project_conflict', cloudVersion: 1 }, 409))
      .mockResolvedValueOnce(json({ ok: true, project: {
        id: 'janine', entry: { ...entry, updatedAt: Date.now() }, version: 1,
      } }));
    expect(await flushProjectOutbox(ALICE)).toEqual({ sent: 1, pending: 0 });
    expect(fetch.mock.calls[3][1].headers['X-Project-Owner']).toBe('cus_alice');
  });

  it('não descarta uma edição feita enquanto a versão anterior está em trânsito', async () => {
    await queueProjectPut(ALICE, { id: 'janine', doc: { title: 'Antes' } });
    let finishFirst;
    fetch.mockResolvedValueOnce(session()).mockImplementationOnce(() => new Promise((resolve) => {
      finishFirst = resolve;
    }));
    const inFlight = flushProjectOutbox(ALICE);
    await vi.waitFor(() => expect(finishFirst).toBeTypeOf('function'));
    await queueProjectPut(ALICE, { id: 'janine', doc: { title: 'Depois' } });
    finishFirst(json({ ok: true, project: { id: 'janine', version: 1 } }));
    expect(await inFlight).toEqual({ sent: 1, pending: 1 });
    expect(await getPendingProjectOp(ALICE, 'janine')).toMatchObject({
      entry: { doc: { title: 'Depois' } }, baseVersion: 1,
    });
    fetch.mockResolvedValueOnce(session()).mockResolvedValueOnce(json({
      ok: true, project: { id: 'janine', version: 2 },
    }));
    expect(await flushProjectOutbox(ALICE)).toEqual({ sent: 1, pending: 0 });
    expect(JSON.parse(fetch.mock.calls.at(-1)[1].body).baseVersion).toBe(1);
  });

  it('cria cópia estável do PUT divergente sem substituir o original', async () => {
    const op = await queueProjectPut(ALICE, { id: 'janine', name: 'Clínica', doc: { title: 'Local' } }, { baseVersion: 2 });
    const copyId = `conflict-${op.opId.replace(/[^A-Za-z0-9]/g, '')}`;
    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ error: 'Conflito', code: 'project_conflict', cloudVersion: 3 }, 409))
      .mockResolvedValueOnce(json({ ok: true, project: {
        id: 'janine', entry: { id: 'janine', doc: { title: 'Outra aba' } }, version: 3,
      } }))
      .mockResolvedValueOnce(json({ ok: true, project: { id: copyId, version: 1 } }));
    expect(await flushProjectOutbox(ALICE)).toEqual({ sent: 1, pending: 0, recoveries: [{
      sourceProjectId: 'janine', copyProjectId: copyId,
      copyName: 'Clínica (cópia de conflito)',
    }] });
    const copyRequest = JSON.parse(fetch.mock.calls.at(-1)[1].body);
    expect(copyRequest).toMatchObject({ baseVersion: 0, entry: {
      id: copyId, conflictSourceId: 'janine', doc: { title: 'Local' },
    } });
    expect(await listPendingProjectOps(ALICE)).toHaveLength(0);
  });

  it('assinatura vencida vai para revisão e não trava o restante da fila', async () => {
    await queueProjectPut(ALICE, { id: 'bloqueado', doc: { title: 'A' } });
    await queueProjectPut(ALICE, { id: 'livre', doc: { title: 'B' } });
    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ error: 'Assinatura necessária' }, 402))
      .mockResolvedValueOnce(json({ ok: true, project: {
        id: 'livre', entry: { id: 'livre', doc: { title: 'B' } }, version: 1,
      } }));
    const receipt = await flushProjectOutbox(ALICE);
    expect(receipt.sent).toBe(1);
    expect(receipt.needsReview).toEqual([{
      kind: 'put_billing', projectId: 'bloqueado', projectName: '',
    }]);
    expect(await getPendingProjectOp(ALICE, 'livre')).toBeNull();
    expect(await getPendingProjectOp(ALICE, 'bloqueado')).toMatchObject({ kind: 'review_put_billing' });

    fetch.mockResolvedValueOnce(session()).mockResolvedValueOnce(json({
      ok: true, project: { id: 'bloqueado', version: 1 },
    }));
    expect(await flushProjectOutbox(ALICE)).toEqual({ sent: 1, pending: 0 });
    expect(await getPendingProjectOp(ALICE, 'bloqueado')).toBeNull();
  });

  it('não recria projeto tombstonado: preserva a edição local para revisão e libera o boot', async () => {
    const entry = { id: 'janine', name: 'Clínica', doc: { title: 'Edição do celular' } };
    await queueProjectPut(ALICE, entry, { baseVersion: 2 });
    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ error: 'Excluído', code: 'project_deleted', cloudVersion: 3 }, 409));
    const receipt = await flushProjectOutbox(ALICE);
    expect(receipt).toEqual({ sent: 0, pending: 1, needsReview: [{
      kind: 'put_deleted', projectId: 'janine', projectName: 'Clínica', reviewVersion: 3,
    }] });
    expect(fetch).toHaveBeenCalledTimes(2); // sessão e PUT; nunca cria cópia
    expect(await getPendingProjectOp(ALICE, 'janine')).toMatchObject({
      kind: 'review_put_deleted', entry, baseVersion: 2,
    });

    fetch.mockResolvedValueOnce(session());
    expect(await flushProjectOutbox(ALICE)).toEqual(receipt);
    expect(fetch).toHaveBeenCalledTimes(3); // no próximo boot só confirma a conta
    await queueProjectPut(ALICE, { ...entry, doc: { title: 'Revisão mais recente' } }, { baseVersion: 3 });
    expect(await getPendingProjectOp(ALICE, 'janine')).toMatchObject({
      kind: 'review_put_deleted', entry: { doc: { title: 'Revisão mais recente' } },
    });
    fetch.mockResolvedValueOnce(session());
    expect((await flushProjectOutbox(ALICE)).needsReview).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('servidor antigo com 409 genérico e GET 404 também não cria cópia de projeto excluído', async () => {
    const entry = { id: 'janine', doc: { title: 'Local' } };
    await queueProjectPut(ALICE, entry, { baseVersion: 2 });
    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ error: 'Conflito', code: 'project_conflict', cloudVersion: 3 }, 409))
      .mockResolvedValueOnce(json({ error: 'Não encontrado', code: 'project_not_found' }, 404));
    expect(await flushProjectOutbox(ALICE)).toEqual({ sent: 0, pending: 1, needsReview: [{
      kind: 'put_deleted', projectId: 'janine', projectName: '', reviewVersion: 3,
    }] });
    expect(fetch).toHaveBeenCalledTimes(3); // nenhum PUT para conflict-*
    expect(await getPendingProjectOp(ALICE, 'janine')).toMatchObject({
      kind: 'review_put_deleted', entry,
    });
  });

  it('preserva a edição mais nova se o tombstone chegar durante o envio', async () => {
    await queueProjectPut(ALICE, { id: 'janine', name: 'Clínica', doc: { title: 'Antes' } }, { baseVersion: 2 });
    let finishPut;
    fetch.mockResolvedValueOnce(session()).mockImplementationOnce(() => new Promise((resolve) => {
      finishPut = resolve;
    }));
    const sending = flushProjectOutbox(ALICE);
    await vi.waitFor(() => expect(finishPut).toBeTypeOf('function'));
    await queueProjectPut(ALICE, { id: 'janine', name: 'Clínica', doc: { title: 'Depois' } }, { baseVersion: 2 });
    finishPut(json({ error: 'Excluído', code: 'project_deleted', cloudVersion: 3 }, 409));
    expect(await sending).toMatchObject({ sent: 0, pending: 1, needsReview: [{ kind: 'put_deleted' }] });
    expect(await getPendingProjectOp(ALICE, 'janine')).toMatchObject({
      kind: 'review_put_deleted', entry: { doc: { title: 'Depois' } },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('reconhece a mesma cópia se a confirmação de rede se perder', async () => {
    const op = await queueProjectPut(ALICE, { id: 'janine', name: 'Clínica', doc: { title: 'Local' } }, { baseVersion: 2 });
    const copyId = `conflict-${op.opId.replace(/[^A-Za-z0-9]/g, '')}`;
    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ error: 'Conflito', code: 'project_conflict', cloudVersion: 3 }, 409))
      .mockResolvedValueOnce(json({ ok: true, project: {
        id: 'janine', entry: { id: 'janine', doc: { title: 'Outro' } }, version: 3,
      } }))
      .mockRejectedValueOnce(new TypeError('Resposta perdida'));
    await expect(flushProjectOutbox(ALICE)).rejects.toMatchObject({ code: 'project_network_error' });
    const copyEntry = JSON.parse(fetch.mock.calls.at(-1)[1].body).entry;
    expect(copyEntry.id).toBe(copyId);
    expect(await getPendingProjectOp(ALICE, 'janine')).toMatchObject({ opId: op.opId });

    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ error: 'Conflito', code: 'project_conflict', cloudVersion: 3 }, 409))
      .mockResolvedValueOnce(json({ ok: true, project: {
        id: 'janine', entry: { id: 'janine', doc: { title: 'Outro' } }, version: 3,
      } }))
      .mockResolvedValueOnce(json({ error: 'Já existe', code: 'project_conflict', cloudVersion: 1 }, 409))
      .mockResolvedValueOnce(json({ ok: true, project: {
        id: copyId, entry: { ...copyEntry, updatedAt: Date.now() }, version: 1,
      } }));
    expect(await flushProjectOutbox(ALICE)).toMatchObject({ sent: 1, pending: 0 });
    expect(await listPendingProjectOps(ALICE)).toHaveLength(0);
  });

  it('mantém DELETE divergente em revisão até escolha explícita com nova versão', async () => {
    const removal = await queueProjectDelete(ALICE, 'janine', { baseVersion: 3, projectName: 'Clínica' });
    expect(removal.baseVersion).toBe(3);
    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ error: 'Conflito', code: 'project_conflict', cloudVersion: 4 }, 409))
      .mockResolvedValueOnce(json({ ok: true, project: {
        id: 'janine', entry: { id: 'janine', name: 'Clínica atualizada' }, version: 4,
      } }));
    const receipt = await flushProjectOutbox(ALICE);
    expect(receipt).toEqual({ sent: 0, pending: 1, needsReview: [{
      projectId: 'janine', projectName: 'Clínica atualizada', reviewVersion: 4,
    }] });
    expect(await getPendingProjectOp(ALICE, 'janine')).toMatchObject({ kind: 'review_delete', baseVersion: 3 });
    fetch.mockResolvedValueOnce(session());
    expect(await flushProjectOutbox(ALICE)).toEqual(receipt);
    const retry = await queueProjectDelete(ALICE, 'janine', { baseVersion: 4 });
    expect(retry.baseVersion).toBe(4);
    fetch.mockResolvedValueOnce(session()).mockResolvedValueOnce(json({ ok: true, project: {
      id: 'janine', deleted: true, version: 5,
    } }));
    expect(await flushProjectOutbox(ALICE)).toEqual({ sent: 1, pending: 0 });
  });

  it('reconhece DELETE já concluído após perda da resposta', async () => {
    await queueProjectDelete(ALICE, 'janine', { baseVersion: 3 });
    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ error: 'Conflito', code: 'project_conflict', cloudVersion: 4 }, 409))
      .mockResolvedValueOnce(json({ error: 'Não encontrado', code: 'project_not_found' }, 404));
    expect(await flushProjectOutbox(ALICE)).toEqual({ sent: 1, pending: 0 });
  });
});
