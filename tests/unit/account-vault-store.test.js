import { afterEach, expect, it, vi } from 'vitest';
import { updateDurableVault } from '../../src/utils/account-vault-store.js';

function fakeDatabase() {
  const get = {};
  const transaction = { objectStore: () => ({ get: () => get, put: vi.fn() }), abort: vi.fn() };
  const db = { transaction: vi.fn(() => transaction), close: vi.fn() };
  const request = { result: db };
  vi.stubGlobal('indexedDB', { open: () => request });
  return { get, transaction, db, request };
}
afterEach(() => { vi.unstubAllGlobals(); });

it('confirma apenas oncomplete, nunca o sucesso do pedido de leitura/gravação', async () => {
  const { get, transaction, db, request } = fakeDatabase();
  const done = vi.fn();
  const promise = updateDurableVault((map) => ({ map: { ...map, account: { data: 'new' } }, result: true })).then(done);
  request.onsuccess();
  await Promise.resolve();
  get.result = {};
  get.onsuccess();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  transaction.oncomplete();
  await promise;
  expect(done).toHaveBeenCalledWith(true);
  expect(db.close).toHaveBeenCalled();
  expect(db.transaction).toHaveBeenCalledWith('accounts', 'readwrite');
});

it('rejeita transação abortada sem classificá-la como IDB indisponível', async () => {
  const { get, transaction, request } = fakeDatabase();
  const promise = updateDurableVault((map) => ({ map, result: true }));
  const assertion = expect(promise).rejects.toMatchObject({ message: 'A gravação do cofre local foi interrompida.' });
  request.onsuccess();
  await Promise.resolve();
  get.result = {}; get.onsuccess();
  transaction.onabort();
  await assertion;
});

it('marca abertura indisponível para permitir fallback legado explícito', async () => {
  vi.stubGlobal('indexedDB', undefined);
  await expect(updateDurableVault(() => {})).rejects.toMatchObject({ vaultUnavailable: true });
});
