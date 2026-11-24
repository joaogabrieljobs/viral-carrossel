import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindAccountDataWriteOwner, SK, unlockAccountDataWrites } from '../../src/utils/storage.js';
import { originalImageAssetId } from '../../src/utils/cloud-image-assets.js';
import { flushProjectOutboxForBoot } from '../../src/hooks/useAccess.js';
import {
  buildUnsentProjectMarker, readUnsentProjectMarker, requeueUnsentCachedProjects, writeUnsentProjectMarker,
} from '../../src/utils/unsent-project-marker.js';
import {
  acknowledgeProjectOp, conflictCopyEntry, conflictCopyId, flushProjectOutbox, getPendingProjectOp,
  listDeletedProjectEdits, listPendingProjectOps, listRetainedProjectEdits, overlayRetainedProjectEdits,
  queueProjectDelete, queueProjectPut, resolveDeletedProjectEdit, retainedProjectMessage,
  wipeProjectOutboxForOwners,
} from '../../src/utils/projects-outbox.js';
import { clearAccountLocalData, OUTBOX_WIPE_OWNERS_KEY } from '../../src/utils/clear-account-data.js';

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
              return {
                getAll(owner) { return request(() => [...staged.values()]
                  .filter((row) => row.owner === owner).map((row) => structuredClone(row))); },
                getAllKeys(owner) { return request(() => [...staged.values()]
                  .filter((row) => row.owner === owner).map((row) => row.key)); },
              };
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

// DB-03 (auditoria 23/11): um 4xx do servidor (por exemplo o limite de 250
// projetos) virava "falha permanente" sem saída. A edição seguinte não era
// enviada e, ao recarregar, o projeto que só existia na fila sumia da lista.
describe('DB-03: 4xx do servidor não prende o projeto para sempre', () => {
  const limit = () => json({
    error: 'Sua conta atingiu o limite de 250 projetos. Exclua um projeto antes de criar outro.',
    code: 'project_account_limit', limit: 250,
  }, 413);

  it('depois do 413 de limite, a edição seguinte é enviada quando o servidor aceita', async () => {
    await queueProjectPut(ALICE, { id: 'novo', name: 'Projeto 251', doc: { title: 'A' } });
    fetch.mockResolvedValueOnce(session()).mockResolvedValueOnce(limit());
    expect(await flushProjectOutbox(ALICE)).toMatchObject({ sent: 0, pending: 1, needsReview: [{
      projectId: 'novo', kind: 'sync_failed', code: 'project_account_limit', status: 413,
    }] });
    // A frase do servidor fica guardada para a tela, em vez de "a conexão".
    expect(await getPendingProjectOp(ALICE, 'novo')).toMatchObject({
      kind: 'review_put_failed',
      reviewMessage: 'Sua conta atingiu o limite de 250 projetos. Exclua um projeto antes de criar outro.',
    });

    const edited = { id: 'novo', name: 'Projeto 251', doc: { title: 'B' } };
    expect(await queueProjectPut(ALICE, edited)).toMatchObject({ kind: 'put', baseVersion: 0 });
    const puts = [];
    fetch.mockReset();
    fetch.mockImplementation(async (url, request) => {
      if (url === '/api/auth/session') return session();
      puts.push(JSON.parse(request.body));
      return json({ ok: true, project: { id: 'novo', version: 1, entry: edited } });
    });
    expect(await flushProjectOutbox(ALICE)).toEqual({ sent: 1, pending: 0 });
    expect(puts.map((body) => body.entry.doc.title)).toEqual(['B']);
  });

  it('sem edição nova o projeto recusado continua retido e não gera pedidos repetidos', async () => {
    const entry = { id: 'novo', doc: { title: 'A' } };
    await queueProjectPut(ALICE, entry);
    fetch.mockResolvedValueOnce(session()).mockResolvedValueOnce(limit());
    await flushProjectOutbox(ALICE);
    // Reenfileirar o mesmo conteúdo (Sync, salvamento automático) não é edição nova.
    expect(await queueProjectPut(ALICE, entry)).toMatchObject({ kind: 'review_put_failed' });
    fetch.mockReset();
    fetch.mockImplementation(async (url) => (url === '/api/auth/session' ? session() : limit()));
    expect(await flushProjectOutbox(ALICE)).toMatchObject({ sent: 0, pending: 1 });
    expect(fetch.mock.calls.some(([url]) => url === '/api/projects')).toBe(false);
  });

  it('edição de projeto excluído em outro dispositivo continua exigindo a escolha da pessoa', async () => {
    await queueProjectPut(ALICE, { id: 'janine', doc: { title: 'A' } }, { baseVersion: 2 });
    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ error: 'Excluído', code: 'project_deleted', cloudVersion: 3 }, 409));
    await flushProjectOutbox(ALICE);
    expect(await queueProjectPut(ALICE, { id: 'janine', doc: { title: 'B' } }, { baseVersion: 2 }))
      .toMatchObject({ kind: 'review_put_deleted' });
  });

  it('lista para a biblioteca os projetos retidos, com o conteúdo e o motivo', async () => {
    await queueProjectPut(ALICE, { id: 'novo', name: 'Projeto 251', doc: { title: 'A' } });
    await queueProjectPut(ALICE, { id: 'comum', doc: { title: 'B' } });
    fetch.mockImplementation(async (url, request) => {
      if (url === '/api/auth/session') return session();
      return JSON.parse(request.body).entry.id === 'novo'
        ? limit() : json({ ok: true, project: { id: 'comum', version: 1 } });
    });
    await flushProjectOutbox(ALICE);
    expect(await listRetainedProjectEdits(ALICE)).toEqual([{
      projectId: 'novo', entry: { id: 'novo', name: 'Projeto 251', doc: { title: 'A' } },
      baseVersion: 0, code: 'project_account_limit', status: 413,
      message: 'Sua conta atingiu o limite de 250 projetos. Exclua um projeto antes de criar outro.',
    }]);
    setOwner(BOB);
    expect(await listRetainedProjectEdits(BOB)).toEqual([]);
  });
});

