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
});
