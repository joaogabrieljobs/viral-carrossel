import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DATA_OWNER_KEY,
  ensureAccountDataOwner,
  isSameDataOwner,
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

  it('login explícito sem dono COM biblioteca órfã limpa (anti-mistura entre contas)', async () => {
    local.setItem(SK.library, JSON.stringify([{ id: 'orphan' }]));
    const result = await ensureAccountDataOwner(
      { active: true, email: 'novo@z.com' },
      { explicitLogin: true },
    );
    expect(result).toBe('reloading');
    expect(local.getItem(SK.library)).toBeNull();
    expect(readDataOwner()).toBe('email:novo@z.com');
    expect(globalThis.location.replace).toHaveBeenCalled();
  });

  it('boot silencioso sem dono reclama biblioteca sem apagar (migração)', async () => {
    local.setItem(SK.library, JSON.stringify([{ id: 'legado' }]));
    const result = await ensureAccountDataOwner(
      { active: true, email: 'legado@z.com' },
      { explicitLogin: false },
    );
    expect(result).toBe('ok');
    expect(JSON.parse(local.getItem(SK.library))).toHaveLength(1);
    expect(readDataOwner()).toBe('email:legado@z.com');
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