describe('DB-03: o boot não esconde projeto que só existe na fila', () => {
  const retained = (projectId, title) => ({
    projectId, entry: { id: projectId, name: title, doc: { title } }, baseVersion: 0,
    code: 'project_account_limit', status: 413, message: 'Limite.',
  });

  it('projeto que nunca chegou à conta volta para a lista, marcado como não enviado', () => {
    const cloud = [{ id: 'a', name: 'Da conta', doc: { title: 'A' } }];
    const result = overlayRetainedProjectEdits(cloud, [retained('novo', 'Só neste navegador')]);
    expect(result.library.map((entry) => entry.id)).toEqual(['novo', 'a']);
    expect(result.library[0]).toMatchObject({ name: 'Só neste navegador' });
    expect(result.unsent).toEqual({ novo: { onlyHere: true, code: 'project_account_limit', status: 413, message: 'Limite.' } });
    expect(result.changed).toBe(true);
  });

  it('projeto que existe na conta mostra a edição retida no lugar da versão antiga', () => {
    const cloud = [{ id: 'a', name: 'Antiga', doc: { title: 'Antiga' } }, { id: 'b', name: 'B', doc: {} }];
    const result = overlayRetainedProjectEdits(cloud, [retained('a', 'Edição retida')]);
    expect(result.library.map((entry) => entry.name)).toEqual(['Edição retida', 'B']);
    expect(result.library[1]).toBe(cloud[1]);
    expect(result.unsent.a).toMatchObject({ onlyHere: false });
  });

  it('sem nada retido devolve a mesma lista', () => {
    const cloud = [{ id: 'a' }];
    expect(overlayRetainedProjectEdits(cloud, [])).toEqual({ library: cloud, unsent: {}, changed: false });
    expect(overlayRetainedProjectEdits(cloud, []).library).toBe(cloud);
  });

  it('a mensagem ao salvar usa a frase do servidor e diz o que acontece com a edição', () => {
    expect(retainedProjectMessage({ kind: 'review_put_failed', reviewStatus: 413,
      reviewMessage: 'Sua conta atingiu o limite de 250 projetos. Exclua um projeto antes de criar outro.' }))
      .toBe('Sua conta atingiu o limite de 250 projetos. Exclua um projeto antes de criar outro. A edição continua salva neste navegador e será enviada na próxima alteração do projeto.');
    // Sem frase do servidor (falha de upload, 5xx) continua a mensagem de fila local.
    expect(retainedProjectMessage({ kind: 'review_put_failed', reviewStatus: 503, reviewMessage: 'Indisponível.' }))
      .toBe('O projeto ficou na fila local. Sincronize quando a conexão voltar.');
    expect(retainedProjectMessage({ kind: 'put' }))
      .toBe('O projeto ficou na fila local. Sincronize quando a conexão voltar.');
  });
});

