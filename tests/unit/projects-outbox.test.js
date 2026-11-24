import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindAccountDataWriteOwner, SK } from '../../src/utils/storage.js';
import { originalImageAssetId } from '../../src/utils/cloud-image-assets.js';
import { flushProjectOutboxForBoot } from '../../src/hooks/useAccess.js';
import {
  acknowledgeProjectOp, conflictCopyEntry, conflictCopyId, flushProjectOutbox, getPendingProjectOp,
  listDeletedProjectEdits, listPendingProjectOps, queueProjectDelete, queueProjectPut,
  resolveDeletedProjectEdit,
} from '../../src/utils/projects-outbox.js';

const ALICE = 'email:alice@example.test';
const BOB = 'email:bob@example.test';

it('cópia de conflito não conserva o vínculo de equipe do projeto original', () => {
  const copy = conflictCopyEntry({
    projectId: 'equipe-a',
    createdAt: 123,
    entry: {
      id: 'equipe-a',
      name: 'Equipe A',
      doc: {
        shareCode: 'AB12CD34', shareRevision: 5, shareUpdatedAt: 100,
        shareMeta: { syncedAt: 99 }, slides: [{ id: 's1', title: 'Local preservado' }],
      },
    },
  });
  expect(copy.id).toBe(conflictCopyId('equipe-a'));
  expect(copy.doc).not.toHaveProperty('shareCode');
  expect(copy.doc).not.toHaveProperty('shareRevision');
  expect(copy.doc).not.toHaveProperty('shareUpdatedAt');
  expect(copy.doc).not.toHaveProperty('shareMeta');
  expect(copy.doc.slides[0].title).toBe('Local preservado');
});

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

  it('reenfileirar o mesmo snapshot conserva a operação em trânsito, inclusive com updatedAt novo', async () => {
    const first = await queueProjectPut(ALICE, {
      id: 'janine', updatedAt: 1, doc: { title: 'Texto', format: 'portrait' },
    }, { baseVersion: 2 });
    const repeated = await queueProjectPut(ALICE, {
      id: 'janine', updatedAt: 2, doc: { format: 'portrait', title: 'Texto' },
    }, { baseVersion: 2 });
    expect(repeated.opId).toBe(first.opId);
    expect(await acknowledgeProjectOp(ALICE, first, 3)).toBe(true);
    expect(await listPendingProjectOps(ALICE)).toEqual([]);
  });

  it('serializa boot e autosave concorrentes para não enviar a mesma operação duas vezes', async () => {
    await queueProjectPut(ALICE, { id: 'janine', doc: { title: 'Texto' } }, { baseVersion: 2 });
    let finishPut;
    let putCount = 0;
    fetch.mockImplementation(async (url) => {
      if (url === '/api/auth/session') return session();
      putCount += 1;
      return new Promise((resolve) => { finishPut = resolve; });
    });
    const first = flushProjectOutbox(ALICE);
    await vi.waitFor(() => expect(finishPut).toBeTypeOf('function'));
    const second = flushProjectOutbox(ALICE);
    await Promise.resolve();
    expect(putCount).toBe(1);
    finishPut(json({ ok: true, project: { id: 'janine', version: 3 } }));
    expect(await first).toEqual({ sent: 1, pending: 0 });
    expect(await second).toEqual({ sent: 0, pending: 0 });
    expect(putCount).toBe(1);
  });

  it('reconhece antecessor próprio com resposta perdida antes de enviar o formato mais recente', async () => {
    const firstEntry = { id: 'janine', name: 'Halloween', doc: { format: 'presentation', title: 'Texto inteiro' } };
    await queueProjectPut(ALICE, firstEntry, { baseVersion: 2 });
    // A foi gravada na conta, mas a resposta não chegou ao navegador.
    fetch.mockResolvedValueOnce(session()).mockRejectedValueOnce(new TypeError('Resposta perdida'));
    await expect(flushProjectOutbox(ALICE)).rejects.toMatchObject({ code: 'project_network_error' });
    const latestEntry = { ...firstEntry, doc: { ...firstEntry.doc, format: 'portrait' } };
    await queueProjectPut(ALICE, latestEntry, { baseVersion: 2 });
    const onConfirmed = vi.fn();
    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ error: 'Conflito', code: 'project_conflict', cloudVersion: 3 }, 409))
      .mockResolvedValueOnce(json({ ok: true, project: { id: 'janine', version: 3, entry: { ...firstEntry, updatedAt: 700 } } }))
      .mockResolvedValueOnce(json({ ok: true, project: { id: 'janine', version: 4, entry: latestEntry } }));
    expect(await flushProjectOutbox(ALICE, { onConfirmed })).toEqual({ sent: 1, pending: 0 });
    const lastPut = JSON.parse(fetch.mock.calls.at(-1)[1].body);
    expect(lastPut).toMatchObject({ baseVersion: 3, entry: latestEntry });
    expect(onConfirmed).toHaveBeenCalledWith({ projectId: 'janine', version: 4, entry: latestEntry });
    expect(fetch.mock.calls.some(([, request]) => request?.body?.includes('conflict-janine'))).toBe(false);
  });

  it('não usa antecessor local para sobrescrever uma edição remota divergente', async () => {
    const firstEntry = { id: 'janine', name: 'Halloween', doc: { title: 'Antes' } };
    await queueProjectPut(ALICE, firstEntry, { baseVersion: 2 });
    await queueProjectPut(ALICE, { ...firstEntry, doc: { title: 'Depois' } }, { baseVersion: 2 });
    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ error: 'Conflito', code: 'project_conflict', cloudVersion: 3 }, 409))
      .mockResolvedValueOnce(json({ ok: true, project: {
        id: 'janine', version: 3, entry: { ...firstEntry, doc: { title: 'Outro dispositivo' } },
      } }))
      .mockResolvedValueOnce(json({ ok: true, project: { id: 'conflict-janine', version: 1 } }));
    expect(await flushProjectOutbox(ALICE)).toMatchObject({ recoveries: [{ sourceProjectId: 'janine' }] });
    const puts = fetch.mock.calls.filter(([, request]) => request?.method === 'PUT')
      .map(([, request]) => JSON.parse(request.body));
    expect(puts.map((body) => [body.entry.id, body.baseVersion])).toEqual([['janine', 2], ['conflict-janine', 0]]);
  });

  it('mantém bytes novos na fila durável e envia a imagem antes do PUT depois de reabrir a fila', async () => {
    const photo = 'data:image/png;base64,bmV3LXBob3RvLWFmdGVyLXNhdmU=';
    const assetId = await originalImageAssetId(photo);
    const entry = { id: 'janine', doc: { slides: [{ id: 's1', title: 'Novo texto', bgImageAssetId: assetId }] } };
    const op = await queueProjectPut(ALICE, entry, { baseVersion: 2, assets: new Map([[assetId, photo]]) });
    expect(idb.records.get(op.key).assets).toEqual([[assetId, photo]]);
    // Nenhum cache JS é necessário: a leitura abre outra conexão IDB.
    const restored = await getPendingProjectOp(ALICE, 'janine');
    expect(restored.assets).toEqual([[assetId, photo]]);
    const events = [];
    fetch.mockImplementation(async (url, request) => {
      if (url === '/api/auth/session') return session();
      if (url === '/api/library-sync') {
        const body = JSON.parse(request.body);
        expect(body).toMatchObject({ action: 'putAsset', assetId, dataUrl: photo });
        events.push('asset');
        return json({ ok: true, assetId });
      }
      events.push('project');
      expect(events[0]).toBe('asset');
      expect(JSON.parse(request.body).entry.doc.slides[0].bgImageAssetId).toBe(assetId);
      return json({ ok: true, project: { id: 'janine', entry, version: 3 } });
    });
    expect(await flushProjectOutbox(ALICE)).toEqual({ sent: 1, pending: 0 });
    expect(events).toEqual(['asset', 'project']);
    expect(await getPendingProjectOp(ALICE, 'janine')).toBeNull();
  });

  it('falha no upload vai para revisão e não bloqueia a próxima abertura da biblioteca', async () => {
    const photo = 'data:image/png;base64,cGhvdG8tdXBsb2FkLWZhaWxlZA==';
    const assetId = await originalImageAssetId(photo);
    const entry = { id: 'janine', doc: { slides: [{ id: 's1', bgImageAssetId: assetId }] } };
    const op = await queueProjectPut(ALICE, entry, { assets: new Map([[assetId, photo]]) });
    fetch.mockImplementation(async (url) => url === '/api/auth/session'
      ? session() : json({ error: 'Upload indisponível.' }, 503));
    expect(await flushProjectOutbox(ALICE)).toEqual({ sent: 0, pending: 1, needsReview: [{
      projectId: 'janine', projectName: '', kind: 'sync_failed', operation: 'put',
      code: 'project_asset_upload_failed', status: 0,
    }] });
    expect(fetch.mock.calls.some(([url]) => url === '/api/projects')).toBe(false);
    expect(await getPendingProjectOp(ALICE, 'janine')).toMatchObject({ opId: op.opId, kind: 'review_put_failed', entry, assets: [[assetId, photo]] });
  });

  // MOO-01 (auditoria 20/11): a falha de upload era tratada como definitiva.
  // A edição ficava só neste navegador e as seguintes do mesmo projeto também.
  it('falha passageira de upload é reenviada no próximo envio quando a rede volta', async () => {
    const photo = 'data:image/png;base64,cmV0cnktdXBsb2Fk';
    const assetId = await originalImageAssetId(photo);
    const entry = { id: 'janine', doc: { slides: [{ id: 's1', bgImageAssetId: assetId }] } };
    await queueProjectPut(ALICE, entry, { baseVersion: 2, assets: new Map([[assetId, photo]]) });
    fetch.mockImplementation(async (url) => url === '/api/auth/session'
      ? session() : json({ error: 'Upload indisponível.' }, 503));
    expect(await flushProjectOutbox(ALICE)).toMatchObject({ pending: 1, needsReview: [{ code: 'project_asset_upload_failed' }] });

    fetch.mockReset();
    fetch.mockImplementation(async (url, request) => {
      if (url === '/api/auth/session') return session();
      if (url === '/api/library-sync') return json({ ok: true, assetId: JSON.parse(request.body).assetId });
      return json({ ok: true, project: { id: 'janine', entry, version: 3 } });
    });
    expect(await flushProjectOutbox(ALICE)).toEqual({ sent: 1, pending: 0 });
    expect(await getPendingProjectOp(ALICE, 'janine')).toBeNull();
  });

  it('edição feita depois de uma falha de upload volta à fila de envio e leva o texto mais novo', async () => {
    const photo = 'data:image/png;base64,c2VndW5kYS1lZGljYW8=';
    const assetId = await originalImageAssetId(photo);
    const first = { id: 'janine', doc: { slides: [{ id: 's1', title: 'Antes', bgImageAssetId: assetId }] } };
    await queueProjectPut(ALICE, first, { baseVersion: 2, assets: new Map([[assetId, photo]]) });
    fetch.mockImplementation(async (url) => url === '/api/auth/session'
      ? session() : json({ error: 'Upload indisponível.' }, 503));
    await flushProjectOutbox(ALICE);

    const latest = { id: 'janine', doc: { slides: [{ id: 's1', title: 'Depois', bgImageAssetId: assetId }] } };
    expect(await queueProjectPut(ALICE, latest, { baseVersion: 2 })).toMatchObject({ kind: 'put', assets: [[assetId, photo]] });

    fetch.mockReset();
    const puts = [];
    fetch.mockImplementation(async (url, request) => {
      if (url === '/api/auth/session') return session();
      if (url === '/api/library-sync') return json({ ok: true, assetId: JSON.parse(request.body).assetId });
      puts.push(JSON.parse(request.body));
      return json({ ok: true, project: { id: 'janine', entry: latest, version: 3 } });
    });
    expect(await flushProjectOutbox(ALICE)).toEqual({ sent: 1, pending: 0 });
    expect(puts.map((body) => body.entry.doc.slides[0].title)).toEqual(['Depois']);
  });

  it.each([401, 408, 425, 429])('mantém a edição reenviável após erro temporário %s', async (status) => {
    const entry = { id: 'janine', doc: { title: `Ainda pendente ${status}` } };
    const op = await queueProjectPut(ALICE, entry, { baseVersion: 2 });
    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ error: 'Tente novamente.', code: 'project_temporarily_unavailable' }, status));

    await expect(flushProjectOutbox(ALICE)).rejects.toMatchObject({ status });
    expect(await getPendingProjectOp(ALICE, 'janine')).toMatchObject({
      opId: op.opId, kind: 'put', entry,
    });

    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ ok: true, project: { id: 'janine', version: 3, entry } }));
    await expect(flushProjectOutbox(ALICE)).resolves.toEqual({ sent: 1, pending: 0 });
    expect(await getPendingProjectOp(ALICE, 'janine')).toBeNull();
  });

  it('adiciona bytes ao mesmo snapshot sem trocar o ID da operação', async () => {
    const photo = 'data:image/png;base64,c2FtZS1vcC1hc3NldA==';
    const assetId = await originalImageAssetId(photo);
    const entry = { id: 'janine', doc: { slides: [{ id: 's1', bgImageAssetId: assetId }] } };
    const first = await queueProjectPut(ALICE, entry);
    const second = await queueProjectPut(ALICE, entry, { assets: new Map([[assetId, photo]]) });
    expect(second.opId).toBe(first.opId);
    expect((await getPendingProjectOp(ALICE, 'janine')).assets).toEqual([[assetId, photo]]);
  });

  it('edita texto sem perder bytes já pendentes e deixa de enviar uma foto removida', async () => {
    const photo = 'data:image/png;base64,cGVuZGluZy1waG90by1ieXRlcw==';
    const assetId = await originalImageAssetId(photo);
    const entry = { id: 'janine', doc: { slides: [{ id: 's1', title: 'Antes', bgImageAssetId: assetId }] } };
    await queueProjectPut(ALICE, entry, { assets: new Map([[assetId, photo]]) });
    await queueProjectPut(ALICE, { ...entry, doc: { slides: [{ ...entry.doc.slides[0], title: 'Depois' }] } });
    expect((await getPendingProjectOp(ALICE, 'janine')).assets).toEqual([[assetId, photo]]);
    await queueProjectPut(ALICE, { ...entry, doc: { slides: [{ id: 's1', title: 'Sem foto' }] } });
    expect((await getPendingProjectOp(ALICE, 'janine')).assets).toBeUndefined();
  });

  // MOO-21: outro cliente Stripe com o MESMO e-mail não pode enviar a fila
  // guardada no slot do e-mail, que pertence ao primeiro cliente.
  it('não transmite a fila do e-mail para outro cliente com o mesmo e-mail', async () => {
    localStorage.setItem('vc_owner_email_bindings', JSON.stringify({ [ALICE]: 'cus_alice' }));
    await queueProjectPut(ALICE, { id: 'janine', doc: { title: 'Privado' } });
    fetch.mockImplementation(async (url) => url === '/api/auth/session'
      ? json({ active: true, customerId: 'cus_outro', email: 'alice@example.test' })
      : json({ ok: true }));
    await expect(flushProjectOutbox(ALICE)).rejects.toMatchObject({ code: 'project_owner_changed' });
    expect(fetch.mock.calls.filter(([url]) => url !== '/api/auth/session')).toEqual([]);
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
    await queueProjectPut(ALICE, { id: 'janine', name: 'Clínica', doc: { title: 'Local' } }, { baseVersion: 2 });
    const copyId = conflictCopyId('janine');
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

  it('atualiza a mesma cópia quando o projeto conflita de novo', async () => {
    await queueProjectPut(ALICE, { id: 'janine', name: 'Clínica', doc: { title: 'Local 1' } }, { baseVersion: 2 });
    const copyId = conflictCopyId('janine');
    const remote = { id: 'janine', entry: { id: 'janine', doc: { title: 'Outra aba' } }, version: 3 };
    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ error: 'Conflito', code: 'project_conflict', cloudVersion: 3 }, 409))
      .mockResolvedValueOnce(json({ ok: true, project: remote }))
      .mockResolvedValueOnce(json({ ok: true, project: { id: copyId, version: 1 } }));
    await flushProjectOutbox(ALICE);

    await queueProjectPut(ALICE, { id: 'janine', name: 'Clínica', doc: { title: 'Local 2' } }, { baseVersion: 2 });
    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ error: 'Conflito', code: 'project_conflict', cloudVersion: 3 }, 409))
      .mockResolvedValueOnce(json({ ok: true, project: remote }))
      .mockResolvedValueOnce(json({ error: 'Já existe', code: 'project_conflict', cloudVersion: 1 }, 409))
      .mockResolvedValueOnce(json({ ok: true, project: {
        id: copyId, entry: { id: copyId, name: 'Clínica (cópia de conflito)', doc: { title: 'Local 1' } }, version: 1,
      } }))
      .mockResolvedValueOnce(json({ ok: true, project: { id: copyId, version: 2 } }));
    const receipt = await flushProjectOutbox(ALICE);
    expect(receipt.recoveries).toEqual([{
      sourceProjectId: 'janine', copyProjectId: copyId,
      copyName: 'Clínica (cópia de conflito)',
    }]);
    const update = JSON.parse(fetch.mock.calls.at(-1)[1].body);
    expect(update.baseVersion).toBe(1);
    expect(update.entry.id).toBe(copyId);
    expect(update.entry.doc.title).toBe('Local 2');
    expect([...fetch.mock.calls].filter((call) => {
      const body = call[1]?.body ? JSON.parse(call[1].body) : null;
      return body?.entry?.id?.startsWith('conflict-');
    }).map((call) => JSON.parse(call[1].body).entry.id)).toEqual([copyId, copyId, copyId]);
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

  // Auditoria 23/11 (DB-02): a edição retida não tinha tela de revisão e
  // travava Sync, salvamento automático e Sair para sempre naquele navegador.
  describe('revisão de edição de projeto excluído em outro dispositivo', () => {
    async function holdDeletedEdit(entry = { id: 'janine', name: 'Clínica', doc: { title: 'Edição do celular' } }) {
      await queueProjectPut(ALICE, entry, { baseVersion: 2 });
      fetch.mockResolvedValueOnce(session())
        .mockResolvedValueOnce(json({ error: 'Excluído', code: 'project_deleted', cloudVersion: 3 }, 409));
      await flushProjectOutbox(ALICE);
      return entry;
    }

    it('lista só as edições retidas por exclusão, com nome e data, sem expor o conteúdo', async () => {
      await holdDeletedEdit();
      await queueProjectPut(ALICE, { id: 'outro', name: 'Normal', doc: {} });
      const reviews = await listDeletedProjectEdits(ALICE);
      expect(reviews).toHaveLength(1);
      expect(reviews[0]).toMatchObject({ projectId: 'janine', projectName: 'Clínica', copyName: 'Clínica (cópia de conflito)' });
      expect(reviews[0].updatedAt).toEqual(expect.any(Number));
      expect(reviews[0]).not.toHaveProperty('entry');
    });

    it('descartar remove a operação e a fila volta a ficar vazia, sem falar com a nuvem', async () => {
      await holdDeletedEdit();
      const calls = fetch.mock.calls.length;
      expect(await resolveDeletedProjectEdit(ALICE, 'janine', 'discard')).toEqual({ resolved: true, discarded: true });
      expect(fetch).toHaveBeenCalledTimes(calls);
      expect(await listPendingProjectOps(ALICE)).toEqual([]);
      fetch.mockResolvedValueOnce(session());
      expect(await flushProjectOutbox(ALICE)).toEqual({ sent: 0, pending: 0 });
    });

    it('manter grava a edição como projeto novo na conta e só então libera a fila', async () => {
      const entry = await holdDeletedEdit();
      fetch.mockResolvedValueOnce(session())
        .mockResolvedValueOnce(json({ ok: true, project: { id: 'conflict-janine', version: 1 } }));
      const result = await resolveDeletedProjectEdit(ALICE, 'janine', 'copy');
      expect(result).toMatchObject({
        resolved: true,
        recoveredCopy: { sourceProjectId: 'janine', copyProjectId: 'conflict-janine', copyName: 'Clínica (cópia de conflito)' },
      });
      expect(result.copyEntry).toMatchObject({ id: 'conflict-janine', doc: entry.doc, conflictSourceId: 'janine' });
      const put = fetch.mock.calls.at(-1);
      expect(put[1].method).toBe('PUT');
      expect(JSON.parse(put[1].body)).toMatchObject({ baseVersion: 0, entry: { id: 'conflict-janine' } });
      expect(await listPendingProjectOps(ALICE)).toEqual([]);
    });

    it('se a nuvem falhar ao gravar a cópia, a edição continua retida para nova tentativa', async () => {
      await holdDeletedEdit();
      fetch.mockResolvedValueOnce(session()).mockResolvedValueOnce(json({ error: 'Indisponível' }, 503));
      await expect(resolveDeletedProjectEdit(ALICE, 'janine', 'copy')).rejects.toBeTruthy();
      expect(await getPendingProjectOp(ALICE, 'janine')).toMatchObject({ kind: 'review_put_deleted' });
      expect(await listDeletedProjectEdits(ALICE)).toHaveLength(1);
    });

    it('não toca em operação comum nem aceita ação desconhecida', async () => {
      await queueProjectPut(ALICE, { id: 'normal', doc: {} });
      expect(await resolveDeletedProjectEdit(ALICE, 'normal', 'discard')).toEqual({ resolved: false });
      expect(await getPendingProjectOp(ALICE, 'normal')).toMatchObject({ kind: 'put' });
      await expect(resolveDeletedProjectEdit(ALICE, 'normal', 'apagar-tudo')).rejects.toMatchObject({ code: 'project_bad_review_action' });
      expect(await resolveDeletedProjectEdit(ALICE, 'inexistente', 'discard')).toEqual({ resolved: false });
    });

    it('outra conta não lista nem resolve a edição retida', async () => {
      await holdDeletedEdit();
      setOwner(BOB);
      expect(await listDeletedProjectEdits(BOB)).toEqual([]);
      await expect(resolveDeletedProjectEdit(ALICE, 'janine', 'discard')).rejects.toBeTruthy();
      setOwner(ALICE);
      expect(await listDeletedProjectEdits(ALICE)).toHaveLength(1);
    });
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
    const copyId = conflictCopyId('janine');
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

// DB-01 (auditoria 23/11): um 5xx que se repete sempre para o mesmo projeto
// (por exemplo o banco recusando o documento) parava a fila inteira e o boot.
describe('DB-01: 5xx repetido num projeto não trava os demais nem o boot', () => {
  const unavailable = () => json({
    error: 'O armazenamento de projetos está indisponível. Tente novamente.', code: 'library_storage_unavailable',
  }, 503);
  const saved = (id, version = 1) => json({ ok: true, project: { id, version, entry: { id } } });
  function serve(handlers) {
    fetch.mockImplementation(async (url, request) => {
      if (url === '/api/auth/session') return session();
      const body = request?.body ? JSON.parse(request.body) : null;
      const id = body?.entry?.id || body?.id;
      return handlers(id, request);
    });
  }

  it('na terceira falha seguida o projeto vai para revisão e o segundo projeto é enviado e confirmado', async () => {
    await queueProjectPut(ALICE, { id: 'preso', doc: { title: 'A' } });
    await queueProjectPut(ALICE, { id: 'saudavel', doc: { title: 'B' } });
    serve((id) => (id === 'preso' ? unavailable() : saved(id)));

    await expect(flushProjectOutbox(ALICE)).rejects.toMatchObject({ status: 503 });
    await expect(flushProjectOutbox(ALICE)).rejects.toMatchObject({ status: 503 });
    expect(await getPendingProjectOp(ALICE, 'saudavel')).toMatchObject({ kind: 'put' });

    const receipt = await flushProjectOutbox(ALICE);
    expect(receipt).toEqual({ sent: 1, pending: 1, needsReview: [{
      projectId: 'preso', projectName: '', kind: 'sync_failed', operation: 'put',
      code: 'library_storage_unavailable', status: 503,
    }] });
    expect(await getPendingProjectOp(ALICE, 'saudavel')).toBeNull();
    // A edição presa continua inteira na fila deste navegador.
    expect(await getPendingProjectOp(ALICE, 'preso')).toMatchObject({
      kind: 'review_put_failed', entry: { id: 'preso', doc: { title: 'A' } },
    });
    // O boot aceita o recibo: só resta a operação em revisão.
    await expect(flushProjectOutboxForBoot(ALICE, () => receipt)).resolves.toMatchObject({ unavailable: false });
  });

  it('continua tentando o projeto preso a cada envio e confirma quando o servidor aceita', async () => {
    await queueProjectPut(ALICE, { id: 'preso', doc: { title: 'A' } }, { baseVersion: 4 });
    serve(() => unavailable());
    await expect(flushProjectOutbox(ALICE)).rejects.toMatchObject({ status: 503 });
    await expect(flushProjectOutbox(ALICE)).rejects.toMatchObject({ status: 503 });
    expect(await flushProjectOutbox(ALICE)).toMatchObject({ sent: 0, pending: 1 });
    // Ainda falhando: não lança, segue em revisão.
    expect(await flushProjectOutbox(ALICE)).toMatchObject({ sent: 0, pending: 1 });

    const puts = [];
    serve((id, request) => { puts.push(JSON.parse(request.body)); return saved(id, 5); });
    expect(await flushProjectOutbox(ALICE)).toEqual({ sent: 1, pending: 0 });
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({ baseVersion: 4, entry: { id: 'preso' } });
  });

  it('edição nova do projeto preso volta a ser envio comum sem voltar a parar a fila', async () => {
    await queueProjectPut(ALICE, { id: 'preso', doc: { title: 'A' } });
    serve(() => unavailable());
    await expect(flushProjectOutbox(ALICE)).rejects.toMatchObject({ status: 503 });
    await expect(flushProjectOutbox(ALICE)).rejects.toMatchObject({ status: 503 });
    await flushProjectOutbox(ALICE);

    expect(await queueProjectPut(ALICE, { id: 'preso', doc: { title: 'A2' } })).toMatchObject({ kind: 'put' });
    await queueProjectPut(ALICE, { id: 'saudavel', doc: { title: 'B' } });
    serve((id) => (id === 'preso' ? unavailable() : saved(id)));
    expect(await flushProjectOutbox(ALICE)).toMatchObject({ sent: 1, pending: 1 });
    expect(await getPendingProjectOp(ALICE, 'preso')).toMatchObject({
      kind: 'review_put_failed', entry: { doc: { title: 'A2' } },
    });
  });

  it('uma ou duas falhas 5xx continuam sendo falha passageira: a operação segue como envio comum', async () => {
    const op = await queueProjectPut(ALICE, { id: 'janine', doc: { title: 'A' } });
    serve(() => unavailable());
    await expect(flushProjectOutbox(ALICE)).rejects.toMatchObject({ status: 503 });
    expect(await getPendingProjectOp(ALICE, 'janine')).toMatchObject({ opId: op.opId, kind: 'put' });
    serve((id) => saved(id));
    expect(await flushProjectOutbox(ALICE)).toEqual({ sent: 1, pending: 0 });
  });

  it('falha de rede (sem resposta do servidor) nunca vira revisão', async () => {
    await queueProjectPut(ALICE, { id: 'janine', doc: { title: 'A' } });
    fetch.mockImplementation(async (url) => {
      if (url === '/api/auth/session') return session();
      throw new TypeError('Failed to fetch');
    });
    for (let i = 0; i < 4; i += 1) {
      await expect(flushProjectOutbox(ALICE)).rejects.toMatchObject({ code: 'project_network_error' });
    }
    expect(await getPendingProjectOp(ALICE, 'janine')).toMatchObject({ kind: 'put' });
  });

  it('exclusão com 5xx repetido também deixa de parar a fila e é refeita depois', async () => {
    await queueProjectDelete(ALICE, 'apagar', { baseVersion: 2, projectName: 'Antigo' });
    await queueProjectPut(ALICE, { id: 'saudavel', doc: { title: 'B' } });
    serve((id) => (id === 'apagar' ? unavailable() : saved(id)));
    await expect(flushProjectOutbox(ALICE)).rejects.toMatchObject({ status: 503 });
    await expect(flushProjectOutbox(ALICE)).rejects.toMatchObject({ status: 503 });
    expect(await flushProjectOutbox(ALICE)).toMatchObject({ sent: 1, pending: 1 });
    serve((id) => json({ ok: true, project: { id, version: 3, deleted: true } }));
    expect(await flushProjectOutbox(ALICE)).toEqual({ sent: 1, pending: 0 });
  });
});
