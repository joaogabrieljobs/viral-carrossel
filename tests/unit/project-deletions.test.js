import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { SK, lockOtherAccountTabs, unlockAccountDataWrites } from '../../src/utils/storage.js';
import { readDeletedProjectIds, rememberDeletedProjectIds, PROJECT_DELETIONS_FALLBACK_KEY } from '../../src/utils/project-deletions.js';

function storage() {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key) };
}

describe('exclusões duráveis por conta', () => {
  let local;
  beforeEach(() => {
    local = storage();
    local.setItem(SK.dataOwner, 'email:janine@example.test');
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', storage());
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('não esquece exclusões antigas quando a conta ultrapassa 500 IDs', () => {
    rememberDeletedProjectIds(Array.from({ length: 501 }, (_, i) => `apagado-${i}`));
    rememberDeletedProjectIds(['ultimo', 'apagado-0']);
    expect(readDeletedProjectIds()).toHaveLength(502);
    expect(readDeletedProjectIds()).toContain('ultimo');
    expect(readDeletedProjectIds()).toContain('apagado-0');
  });

  it('mantém a intenção na sessão quando localStorage está cheio, inclusive depois de reabrir o módulo', async () => {
    const original = local.setItem;
    local.setItem = (key, value) => {
      if (key === SK.libraryDeletedIds) throw new DOMException('quota', 'QuotaExceededError');
      original(key, value);
    };
    rememberDeletedProjectIds(['rascunho-antigo']);
    expect(local.getItem(SK.libraryDeletedIds)).toBeNull();
    vi.resetModules();
    const fresh = await import('../../src/utils/project-deletions.js');
    expect(fresh.readDeletedProjectIds()).toEqual(['rascunho-antigo']);
  });

  it('outra conta não herda exclusões da sessão ou da memória', () => {
    rememberDeletedProjectIds(['id-compartilhado']);
    local.removeItem(SK.libraryDeletedIds);
    local.setItem(SK.dataOwner, 'email:outra@example.test');
    expect(readDeletedProjectIds()).toEqual([]);
    local.setItem(SK.dataOwner, 'email:janine@example.test');
    expect(readDeletedProjectIds()).toEqual(['id-compartilhado']);
  });

  it('uma aba antiga sobrescrevendo localStorage não apaga exclusões já conhecidas', () => {
    rememberDeletedProjectIds(['a']);
    local.setItem(SK.libraryDeletedIds, '["b"]');
    expect(rememberDeletedProjectIds(['c'])).toEqual(['a', 'b', 'c']);
  });

  it('memória preserva exclusão para o snapshot quando os dois storages recusam escrita', () => {
    vi.spyOn(local, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => { throw new Error('indisponível'); });
    rememberDeletedProjectIds(['excluido']);
    expect(sessionStorage.getItem(PROJECT_DELETIONS_FALLBACK_KEY)).toBeNull();
    expect(readDeletedProjectIds()).toEqual(['excluido']);
  });

  it('aba antiga de A não grava um tombstone no espaço da conta B', () => {
    expect(rememberDeletedProjectIds(['rascunho-a'])).toEqual(['rascunho-a']);
    const previousFallback = sessionStorage.getItem(PROJECT_DELETIONS_FALLBACK_KEY);
    local.setItem(SK.dataOwner, 'email:b@example.test');
    local.setItem(SK.libraryDeletedIds, '["b-existente"]');

    expect(rememberDeletedProjectIds(['id-compartilhado'])).toBeNull();
    expect(local.getItem(SK.libraryDeletedIds)).toBe('["b-existente"]');
    expect(sessionStorage.getItem(PROJECT_DELETIONS_FALLBACK_KEY)).toBe(previousFallback);
    expect(readDeletedProjectIds()).toEqual(['b-existente']);
  });

  it('aba impedida por lease alheio não registra exclusão em fallback', async () => {
    expect(lockOtherAccountTabs()).toBe(true);
    const originalSession = sessionStorage;
    const duplicateSession = storage();
    duplicateSession.setItem('vc_account_write_lock_token', originalSession.getItem('vc_account_write_lock_token'));
    vi.stubGlobal('sessionStorage', duplicateSession);
    vi.stubGlobal('performance', { getEntriesByType: () => [{ type: 'navigate' }] });
    vi.resetModules();
    const duplicate = await import('../../src/utils/project-deletions.js');

    expect(duplicate.rememberDeletedProjectIds(['do-clone'])).toBeNull();
    expect(local.getItem(SK.libraryDeletedIds)).toBeNull();
    expect(duplicateSession.getItem(PROJECT_DELETIONS_FALLBACK_KEY)).toBeNull();
    vi.stubGlobal('sessionStorage', originalSession);
    unlockAccountDataWrites();
  });
});
