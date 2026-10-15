import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let store;
let requests;
let indexedDBMock;

function connection() {
  return {
    close: vi.fn(),
    transaction: vi.fn(() => ({ objectStore: () => ({
      getAllKeys: () => {
        const request = { result: [] };
        Promise.resolve().then(() => request.onsuccess?.());
        return request;
      },
    }) })),
  };
}

function succeed(index, db = connection()) {
  requests[index].result = db;
  requests[index].onsuccess();
  return db;
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  requests = [];
  indexedDBMock = {
    open: vi.fn(() => { const request = {}; requests.push(request); return request; }),
    deleteDatabase: vi.fn(),
  };
  vi.stubGlobal('indexedDB', indexedDBMock);
  store = await import('../../src/utils/image-store.js');
});
afterEach(() => {
  expect(indexedDBMock.deleteDatabase).not.toHaveBeenCalled();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('conexões IndexedDB da biblioteca de imagens', () => {
  it('fecha em versionchange e reabre no próximo uso sem bloquear outra aba', async () => {
    const first = store.imageListIds();
    const db = succeed(0);
    await first;
    await store.imageListIds();
    expect(indexedDBMock.open).toHaveBeenCalledTimes(1);
    db.onversionchange();
    expect(db.close).toHaveBeenCalledOnce();
    const next = store.imageListIds();
    succeed(1);
    await next;
    // Um close atrasado da conexão anterior não invalida a nova.
    db.onclose();
    await store.imageListIds();
    expect(indexedDBMock.open).toHaveBeenCalledTimes(2);
  });

  it('reabre se o navegador fecha a conexão inesperadamente', async () => {
    const first = store.imageListIds();
    const db = succeed(0);
    await first;
    db.onclose();
    const next = store.imageListIds();
    succeed(1);
    await next;
    expect(indexedDBMock.open).toHaveBeenCalledTimes(2);
  });

  it('bloqueio não envenena retries e sucesso atrasado fecha a conexão órfã', async () => {
    const first = store.imageListIds();
    const rejected = expect(first).rejects.toThrow(/outra aba/);
    requests[0].onblocked();
    await rejected;
    const next = store.imageListIds();
    const active = succeed(1);
    await next;
    const late = succeed(0);
    expect(late.close).toHaveBeenCalledOnce();
    await store.imageListIds();
    expect(active.close).not.toHaveBeenCalled();
    expect(indexedDBMock.open).toHaveBeenCalledTimes(2);
  });

  it('timeout fecha sucesso tardio sem substituir a conexão já recuperada', async () => {
    const first = store.imageListIds();
    const rejected = expect(first).rejects.toThrow(/não respondeu/);
    await vi.advanceTimersByTimeAsync(8_000);
    await rejected;
    // Cards seguintes falham rápido; a primeira abertura travada não cria 23
    // novas esperas de 8 segundos durante a restauração.
    await expect(store.imageListIds()).rejects.toThrow(/não respondeu/);
    expect(indexedDBMock.open).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3_000);
    const next = store.imageListIds();
    succeed(1);
    await next;
    const late = succeed(0);
    expect(late.close).toHaveBeenCalledOnce();
    await store.imageListIds();
    expect(indexedDBMock.open).toHaveBeenCalledTimes(2);
  });

  it('não cria um store se o upgrade só chega depois de uma abertura abandonada', async () => {
    const first = store.imageListIds();
    const rejected = expect(first).rejects.toThrow();
    requests[0].onblocked();
    await rejected;
    const abort = vi.fn();
    const createObjectStore = vi.fn();
    requests[0].onupgradeneeded({ target: { transaction: { abort }, result: { createObjectStore } } });
    expect(abort).toHaveBeenCalledOnce();
    expect(createObjectStore).not.toHaveBeenCalled();
  });

  it('uma exceção síncrona ao abrir também permite nova tentativa', async () => {
    indexedDBMock.open.mockImplementationOnce(() => { throw new Error('storage unavailable'); });
    await expect(store.imageListIds()).rejects.toThrow('storage unavailable');
    const next = store.imageListIds();
    succeed(0);
    await next;
    expect(indexedDBMock.open).toHaveBeenCalledTimes(2);
  });

  it('aborta uma gravação cuja transação nunca conclui, liberando a foto para o fallback', async () => {
    const read = {};
    const write = {};
    const transaction = {
      objectStore: () => ({ get: () => read, put: vi.fn(() => write) }),
      abort: vi.fn(),
    };
    const db = { transaction: vi.fn(() => transaction), close: vi.fn() };
    const pending = store.imagePut('foto-1', new Blob(['foto'], { type: 'image/png' }));
    const rejected = expect(pending).rejects.toThrow(/não concluiu a gravação/);
    succeed(0, db);
    await Promise.resolve();
    read.onsuccess();
    // O request terminou, mas o browser nunca emitiu complete nem abort.
    write.onsuccess?.();
    await vi.advanceTimersByTimeAsync(8_000);
    await rejected;
    expect(transaction.abort).toHaveBeenCalledOnce();
    // Eventos tardios não podem converter uma falha em sucesso.
    transaction.oncomplete();
    expect(transaction.abort).toHaveBeenCalledOnce();
  });

  it('cancela o prazo da gravação concluída e não aborta a transação', async () => {
    const read = {};
    const transaction = {
      objectStore: () => ({ get: () => read, put: () => ({}) }),
      abort: vi.fn(),
    };
    const db = { transaction: vi.fn(() => transaction), close: vi.fn() };
    const pending = store.imagePut('foto-2', new Blob(['foto'], { type: 'image/png' }));
    succeed(0, db);
    await Promise.resolve();
    read.onsuccess();
    transaction.oncomplete();
    await expect(pending).resolves.toBe('foto-2');
    await vi.advanceTimersByTimeAsync(8_000);
    expect(transaction.abort).not.toHaveBeenCalled();
  });
});