// DB-05 (auditoria 23/11): a edição só entrava na fila durável dentro do envio,
// 4 s depois da última alteração. Recarregar ou fechar antes disso deixava a
// edição só no cache local, e o boot seguinte a trocava pela versão da nuvem.
// O marcador síncrono leva o projeto do cache para a fila no boot; quem decide
// conflito continua sendo a versão no servidor.
describe('DB-05: no boot, o projeto marcado como não enviado vai do cache para a fila', () => {
  const fingerprint = (entry) => JSON.stringify(entry.doc);
  const saved = { id: 'janine', name: 'Clínica', doc: { slides: [{ id: 's1', title: 'Titulo com ero' }] } };
  const edited = { ...saved, doc: { slides: [{ id: 's1', title: 'Título corrigido' }] } };

  /** O que a aba anterior deixou: cache local com a edição e o marcador (versão 7). */
  function closedTabWith(library, { version = 7 } = {}) {
    writeUnsentProjectMarker(buildUnsentProjectMarker({
      owner: ALICE, library, fingerprint,
      baselines: new Map([['janine', fingerprint(saved)]]), versions: new Map([['janine', version]]),
    }), localStorage);
    return structuredClone(library);
  }
  const boot = (cache) => requeueUnsentCachedProjects({
    owner: ALICE, storage: localStorage, library: cache, fingerprint,
    getPendingOp: (id) => getPendingProjectOp(ALICE, id),
    prepare: async (entry) => ({ entry: structuredClone(entry), assets: new Map() }),
    queue: (entry, options) => queueProjectPut(ALICE, entry, options),
  });

  it('a edição feita logo antes do reload é enviada antes da lista, com a versão observada', async () => {
    const cache = closedTabWith([edited]);
    expect(await boot(cache)).toEqual({ queued: 1, skipped: 0, failed: 0 });
    expect(await getPendingProjectOp(ALICE, 'janine')).toMatchObject({ kind: 'put', baseVersion: 7, entry: edited });
    expect(readUnsentProjectMarker(ALICE, localStorage)).toBeNull();

    const puts = [];
    fetch.mockImplementation(async (url, request) => {
      if (url === '/api/auth/session') return session();
      puts.push(JSON.parse(request.body));
      return json({ ok: true, project: { id: 'janine', version: 8, entry: edited } });
    });
    expect((await flushProjectOutboxForBoot(ALICE, flushProjectOutbox)).receipt).toEqual({ sent: 1, pending: 0 });
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({ baseVersion: 7, entry: { doc: { slides: [{ title: 'Título corrigido' }] } } });
  });

  it('projeto criado e nunca enviado entra com versão 0', async () => {
    const novo = { id: 'novo', name: 'Rascunho', doc: { slides: [{ id: 's1', title: 'A' }] } };
    expect(await boot(closedTabWith([novo]))).toEqual({ queued: 1, skipped: 0, failed: 0 });
    expect(await getPendingProjectOp(ALICE, 'novo')).toMatchObject({ kind: 'put', baseVersion: 0 });
  });

  it('marcador velho não sobrescreve versão mais nova da conta: vira cópia de conflito', async () => {
    await boot(closedTabWith([edited]));
    const remote = { id: 'janine', name: 'Clínica', doc: { slides: [{ id: 's1', title: 'Editado no celular' }] } };
    const requests = [];
    fetch.mockImplementation(async (url, request) => {
      if (url === '/api/auth/session') return session();
      const method = request?.method || 'GET';
      const body = request?.body ? JSON.parse(request.body) : null;
      requests.push({ method, id: body?.entry?.id || new URL(url, 'https://moont.test').searchParams.get('id'), baseVersion: body?.baseVersion });
      if (method === 'GET') return json({ ok: true, project: { id: 'janine', version: 9, entry: remote } });
      if (body.entry.id === 'janine') {
        return json({ error: 'Conflito', code: 'project_conflict', cloudVersion: 9 }, 409);
      }
      return json({ ok: true, project: { id: body.entry.id, version: 1, entry: body.entry } });
    });
    const receipt = await flushProjectOutbox(ALICE);
    expect(receipt).toMatchObject({ sent: 1, pending: 0, recoveries: [{ sourceProjectId: 'janine' }] });
    // O único PUT no projeto original foi o recusado (versão 7); a edição foi para a cópia.
    expect(requests.filter((item) => item.method === 'PUT' && item.id === 'janine'))
      .toEqual([{ method: 'PUT', id: 'janine', baseVersion: 7 }]);
    expect(requests.some((item) => item.method === 'PUT' && item.id === conflictCopyId('janine'))).toBe(true);
  });

  it('DB-02: projeto excluído em outro aparelho continua indo para a escolha da pessoa', async () => {
    await boot(closedTabWith([edited]));
    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ error: 'Excluído', code: 'project_deleted', cloudVersion: 8 }, 409));
    expect(await flushProjectOutbox(ALICE)).toMatchObject({ sent: 0, pending: 1, needsReview: [{ kind: 'put_deleted' }] });
    expect(await listDeletedProjectEdits(ALICE)).toMatchObject([{ projectId: 'janine' }]);
    expect(fetch.mock.calls.filter(([url]) => url === '/api/projects')).toHaveLength(1);
  });

  it('DB-02: edição já retida para escolha não é trocada pelo cache marcado', async () => {
    await queueProjectPut(ALICE, saved, { baseVersion: 6 });
    fetch.mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ error: 'Excluído', code: 'project_deleted', cloudVersion: 8 }, 409));
    await flushProjectOutbox(ALICE);
    const before = await getPendingProjectOp(ALICE, 'janine');
    expect(await boot(closedTabWith([edited]))).toEqual({ queued: 0, skipped: 1, failed: 0 });
    expect(await getPendingProjectOp(ALICE, 'janine')).toEqual(before);
  });

  it('envio já confirmado com marcador velho é reconhecido, sem cópia nem novo PUT aceito', async () => {
    await boot(closedTabWith([edited]));
    const requests = [];
    fetch.mockImplementation(async (url, request) => {
      if (url === '/api/auth/session') return session();
      const method = request?.method || 'GET';
      requests.push(method);
      if (method === 'GET') return json({ ok: true, project: { id: 'janine', version: 8, entry: { ...edited, updatedAt: 99 } } });
      return json({ error: 'Conflito', code: 'project_conflict', cloudVersion: 8 }, 409);
    });
    expect(await flushProjectOutbox(ALICE)).toEqual({ sent: 1, pending: 0 });
    expect(requests).toEqual(['PUT', 'GET']);
  });
});

