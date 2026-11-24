// DB-05 (continuação): enfileirar a edição no pagehide era assíncrono (preparo
// das imagens + IndexedDB) e não terminava antes de um reload imediato: o
// projeto ainda não enviado sumia. O que é gravado junto do cache local, de
// forma síncrona, é só um marcador pequeno por projeto não enviado; o boot
// seguinte usa o marcador para pôr o projeto do cache na fila durável.
// Segundo sintoma: empacotar para a conta trocava `null` por chave ausente e
// acrescentava `logoImage: null`, então salvar → recarregar → ler mudava o card.
import { describe, expect, it, vi } from 'vitest';
import {
  buildUnsentProjectMarker, readUnsentProjectMarker, requeueUnsentCachedProjects, writeUnsentProjectMarker,
} from '../../src/utils/unsent-project-marker.js';
import { projectCacheFingerprint } from '../../src/utils/project-content-snapshot.js';
import { semImagensDeRuntime } from '../../src/utils/image-store.js';

const OWNER = 'email:alice@example.test';
function memory() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
  };
}
const slide = (title) => ({
  id: 's1', title, bgImage: null, bgImageId: null, bgImageAssetId: null,
  refImage: null, refImageId: null, refImageAssetId: null,
});
const confirmed = { id: 'janine', name: 'Clínica', updatedAt: 1, doc: { slides: [slide('Titulo com ero')] } };
const edited = { id: 'janine', name: 'Clínica', updatedAt: 2, doc: { slides: [slide('Título corrigido')] } };
const created = { id: 'novo', name: 'Rascunho', updatedAt: 3, doc: { slides: [slide('Novo')] } };
const untouched = { id: 'outro', name: 'Outro', updatedAt: 1, doc: { slides: [slide('Igual')] } };

function markerFor(library) {
  return buildUnsentProjectMarker({
    owner: OWNER, library,
    baselines: new Map([['janine', projectCacheFingerprint(confirmed)], ['outro', projectCacheFingerprint(untouched)]]),
    versions: new Map([['janine', 7], ['outro', 2]]),
    fingerprint: projectCacheFingerprint,
  });
}
// O cache local é o que `lsSet(SK.library, semImagensDeRuntime(...))` grava.
const cacheOf = (library) => JSON.parse(JSON.stringify(semImagensDeRuntime(library)));

describe('DB-05: marcador síncrono dos projetos ainda não enviados', () => {
  it('registra só o que difere do confirmado, com a versão observada, e cabe em poucos bytes', () => {
    const marker = markerFor([edited, created, untouched]);
    expect(Object.keys(marker.projects).sort()).toEqual(['janine', 'novo']);
    expect(marker.projects.janine.baseVersion).toBe(7);
    expect(marker.projects.novo.baseVersion).toBe(0);
    expect(JSON.stringify(marker).length).toBeLessThan(300);
    expect(markerFor([confirmed, untouched])).toBeNull();
  });

  it('gravar e ler é síncrono; sem pendência a chave some; marcador de outra conta é descartado', () => {
    const storage = memory();
    expect(writeUnsentProjectMarker(markerFor([edited, untouched]), storage)).toBe(true);
    expect(readUnsentProjectMarker(OWNER, storage).projects.janine.baseVersion).toBe(7);
    expect(readUnsentProjectMarker('email:bob@example.test', storage)).toBeNull();
    expect(storage.values.size).toBe(0);
    writeUnsentProjectMarker(markerFor([edited]), storage);
    writeUnsentProjectMarker(null, storage);
    expect(storage.values.size).toBe(0);
  });

  it('no boot, o projeto do cache marcado entra na fila com a versão observada e o marcador sai', async () => {
    const storage = memory();
    writeUnsentProjectMarker(markerFor([edited, created, untouched]), storage);
    const queue = vi.fn(async () => ({}));
    const result = await requeueUnsentCachedProjects({
      owner: OWNER, storage, library: cacheOf([edited, created, untouched]), fingerprint: projectCacheFingerprint,
      getPendingOp: async () => null,
      prepare: async (entry) => ({ entry, assets: new Map() }),
      queue,
    });
    expect(result).toEqual({ queued: 2, skipped: 0, failed: 0 });
    expect(queue.mock.calls.map(([entry, options]) => [entry.id, options.baseVersion]))
      .toEqual([['janine', 7], ['novo', 0]]);
    expect(queue.mock.calls[0][0].doc.slides[0].title).toBe('Título corrigido');
    expect(readUnsentProjectMarker(OWNER, storage)).toBeNull();
  });

  it('marcador que não corresponde ao cache (cache antigo, projeto ausente) não reenvia nada', async () => {
    const storage = memory();
    writeUnsentProjectMarker(markerFor([edited, created]), storage);
    const queue = vi.fn();
    // O cache não recebeu a edição (armazenamento cheio) e o rascunho não está nele.
    const result = await requeueUnsentCachedProjects({
      owner: OWNER, storage, library: cacheOf([confirmed]), fingerprint: projectCacheFingerprint,
      getPendingOp: async () => null, prepare: async (entry) => ({ entry, assets: new Map() }), queue,
    });
    expect(result).toEqual({ queued: 0, skipped: 2, failed: 0 });
    expect(queue).not.toHaveBeenCalled();
    expect(readUnsentProjectMarker(OWNER, storage)).toBeNull();
  });

  it('operação em revisão ou exclusão já na fila manda: o marcador não passa por cima', async () => {
    for (const kind of ['review_put_deleted', 'review_delete', 'delete', 'review_put_failed']) {
      const storage = memory();
      writeUnsentProjectMarker(markerFor([edited]), storage);
      const queue = vi.fn();
      // eslint-disable-next-line no-await-in-loop
      expect(await requeueUnsentCachedProjects({
        owner: OWNER, storage, library: cacheOf([edited]), fingerprint: projectCacheFingerprint,
        getPendingOp: async () => ({ kind }), prepare: async (entry) => ({ entry, assets: new Map() }), queue,
      })).toEqual({ queued: 0, skipped: 1, failed: 0 });
      expect(queue).not.toHaveBeenCalled();
    }
  });

  it('se a fila local falhar, o marcador fica para a próxima abertura', async () => {
    const storage = memory();
    writeUnsentProjectMarker(markerFor([edited]), storage);
    const result = await requeueUnsentCachedProjects({
      owner: OWNER, storage, library: cacheOf([edited]), fingerprint: projectCacheFingerprint,
      getPendingOp: async () => null, prepare: async (entry) => ({ entry, assets: new Map() }),
      queue: async () => { throw new Error('IndexedDB indisponível'); },
    });
    expect(result).toEqual({ queued: 0, skipped: 0, failed: 1 });
    expect(readUnsentProjectMarker(OWNER, storage).projects.janine.baseVersion).toBe(7);
  });
});
