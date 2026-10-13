import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_VAULT_KEY,
  accountVaultHasProjects,
  restoreAccountVault,
  snapshotAccountVault,
} from '../../src/utils/account-vault.js';
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

describe('account-vault', () => {
  let local;

  beforeEach(() => {
    local = makeMemoryStorage();
    vi.stubGlobal('localStorage', local);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('faz snapshot e restaura biblioteca por owner', () => {
    local.setItem(SK.library, JSON.stringify([{ id: 'p1', name: 'Meu' }]));
    local.setItem(SK.brands, JSON.stringify([{ id: 'b1' }]));
    expect(snapshotAccountVault('email:a@x.com')).toBe(true);
    expect(accountVaultHasProjects('email:a@x.com')).toBe(true);

    local.removeItem(SK.library);
    local.removeItem(SK.brands);
    expect(restoreAccountVault('email:a@x.com')).toBe(true);
    expect(JSON.parse(local.getItem(SK.library))).toEqual([{ id: 'p1', name: 'Meu' }]);
    expect(JSON.parse(local.getItem(SK.brands))).toEqual([{ id: 'b1' }]);
  });

  it('isola slots entre contas', () => {
    local.setItem(SK.library, JSON.stringify([{ id: 'a' }]));
    snapshotAccountVault('email:a@x.com');
    local.setItem(SK.library, JSON.stringify([{ id: 'b' }]));
    snapshotAccountVault('email:b@y.com');

    local.removeItem(SK.library);
    restoreAccountVault('email:a@x.com');
    expect(JSON.parse(local.getItem(SK.library))[0].id).toBe('a');
    restoreAccountVault('email:b@y.com');
    expect(JSON.parse(local.getItem(SK.library))[0].id).toBe('b');
    expect(local.getItem(ACCOUNT_VAULT_KEY)).toContain('email:a@x.com');
  });
});
