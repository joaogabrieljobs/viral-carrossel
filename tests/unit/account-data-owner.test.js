import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DATA_OWNER_KEY,
  ensureAccountDataOwner,
  normalizeDataOwnerId,
  readDataOwner,
  writeDataOwner,
} from '../../src/utils/account-data-owner.js';
import { SK } from '../../src/utils/storage.js';

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
    vi.unstubAllGlobals();
  });

  it('normaliza email e prefere customerId', () => {
    expect(normalizeDataOwnerId('A@B.com')).toBe('email:a@b.com');
    expect(normalizeDataOwnerId('a@b.com', 'cus_1')).toBe('id:cus_1');
  });

  it('na 1ª visita com cookie só grava o dono (não apaga biblioteca)', async () => {
    local.setItem(SK.library, JSON.stringify([{ id: 'p1' }]));
    const result = await ensureAccountDataOwner(
      { active: true, email: 'a@x.com' },
      { explicitLogin: false },
    );
    expect(result).toBe('ok');
    expect(readDataOwner()).toBe('email:a@x.com');
    expect(JSON.parse(local.getItem(SK.library))).toHaveLength(1);
    expect(globalThis.location.replace).not.toHaveBeenCalled();
  });

  it('ao mudar de conta limpa biblioteca e recarrega', async () => {
    writeDataOwner('email:a@x.com');
    local.setItem(SK.library, JSON.stringify([{ id: 'secret-a' }]));
    local.setItem(SK.brands, JSON.stringify([{ id: 'brand-a' }]));

    const result = await ensureAccountDataOwner(
      { active: true, email: 'b@y.com' },
      { explicitLogin: false },
    );

    expect(result).toBe('reloading');
    expect(local.getItem(SK.library)).toBeNull();
    expect(local.getItem(SK.brands)).toBeNull();
    expect(readDataOwner()).toBe('email:b@y.com');
    expect(globalThis.location.replace).toHaveBeenCalled();
  });

  it('login explícito sem dono + biblioteca ocupada isola (limpa)', async () => {
    local.setItem(SK.library, JSON.stringify([{ id: 'orphan' }]));
    const result = await ensureAccountDataOwner(
      { active: true, email: 'novo@z.com' },
      { explicitLogin: true },
    );
    expect(result).toBe('reloading');
    expect(local.getItem(SK.library)).toBeNull();
    expect(readDataOwner()).toBe('email:novo@z.com');
  });

  it('exporta a mesma chave que o clear remove', () => {
    expect(DATA_OWNER_KEY).toBe('vc_data_owner');
    expect(SK.dataOwner).toBe(DATA_OWNER_KEY);
  });
});
