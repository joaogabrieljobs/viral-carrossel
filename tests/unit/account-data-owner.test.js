import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DATA_OWNER_KEY,
  ensureAccountDataOwner,
  isSameDataOwner,
  normalizeDataOwnerId,
  readDataOwner,
  writeDataOwner,
} from '../../src/utils/account-data-owner.js';
import { SK, areAccountDataWritesLocked, lsSet, unlockAccountDataWrites } from '../../src/utils/storage.js';
import { ACCOUNT_VAULT_KEY, snapshotAccountVault } from '../../src/utils/account-vault.js';

function makeMemoryStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key(i) { return [...map.keys()][i] ?? null; },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    removeItem(k) { map.delete(k); },
    clear() { map.clear(); },
  };
}

describe('account-data-owner', () => {
  let local;

  beforeEach(() => {
    unlockAccountDataWrites();
    local = makeMemoryStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', makeMemoryStorage());
    vi.stubGlobal('indexedDB', undefined);
    const loc = {
      href: 'https://viralcarrossel.com.br/',
      assign: vi.fn(),
      replace: vi.fn(),
    };
    vi.stubGlobal('location', loc);
    globalThis.location = loc;
  });

  afterEach(() => {
    unlockAccountDataWrites();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('normaliza preferindo email (estável)', () => {
    expect(normalizeDataOwnerId('A@B.com')).toBe('email:a@b.com');
    expect(normalizeDataOwnerId('a@b.com', 'cus_1')).toBe('email:a@b.com');
    expect(normalizeDataOwnerId('', 'cus_1')).toBe('id:cus_1');
  });

  it('reconhece id:cus e email: da mesma sessão como o mesmo dono', () => {
    expect(isSameDataOwner('id:cus_1', 'email:a@x.com', {
      email: 'a@x.com',
      customerId: 'cus_1',
    })).toBe(true);
  });

  it('na 1ª visita com cookie só grava o dono (não apaga biblioteca)', async () => {
    local.setItem(SK.library, JSON.stringify([{ id: 'p1' }]));
    const result = await ensureAccountDataOwner(
      { active: true, email: 'a@x.com', customerId: 'cus_1' },
      { explicitLogin: false },
    );
    expect(result).toBe('ok');
    expect(readDataOwner()).toBe('email:a@x.com');
    expect(JSON.parse(local.getItem(SK.library))).toHaveLength(1);
    expect(globalThis.location.replace).not.toHaveBeenCalled();
  });

  it('login explícito restaura cofre da conta e recarrega', async () => {
    local.setItem(SK.library, JSON.stringify([{ id: 'meus' }]));
    snapshotAccountVault('email:novo@z.com');
    local.setItem(SK.library, JSON.stringify([{ id: 'orfao' }]));

    const result = await ensureAccountDataOwner(
      { active: true, email: 'novo@z.com' },
      { explicitLogin: true },
    );
    expect(result).toBe('reloading');
    expect(JSON.parse(local.getItem(SK.library))[0].id).toBe('meus');
    expect(readDataOwner()).toBe('email:novo@z.com');
    expect(globalThis.location.replace).toHaveBeenCalled();
    expect(local.getItem(ACCOUNT_VAULT_KEY)).toBeTruthy();
    expect(areAccountDataWritesLocked()).toBe(true);
    expect(lsSet(SK.library, [{ id: 'orfao' }])).toBe(false);
    expect(JSON.parse(local.getItem(SK.library))[0].id).toBe('meus');
  });

  it('ao mudar de conta guarda A no cofre e restaura B', async () => {
    writeDataOwner('email:a@x.com');
    local.setItem(SK.library, JSON.stringify([{ id: 'secret-a' }]));
    local.setItem(SK.brands, JSON.stringify([{ id: 'brand-a' }]));
    snapshotAccountVault('email:b@y.com');
    local.setItem(SK.library, JSON.stringify([{ id: 'secret-a' }]));

    // Slot B já tem projeto
    const map = JSON.parse(local.getItem(ACCOUNT_VAULT_KEY));
    map['email:b@y.com'] = {
      savedAt: Date.now(),
      keys: { [SK.library]: JSON.stringify([{ id: 'proj-b' }]) },
    };
    local.setItem(ACCOUNT_VAULT_KEY, JSON.stringify(map));

    const result = await ensureAccountDataOwner(
      { active: true, email: 'b@y.com' },
      { explicitLogin: false },
    );

    expect(result).toBe('reloading');
    expect(JSON.parse(local.getItem(SK.library))[0].id).toBe('proj-b');
    expect(readDataOwner()).toBe('email:b@y.com');
    // Cofre de A preservado
    const vault = JSON.parse(local.getItem(ACCOUNT_VAULT_KEY));
    expect(JSON.parse(vault['email:a@x.com'].keys[SK.library])[0].id).toBe('secret-a');
    expect(areAccountDataWritesLocked()).toBe(true);
    expect(lsSet(SK.library, [{ id: 'secret-a' }])).toBe(false);
    expect(JSON.parse(local.getItem(SK.library))[0].id).toBe('proj-b');
  });

  it('mesma conta com biblioteca vazia restaura do cofre e recarrega', async () => {
    writeDataOwner('email:a@x.com');
    local.setItem(SK.library, JSON.stringify([{ id: 'p1' }]));
    snapshotAccountVault('email:a@x.com');
    local.removeItem(SK.library);

    const result = await ensureAccountDataOwner(
      { active: true, email: 'a@x.com' },
      { explicitLogin: false },
    );
    expect(result).toBe('reloading');
    expect(JSON.parse(local.getItem(SK.library))[0].id).toBe('p1');
    expect(globalThis.location.replace).toHaveBeenCalled();
    expect(areAccountDataWritesLocked()).toBe(true);
    expect(lsSet(SK.library, [])).toBe(false);
    expect(JSON.parse(local.getItem(SK.library))[0].id).toBe('p1');
  });

  it('bloqueia troca de conta se o cofre não consegue preservar os projetos atuais', async () => {
    writeDataOwner('email:a@x.com');
    const libraryA = JSON.stringify([{ id: 'secret-a', name: 'Edição atual de A' }]);
    const brandsA = JSON.stringify([{ id: 'brand-a' }]);
    const vaultBefore = JSON.stringify({
      'email:b@y.com': { savedAt: 1, keys: {
        [SK.library]: JSON.stringify([{ id: 'proj-b' }]),
        [SK.brands]: JSON.stringify([{ id: 'brand-b' }]),
      } },
    });
    local.setItem(SK.library, libraryA);
    local.setItem(SK.brands, brandsA);
    local.setItem(ACCOUNT_VAULT_KEY, vaultBefore);
    const setItem = local.setItem.bind(local);
    const write = vi.spyOn(local, 'setItem').mockImplementation((key, value) => {
      if (key === ACCOUNT_VAULT_KEY) throw new DOMException('full', 'QuotaExceededError');
      setItem(key, value);
    });
    const remove = vi.spyOn(local, 'removeItem');
    const removeSession = vi.spyOn(globalThis.sessionStorage, 'removeItem');

    expect(await ensureAccountDataOwner({ active: true, email: 'b@y.com' })).toBe('blocked');
    expect(readDataOwner()).toBe('email:a@x.com');
    expect(local.getItem(SK.library)).toBe(libraryA);
    expect(local.getItem(SK.brands)).toBe(brandsA);
    expect(local.getItem(ACCOUNT_VAULT_KEY)).toBe(vaultBefore);
    expect(remove).not.toHaveBeenCalled();
    expect(removeSession).not.toHaveBeenCalled();
    expect(write.mock.calls.map(([key]) => key)).toEqual([ACCOUNT_VAULT_KEY]);
    expect(globalThis.location.replace).not.toHaveBeenCalled();
    expect(areAccountDataWritesLocked()).toBe(true);
    expect(lsSet(SK.library, [{ id: 'proj-b' }])).toBe(false);
    expect(local.getItem(SK.library)).toBe(libraryA);
  });

  it('boot com cookie restaura cofre sem dono activo e bloqueia persistência antiga', async () => {
    local.setItem(SK.library, JSON.stringify([{ id: 'p1' }, { id: 'p2' }]));
    snapshotAccountVault('email:a@x.com');
    local.removeItem(SK.library);

    expect(await ensureAccountDataOwner({ active: true, email: 'a@x.com' })).toBe('reloading');
    expect(areAccountDataWritesLocked()).toBe(true);
    expect(lsSet(SK.library, [])).toBe(false);
    expect(JSON.parse(local.getItem(SK.library)).map((entry) => entry.id)).toEqual(['p1', 'p2']);
  });

  it('migra id:cus → email: sem limpar dados', async () => {
    writeDataOwner('id:cus_1');
    local.setItem(SK.library, JSON.stringify([{ id: 'p1' }]));
    const result = await ensureAccountDataOwner(
      { active: true, email: 'a@x.com', customerId: 'cus_1' },
    );
    expect(result).toBe('ok');
    expect(readDataOwner()).toBe('email:a@x.com');
    expect(JSON.parse(local.getItem(SK.library))).toHaveLength(1);
    expect(globalThis.location.replace).not.toHaveBeenCalled();
  });

  it('exporta a mesma chave que o clear remove', () => {
    expect(DATA_OWNER_KEY).toBe('vc_data_owner');
    expect(SK.dataOwner).toBe(DATA_OWNER_KEY);
  });
});
