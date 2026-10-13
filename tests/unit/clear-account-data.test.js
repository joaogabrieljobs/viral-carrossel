import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearAccountLocalData } from '../../src/utils/clear-account-data.js';
import { SK } from '../../src/utils/storage.js';
import { USER_PROFILE_KEY } from '../../src/utils/user-profile.js';
import { PENDING_SHARE_KEY } from '../../src/utils/project-share.js';
import { ACCOUNT_VAULT_KEY } from '../../src/utils/account-vault.js';

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

describe('clearAccountLocalData (FE-001/002/003)', () => {
  let local;
  let session;

  beforeEach(() => {
    local = makeMemoryStorage();
    session = makeMemoryStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', session);
    vi.stubGlobal('indexedDB', undefined);

    local.setItem(SK.library, JSON.stringify([{ id: 'p1' }]));
    local.setItem(SK.aiKeys, JSON.stringify({ openai: 'sk-secret' }));
    local.setItem(SK.brands, JSON.stringify([{ id: 'b1' }]));
    local.setItem(USER_PROFILE_KEY, JSON.stringify({ name: 'Alice' }));
    local.setItem('vc_custom_visual_presets_v1', '[]');
    session.setItem(SK.aiKeys, JSON.stringify({ anthropic: 'sk-ant' }));
    session.setItem(SK.openaiKey, 'sk-legacy');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('remove biblioteca, BYOK, perfil e quaisquer vc_*', async () => {
    await clearAccountLocalData();

    expect(local.getItem(SK.library)).toBeNull();
    expect(local.getItem(SK.aiKeys)).toBeNull();
    expect(local.getItem(SK.brands)).toBeNull();
    expect(local.getItem(USER_PROFILE_KEY)).toBeNull();
    expect(local.getItem('vc_custom_visual_presets_v1')).toBeNull();
    expect(session.getItem(SK.aiKeys)).toBeNull();
    expect(session.getItem(SK.openaiKey)).toBeNull();
  });

  it('nunca lança mesmo sem IndexedDB', async () => {
    await expect(clearAccountLocalData()).resolves.toBeUndefined();
  });

  it('preserva convite ?share= no sessionStorage ao limpar conta', async () => {
    session.setItem(PENDING_SHARE_KEY, 'AB12CD34');
    await clearAccountLocalData();
    expect(session.getItem(PENDING_SHARE_KEY)).toBe('AB12CD34');
    expect(local.getItem(SK.library)).toBeNull();
  });

  it('preserva o cofre por conta (vc_account_vault)', async () => {
    local.setItem(ACCOUNT_VAULT_KEY, JSON.stringify({
      'email:a@x.com': { savedAt: 1, keys: { [SK.library]: '[]' } },
    }));
    local.setItem(SK.library, JSON.stringify([{ id: 'p1' }]));
    await clearAccountLocalData();
    expect(local.getItem(SK.library)).toBeNull();
    expect(local.getItem(ACCOUNT_VAULT_KEY)).toContain('email:a@x.com');
  });
});
