import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SK,
  areAccountDataWritesLocked,
  bindAccountDataWriteOwner,
  lockAccountDataWrites,
  lockOtherAccountTabs,
  lsSet,
  unlockAccountDataWrites,
} from '../../src/utils/storage.js';

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

describe('cadeado de escrita entre abas', () => {
  let local;
  let session;

  beforeEach(() => {
    unlockAccountDataWrites();
    local = makeMemoryStorage();
    session = makeMemoryStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', session);
  });

  afterEach(() => {
    unlockAccountDataWrites();
    vi.unstubAllGlobals();
  });

  it('outra aba não grava por cima enquanto o cadeado desta aba está válido', () => {
    expect(lockOtherAccountTabs()).toBe(true);
    const foreign = makeMemoryStorage();
    foreign.setItem('vc_account_write_lock_token', 'aba-b');
    vi.stubGlobal('sessionStorage', foreign);
    expect(areAccountDataWritesLocked()).toBe(true);
    expect(lsSet(SK.library, [{ id: 'da-outra-aba' }])).toBe(false);
    expect(local.getItem(SK.library)).toBeNull();
  });

  it('a aba que travou volta a gravar depois de soltar a trava em memória', () => {
    lockAccountDataWrites();
    unlockAccountDataWrites();
    expect(areAccountDataWritesLocked()).toBe(false);
    expect(lsSet(SK.library, [{ id: 'ok' }])).toBe(true);
  });

  it('libera a outra aba assim que o pull termina, sem aguardar o TTL', () => {
    expect(lockOtherAccountTabs()).toBe(true);
    const foreign = makeMemoryStorage();
    foreign.setItem('vc_account_write_lock_token', 'aba-b');
    vi.stubGlobal('sessionStorage', foreign);
    expect(lsSet(SK.library, [{ id: 'durante-pull' }])).toBe(false);
    vi.stubGlobal('sessionStorage', session);
    unlockAccountDataWrites();
    vi.stubGlobal('sessionStorage', foreign);
    expect(local.getItem('vc_account_write_lock')).toBeNull();
    expect(lsSet(SK.library, [{ id: 'depois-pull' }])).toBe(true);
  });

  it('avisa somente quando outra aba bloqueia a gravação', () => {
    const events = [];
    vi.stubGlobal('window', { dispatchEvent: (event) => events.push(event) });
    lockAccountDataWrites();
    expect(lsSet(SK.library, [{ id: 'bloqueado-pela-propria-aba' }])).toBe(false);
    expect(events).toHaveLength(0);
    unlockAccountDataWrites();

    expect(lockOtherAccountTabs()).toBe(true);
    const foreign = makeMemoryStorage();
    foreign.setItem('vc_account_write_lock_token', 'aba-b');
    vi.stubGlobal('sessionStorage', foreign);
    expect(lsSet(SK.library, [{ id: 'bloqueado-por-outra-aba' }])).toBe(false);
    expect(events.at(-1)?.type).toBe('vc:account-write-blocked');
    expect(events.at(-1)?.detail).toEqual({ key: SK.library });
  });

  it('aba antiga continua impedida de gravar a conta nova depois que o lease expira', async () => {
    local.setItem(SK.dataOwner, JSON.stringify('email:a@x.com'));
    bindAccountDataWriteOwner('email:a@x.com');
    local.setItem(SK.dataOwner, JSON.stringify('email:b@y.com'));
    expect(lsSet(SK.library, [{ id: 'estado-stale-de-a' }])).toBe(false);

    // O novo boot de B tem outro módulo JS, com identidade própria.
    vi.resetModules();
    const freshTab = await import('../../src/utils/storage.js');
    expect(freshTab.lsSet(SK.library, [{ id: 'projeto-b' }])).toBe(true);
    expect(JSON.parse(local.getItem(SK.library))).toEqual([{ id: 'projeto-b' }]);
    expect(lsSet(SK.library, [{ id: 'estado-stale-de-a' }])).toBe(false);
    expect(JSON.parse(local.getItem(SK.library))).toEqual([{ id: 'projeto-b' }]);
  });

  it('aba duplicada não herda o lease copiado junto com sessionStorage', async () => {
    expect(lockOtherAccountTabs()).toBe(true);
    const inherited = session.getItem('vc_account_write_lock_token');
    const duplicateSession = makeMemoryStorage();
    duplicateSession.setItem('vc_account_write_lock_token', inherited);
    vi.stubGlobal('sessionStorage', duplicateSession);
    vi.stubGlobal('performance', { getEntriesByType: () => [{ type: 'navigate' }] });
    vi.resetModules();
    const duplicate = await import('../../src/utils/storage.js');

    expect(duplicate.areAccountDataWritesLocked()).toBe(true);
    expect(duplicateSession.getItem('vc_account_write_lock_token')).not.toBe(inherited);
    duplicate.unlockAccountDataWrites();
    expect(JSON.parse(local.getItem('vc_account_write_lock')).token).toBe(inherited);
    expect(duplicate.lsSet(SK.library, [{ id: 'clonado' }])).toBe(false);
  });

  it('mesmo um clone que declara reload recebe a resposta da aba original', async () => {
    const channels = new Set();
    class FakeBroadcastChannel {
      constructor() { channels.add(this); }
      postMessage(data) {
        for (const channel of channels) {
          if (channel !== this) queueMicrotask(() => channel.onmessage?.({ data }));
        }
      }
    }
    vi.stubGlobal('window', { BroadcastChannel: FakeBroadcastChannel });
    vi.stubGlobal('performance', { getEntriesByType: () => [{ type: 'reload' }] });
    expect(lockOtherAccountTabs()).toBe(true);
    const inherited = session.getItem('vc_account_write_lock_token');
    const duplicateSession = makeMemoryStorage();
    duplicateSession.setItem('vc_account_write_lock_token', inherited);
    vi.stubGlobal('sessionStorage', duplicateSession);
    vi.resetModules();
    const duplicate = await import('../../src/utils/storage.js');

    expect(duplicate.areAccountDataWritesLocked()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(duplicate.areAccountDataWritesLocked()).toBe(true);
    duplicate.unlockAccountDataWrites();
    expect(JSON.parse(local.getItem('vc_account_write_lock')).token).toBe(inherited);
  });

  it('reload da própria aba libera o lease depois de confirmar que não há outra dona', async () => {
    const channels = new Set();
    class FakeBroadcastChannel {
      constructor() { channels.add(this); }
      postMessage() { /* nenhuma aba original responde após o reload */ }
    }
    vi.stubGlobal('window', { BroadcastChannel: FakeBroadcastChannel });
    vi.stubGlobal('performance', { getEntriesByType: () => [{ type: 'reload' }] });
    expect(lockOtherAccountTabs()).toBe(true);
    vi.resetModules();
    const reloaded = await import('../../src/utils/storage.js');

    expect(reloaded.areAccountDataWritesLocked()).toBe(true);
    reloaded.unlockAccountDataWrites();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(local.getItem('vc_account_write_lock')).toBeNull();
    expect(reloaded.areAccountDataWritesLocked()).toBe(false);
  });

  it('redirect de login retoma o lease da própria aba após o probe', async () => {
    class FakeBroadcastChannel {
      postMessage() { /* o documento anterior já saiu */ }
    }
    vi.stubGlobal('window', { BroadcastChannel: FakeBroadcastChannel });
    vi.stubGlobal('performance', { getEntriesByType: () => [{ type: 'navigate' }] });
    vi.resetModules();
    const original = await import('../../src/utils/storage.js');
    original.lockAccountDataWrites();
    const inherited = session.getItem('vc_account_write_lock_token');
    expect(JSON.parse(local.getItem('vc_account_write_lock')).transfer).toBe(true);
    // Limpeza/login na mesma aba mantém ou recompõe o token antes do redirect.
    session.removeItem('vc_account_write_lock_token');
    original.lockAccountDataWrites();
    expect(session.getItem('vc_account_write_lock_token')).toBe(inherited);

    vi.resetModules();
    const redirected = await import('../../src/utils/storage.js');
    const settled = redirected.waitForAccountWriteLockProbe();
    expect(redirected.areAccountDataWritesLocked()).toBe(true);
    redirected.unlockAccountDataWrites();
    await settled;
    expect(local.getItem('vc_account_write_lock')).toBeNull();
    expect(redirected.lsSet(SK.library, [{ id: 'restaurado' }])).toBe(true);
  });

  it('aba duplicada durante o redirect não rouba um lease transferível', async () => {
    const channels = new Set();
    class FakeBroadcastChannel {
      constructor() { channels.add(this); }
      postMessage(data) {
        for (const channel of channels) {
          if (channel !== this) queueMicrotask(() => channel.onmessage?.({ data }));
        }
      }
    }
    vi.stubGlobal('window', { BroadcastChannel: FakeBroadcastChannel });
    vi.stubGlobal('performance', { getEntriesByType: () => [{ type: 'navigate' }] });
    vi.resetModules();
    const original = await import('../../src/utils/storage.js');
    original.lockAccountDataWrites();
    const inherited = session.getItem('vc_account_write_lock_token');
    const duplicateSession = makeMemoryStorage();
    duplicateSession.setItem('vc_account_write_lock_token', inherited);
    vi.stubGlobal('sessionStorage', duplicateSession);
    vi.resetModules();
    const duplicate = await import('../../src/utils/storage.js');

    expect(duplicate.areAccountDataWritesLocked()).toBe(true);
    await duplicate.waitForAccountWriteLockProbe();
    duplicate.unlockAccountDataWrites();
    expect(duplicate.areAccountDataWritesLocked()).toBe(true);
    expect(JSON.parse(local.getItem('vc_account_write_lock')).token).toBe(inherited);
    expect(duplicateSession.getItem('vc_account_write_lock_token')).not.toBe(inherited);
    vi.stubGlobal('sessionStorage', session);
    original.unlockAccountDataWrites();
  });
});