// DB-12 (auditoria 23/11): "Sair e apagar deste aparelho" deixava a fila de
// projetos no IndexedDB, com o documento e as fotos das operações retidas.
describe('DB-12: apagar os dados deste aparelho apaga a fila da conta que pediu', () => {
  const ALICE_ID = 'id:cus_alice';
  const photo = 'data:image/png;base64,Zm90by1kZS1jbGllbnRl';

  /** Deixa uma edição da Alice retida para revisão, com a foto dentro da operação. */
  async function retainAliceEdit() {
    const assetId = await originalImageAssetId(photo);
    const entry = { id: 'retido', doc: { slides: [{ id: 's1', title: 'Texto do cliente', bgImageAssetId: assetId }] } };
    await queueProjectPut(ALICE, entry, { assets: new Map([[assetId, photo]]) });
    fetch.mockImplementation(async (url) => url === '/api/auth/session'
      ? session() : json({ error: 'Upload indisponível.' }, 503));
    await flushProjectOutbox(ALICE);
    expect(await getPendingProjectOp(ALICE, 'retido')).toMatchObject({ kind: 'review_put_failed' });
  }

  function setOwnerWithAliases(owner, aliases) {
    setOwner(owner);
    localStorage.setItem(SK.dataOwnerAliases, JSON.stringify([owner, ...aliases]));
  }

  /** Os bancos de imagens, vídeos e cofre confirmam a exclusão. */
  function allowDeleteDatabase() {
    idb.deleteDatabase = () => {
      const request = {};
      queueMicrotask(() => request.onsuccess?.());
      return request;
    };
  }

  const ownersLeft = () => [...new Set([...idb.records.values()].map((row) => row.owner))].sort();

  afterEach(() => { unlockAccountDataWrites(); });

  it('com uma operação retida, a limpeza do aparelho termina e a fila da conta fica vazia', async () => {
    setOwnerWithAliases(ALICE, [ALICE_ID]);
    await retainAliceEdit();
    await queueProjectPut(ALICE, { id: 'pendente', doc: { title: 'Ainda não enviado' } });
    allowDeleteDatabase();

    await expect(clearAccountLocalData({ wipeMedia: true })).resolves.toBeUndefined();

    expect(idb.records.size).toBe(0);
    expect(JSON.stringify([...idb.records.values()])).not.toContain('Texto do cliente');
    expect(sessionStorage.getItem(OUTBOX_WIPE_OWNERS_KEY)).toBeNull();
    unlockAccountDataWrites();
    setOwner(ALICE);
    expect(await listPendingProjectOps(ALICE)).toEqual([]);
  });

  it('a fila de outra conta no mesmo navegador não é tocada', async () => {
    setOwner(BOB);
    const bobOp = await queueProjectPut(BOB, { id: 'do-bob', doc: { title: 'Edição do Bob' } });
    setOwnerWithAliases(ALICE, [ALICE_ID]);
    await retainAliceEdit();
    allowDeleteDatabase();

    await clearAccountLocalData({ wipeMedia: true });

    expect(ownersLeft()).toEqual([BOB]);
    unlockAccountDataWrites();
    setOwner(BOB);
    expect(await listPendingProjectOps(BOB)).toEqual([bobOp]);
  });

  it('operação guardada no outro nome da mesma conta (id do cliente) também sai', async () => {
    setOwner(ALICE_ID);
    await queueProjectPut(ALICE_ID, { id: 'antigo', doc: { title: 'Guardado pelo id' } });
    setOwnerWithAliases(ALICE, [ALICE_ID]);
    await queueProjectPut(ALICE, { id: 'novo', doc: { title: 'Guardado pelo e-mail' } });
    allowDeleteDatabase();

    await clearAccountLocalData({ wipeMedia: true });

    expect(idb.records.size).toBe(0);
  });

  it('sair da conta sem apagar o aparelho mantém a fila (a edição retida é a única cópia)', async () => {
    setOwnerWithAliases(ALICE, [ALICE_ID]);
    await retainAliceEdit();

    await clearAccountLocalData();

    expect(ownersLeft()).toEqual([ALICE]);
  });

  it('se a fila não confirma a exclusão, a limpeza avisa a falha e a nova tentativa ainda sabe de quem apagar', async () => {
    setOwnerWithAliases(ALICE, [ALICE_ID]);
    await retainAliceEdit();
    setOwner(BOB);
    await queueProjectPut(BOB, { id: 'do-bob', doc: { title: 'Edição do Bob' } });
    setOwnerWithAliases(ALICE, [ALICE_ID]);
    allowDeleteDatabase();
    const open = idb.open;
    idb.open = () => { throw new DOMException('Banco bloqueado', 'InvalidStateError'); };

    await expect(clearAccountLocalData({ wipeMedia: true })).rejects.toBeTruthy();
    // As chaves da conta já saíram; o que falta apagar fica anotado nesta aba.
    expect(localStorage.getItem(SK.dataOwner)).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(OUTBOX_WIPE_OWNERS_KEY)).sort()).toEqual([ALICE, ALICE_ID].sort());
    expect(ownersLeft()).toEqual([ALICE, BOB].sort());

    idb.open = open;
    await expect(clearAccountLocalData({ wipeMedia: true })).resolves.toBeUndefined();
    expect(ownersLeft()).toEqual([BOB]);
    expect(sessionStorage.getItem(OUTBOX_WIPE_OWNERS_KEY)).toBeNull();
  });

  it('wipeProjectOutboxForOwners sem dono informado não apaga nada', async () => {
    await queueProjectPut(ALICE, { id: 'fica', doc: { title: 'Fica' } });
    expect(await wipeProjectOutboxForOwners([])).toBe(0);
    expect(await wipeProjectOutboxForOwners([null, ''])).toBe(0);
    expect(idb.records.size).toBe(1);
    expect(await wipeProjectOutboxForOwners([ALICE, ALICE])).toBe(1);
    expect(idb.records.size).toBe(0);
  });
});
