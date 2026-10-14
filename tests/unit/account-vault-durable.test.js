import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ update: vi.fn(), imageGet: vi.fn(), imagePut: vi.fn(), fetch: vi.fn() }));
vi.mock('../../src/utils/account-vault-store.js', () => ({ updateDurableVault: mocks.update }));
vi.mock('../../src/utils/image-store.js', async (importOriginal) => ({
  ...await importOriginal(), imageGet: mocks.imageGet, imagePut: mocks.imagePut,
  blobParaDataUrl: async (blob) => `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`,
}));
import { ACCOUNT_VAULT_KEY, snapshotAccountVaultForOwners, restoreAccountVault,
  accountVaultHasProjects, getAccountVaultImageIds } from '../../src/utils/account-vault.js';
import { SK } from '../../src/utils/storage.js';

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key) };
}
const slot = (library, savedAt = 1) => ({ savedAt, keys: { [SK.library]: JSON.stringify(library) } });

describe('cofre durável com cache cheio', () => {
  let local;
  let database;
  beforeEach(() => {
    database = {};
    local = memoryStorage();
    vi.stubGlobal('localStorage', local);
    mocks.update.mockImplementation(async (change) => {
      const next = change(structuredClone(database));
      if (next.map) database = structuredClone(next.map);
      return next.result;
    });
    mocks.imageGet.mockResolvedValue(null);
    mocks.imagePut.mockResolvedValue('ok');
  });
  afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

  it('preserva a edição React na quota sem confirmar a versão stale do cache', async () => {
    local.setItem(SK.library, '[{"id":"p1","name":"Antigo"}]');
    vi.spyOn(local, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    const snapshot = { library: [{ id: 'p1', name: 'Atual', doc: { slides: [{ subtitle: 'Linha 1\nLinha 2' }] } }],
      brandRoster: [{ id: 'marca' }], libraryFolders: [{ id: 'pasta' }], activeDocId: 'p1', activeBrandId: 'marca' };
    expect(await snapshotAccountVaultForOwners(['email:a@x.com', 'id:cus_1'], { snapshot })).toBe(true);
    expect(JSON.parse(database['email:a@x.com'].keys[SK.library])).toEqual(snapshot.library);
    expect(database['id:cus_1']).toEqual({ aliasOf: 'email:a@x.com' });
    expect(local.getItem(SK.library)).toContain('Antigo');
    expect(local.setItem).not.toHaveBeenCalled();
  });

  it('migra todas as contas e aliases antes de liberar o espaço legado', async () => {
    local.setItem(ACCOUNT_VAULT_KEY, JSON.stringify({
      'email:a@x.com': slot([{ id: 'a' }]), 'id:cus_1': { aliasOf: 'email:a@x.com' },
      'email:b@x.com': slot([{ id: 'b' }]),
    }));
    expect(await accountVaultHasProjects('email:a@x.com')).toBe(true);
    expect(database['email:b@x.com'].keys[SK.library]).toContain('"b"');
    expect(database['id:cus_1']).toEqual({ aliasOf: 'email:a@x.com' });
    expect(local.getItem(ACCOUNT_VAULT_KEY)).toBeNull();
  });

  it('uma transação abortada não remove o legado nem confirma proteção', async () => {
    const legacy = JSON.stringify({ 'email:b@x.com': slot([{ id: 'b' }]) });
    local.setItem(ACCOUNT_VAULT_KEY, legacy);
    mocks.update.mockRejectedValue(new Error('Transaction aborted'));
    expect(await snapshotAccountVaultForOwners(['email:a@x.com'], { snapshot: { library: [{ id: 'a' }] } })).toBe(false);
    expect(local.getItem(ACCOUNT_VAULT_KEY)).toBe(legacy);
    expect(database).toEqual({});
  });

  it('não apaga alterações de outra aba no cofre legado durante a migração', async () => {
    local.setItem(ACCOUNT_VAULT_KEY, JSON.stringify({ 'email:a@x.com': slot([{ id: 'a' }]) }));
    const updated = JSON.stringify({ 'email:b@x.com': slot([{ id: 'b' }]) });
    mocks.update.mockImplementation(async (change) => {
      const next = change(database); database = next.map;
      local.setItem(ACCOUNT_VAULT_KEY, updated);
      return next.result;
    });
    expect(await accountVaultHasProjects('email:a@x.com')).toBe(true);
    expect(local.getItem(ACCOUNT_VAULT_KEY)).toBe(updated);
  });

  it('uma migração com conflito conserva os dois conteúdos e imagens', async () => {
    database = { 'email:a@x.com': slot([{ id: 'a', doc: { slides: [{ bgImageId: 'new' }] } }], 20) };
    local.setItem(ACCOUNT_VAULT_KEY, JSON.stringify({
      'email:a@x.com': slot([{ id: 'b', doc: { slides: [{ bgImageId: 'old' }] } }], 10),
    }));
    expect([...await getAccountVaultImageIds()].sort()).toEqual(['new', 'old']);
    expect(Object.keys(database)).toHaveLength(2);
    expect(JSON.parse(database['email:a@x.com'].keys[SK.library]).map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('não perde outro owner em snapshots concorrentes', async () => {
    await Promise.all([
      snapshotAccountVaultForOwners(['email:a@x.com'], { snapshot: { library: [{ id: 'a' }] } }),
      snapshotAccountVaultForOwners(['email:b@x.com'], { snapshot: { library: [{ id: 'b' }] } }),
    ]);
    expect(await accountVaultHasProjects('email:a@x.com')).toBe(true);
    expect(await accountVaultHasProjects('email:b@x.com')).toBe(true);
  });

  it('guarda imagem inline no image-store antes de limpar os bytes do documento', async () => {
    const image = 'data:image/png;base64,AQIDBA==';
    expect(await snapshotAccountVaultForOwners(['email:a@x.com'], {
      snapshot: { library: [{ id: 'a', doc: { slides: [{ refImage: image, refImageId: 'old-id' }] } }] },
    })).toBe(true);
    expect(mocks.imagePut).toHaveBeenCalledTimes(1);
    const savedSlide = JSON.parse(database['email:a@x.com'].keys[SK.library])[0].doc.slides[0];
    expect(savedSlide.refImage).toBeUndefined();
    expect(savedSlide.refImageId).not.toBe('old-id');
    const blob = mocks.imagePut.mock.calls[0][1];
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3, 4]);
  });

  it('mantém bytes inline no cofre se image-store falhar e os externa no restore', async () => {
    const image = 'data:image/png;base64,AQIDBA==';
    mocks.imagePut.mockRejectedValue(new Error('Image database unavailable'));
    expect(await snapshotAccountVaultForOwners(['email:a@x.com'], {
      snapshot: { library: [{ id: 'a', doc: { slides: [{ bgImage: image }] } }] },
    })).toBe(true);
    expect(database['email:a@x.com'].keys[SK.library]).toContain(image);
    mocks.imagePut.mockResolvedValue('ok');
    expect(await restoreAccountVault('email:a@x.com')).toBe(true);
    const restoredSlide = JSON.parse(local.getItem(SK.library))[0].doc.slides[0];
    expect(restoredSlide.bgImage).toBeUndefined();
    expect(restoredSlide.bgImageId).toBeTruthy();
    expect(database['email:a@x.com'].keys[SK.library]).toContain(image); // backup intacto
  });

  it('captura blob órfão antes de confirmar e nunca salva um URL efêmero', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob([new Uint8Array([1, 2])], { type: 'image/png' }) })));
    mocks.imagePut.mockRejectedValue(new Error('Image database unavailable'));
    expect(await snapshotAccountVaultForOwners(['email:a@x.com'], {
      snapshot: { library: [{ id: 'a', doc: { slides: [{ logoImage: 'blob:current-tab', logoImageId: 'missing' }] } }] },
    })).toBe(true);
    const saved = JSON.parse(database['email:a@x.com'].keys[SK.library])[0].doc.slides[0];
    expect(saved.logoImage).toBe('data:image/png;base64,AQI=');
    expect(saved.logoImageId).toBeUndefined();
  });

  it('não confirma proteção quando o único blob não pôde ser lido', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Blob revoked'); }));
    expect(await snapshotAccountVaultForOwners(['email:a@x.com'], {
      snapshot: { library: [{ id: 'a', doc: { slides: [{ bgImage: 'blob:missing' }] } }] },
    })).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('une snapshot explícito de 1 projeto e 23 cards ao cofre com 11 projetos', async () => {
    const old = Array.from({ length: 11 }, (_, index) => ({ id: `p${index}`, name: `Antes ${index}` }));
    database = { 'email:a@x.com': slot(old) };
    const current = { id: 'p0', name: 'Edição de agora', doc: { slides: Array.from({ length: 23 }, (_, index) => ({ id: `slide-${index}` })) } };
    expect(await snapshotAccountVaultForOwners(['email:a@x.com'], { snapshot: { library: [current] } })).toBe(true);
    const restored = JSON.parse(database['email:a@x.com'].keys[SK.library]);
    expect(restored).toHaveLength(11);
    expect(restored[0]).toEqual(current);
    expect(restored[10].id).toBe('p10');
  });

  it('aplica exclusões explícitas na união sem trazer projeto apagado de volta', async () => {
    database = { 'email:a@x.com': slot([{ id: 'a' }, { id: 'apagado' }, { id: 'outro' }]) };
    local.setItem(SK.libraryDeletedIds, '["apagado"]');
    expect(await snapshotAccountVaultForOwners(['email:a@x.com'], { snapshot: { library: [{ id: 'a', name: 'Atual' }] } })).toBe(true);
    expect(JSON.parse(database['email:a@x.com'].keys[SK.library])).toEqual([{ id: 'a', name: 'Atual' }, { id: 'outro' }]);
  });

  it('fontes personalizadas continuam embutidas e não viram IDs de imagens', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob([new Uint8Array([1, 2])], { type: 'font/woff2' }) })));
    const customTitleFont = { name: 'Minha fonte', dataUrl: 'blob:font' };
    expect(await snapshotAccountVaultForOwners(['email:a@x.com'], { snapshot: {
      library: [{ id: 'a', doc: { customTitleFont } }],
    } })).toBe(true);
    expect(mocks.imagePut).not.toHaveBeenCalled();
    expect(JSON.parse(database['email:a@x.com'].keys[SK.library])[0].doc.customTitleFont)
      .toEqual({ name: 'Minha fonte', dataUrl: 'data:font/woff2;base64,AQI=' });
  });

  it('falha de leitura do cofre durável aborta a coleta de imagens órfãs', async () => {
    vi.stubGlobal('indexedDB', {});
    const error = Object.assign(new Error('IDB temporariamente bloqueado'), { vaultUnavailable: true });
    mocks.update.mockRejectedValue(error);
    await expect(getAccountVaultImageIds()).rejects.toThrow('IDB temporariamente bloqueado');
  });

  it('restore confirmado marca cache local atual sem inventar novo pull da nuvem', async () => {
    const cloudMeta = { revision: 'rev-antiga', localPersisted: false, lastPullAt: 123 };
    local.setItem(SK.libraryCloudMeta, JSON.stringify(cloudMeta));
    expect(await snapshotAccountVaultForOwners(['email:a@x.com'], { snapshot: {
      library: [{ id: 'a', name: 'Alteração offline recente' }],
    } })).toBe(true);
    expect(await restoreAccountVault('email:a@x.com')).toBe(true);
    expect(JSON.parse(local.getItem(SK.libraryCloudMeta))).toEqual({ ...cloudMeta, localPersisted: true });
    expect(JSON.parse(local.getItem(SK.library))[0].name).toBe('Alteração offline recente');
  });

  it('une aliases autenticados divergentes antes de confirmar o snapshot atual', async () => {
    database = {
      'email:a@x.com': slot([{ id: 'p0', name: 'Email antigo' }], 20),
      'id:cus_1': slot(Array.from({ length: 5 }, (_, index) => ({ id: `p${index}`, name: 'Stripe antigo' })), 10),
    };
    expect(await snapshotAccountVaultForOwners(['email:a@x.com', 'id:cus_1'], { snapshot: {
      library: [{ id: 'p0', name: 'Edição fresh', doc: { slides: [{ subtitle: 'Agora' }] } }],
    } })).toBe(true);
    expect(database['id:cus_1']).toEqual({ aliasOf: 'email:a@x.com' });
    expect(await restoreAccountVault('id:cus_1')).toBe(true);
    const library = JSON.parse(local.getItem(SK.library));
    expect(library).toHaveLength(5);
    expect(library[0].name).toBe('Edição fresh');
  });

  it('restaura em React com fonte grande mesmo quando localStorage continua cheio', async () => {
    const font = { name: 'Minha fonte', dataUrl: `data:font/woff2;base64,${'A'.repeat(6000)}` };
    database = { 'email:a@x.com': { ...slot([{ id: 'a', doc: { customTitleFont: font } }]), keys: {
      ...slot([{ id: 'a', doc: { customTitleFont: font } }]).keys, [SK.activeDocId]: '"a"',
    } } };
    vi.spyOn(local, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    const onRestored = vi.fn();
    expect(await restoreAccountVault('email:a@x.com', [], { onRestored })).toBe(true);
    expect(onRestored).toHaveBeenCalledWith(expect.objectContaining({
      library: [{ id: 'a', doc: { customTitleFont: font } }], activeDocId: 'a',
    }), { projectCount: 1, localPersisted: false });
    expect(await accountVaultHasProjects('email:a@x.com')).toBe(true);
  });

  it('só confirma restore depois que o callback aplicou o snapshot', async () => {
    database = { 'email:a@x.com': slot([{ id: 'a' }]) };
    let apply;
    const onRestored = vi.fn(() => new Promise((resolve) => { apply = resolve; }));
    const settled = vi.fn();
    const pending = restoreAccountVault('email:a@x.com', [], { onRestored }).then(settled);
    await vi.waitFor(() => expect(onRestored).toHaveBeenCalled());
    expect(settled).not.toHaveBeenCalled();
    apply();
    await pending;
    expect(settled).toHaveBeenCalledWith(true);
  });

  it('não escreve nem aplica o snapshot A se o owner muda durante a leitura IndexedDB', async () => {
    database = { 'email:a@x.com': slot([{ id: 'projeto-a' }]) };
    let owner = 'a';
    let release;
    const update = mocks.update.getMockImplementation();
    mocks.update.mockImplementationOnce(async (change) => {
      await new Promise((resolve) => { release = resolve; });
      return update(change);
    });
    const onRestored = vi.fn();
    const pending = restoreAccountVault('email:a@x.com', [], { onRestored, isCurrent: () => owner === 'a' });
    const rejected = expect(pending).rejects.toMatchObject({ code: 'ACCOUNT_VAULT_OWNER_CHANGED' });
    owner = 'b';
    local.setItem(SK.library, '[{"id":"projeto-b"}]');
    release();
    await rejected;
    expect(onRestored).not.toHaveBeenCalled();
    expect(local.getItem(SK.library)).toBe('[{"id":"projeto-b"}]');
  });

  it('revalida owner após preparar bytes de mídia antes de escrever ou chamar React', async () => {
    database = { 'email:a@x.com': slot([{ id: 'a', doc: { slides: [{ bgImage: 'data:image/png;base64,AQIDBA==' }] } }]) };
    let owner = 'a';
    let release;
    mocks.imagePut.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const onRestored = vi.fn();
    const pending = restoreAccountVault('email:a@x.com', [], { onRestored, isCurrent: () => owner === 'a' });
    const rejected = expect(pending).rejects.toMatchObject({ code: 'ACCOUNT_VAULT_OWNER_CHANGED' });
    await vi.waitFor(() => expect(mocks.imagePut).toHaveBeenCalled());
    owner = 'b';
    local.setItem(SK.library, '[{"id":"projeto-b"}]');
    release('saved');
    await rejected;
    expect(onRestored).not.toHaveBeenCalled();
    expect(local.getItem(SK.library)).toBe('[{"id":"projeto-b"}]');
  });

  it('não faz rollback de A sobre dados de B se outra aba muda owner durante as escritas', async () => {
    database = { 'email:a@x.com': { ...slot([{ id: 'a' }]), keys: { ...slot([{ id: 'a' }]).keys, [SK.brands]: '[{"id":"marca-a"}]' } } };
    let owner = 'a';
    const write = local.setItem.bind(local);
    vi.spyOn(local, 'setItem').mockImplementation((key, value) => {
      write(key, value);
      if (key === SK.library) {
        owner = 'b';
        write(SK.library, '[{"id":"projeto-b"}]');
      }
    });
    const onRestored = vi.fn();
    await expect(restoreAccountVault('email:a@x.com', [], { onRestored, isCurrent: () => owner === 'a' }))
      .rejects.toMatchObject({ code: 'ACCOUNT_VAULT_OWNER_CHANGED' });
    expect(onRestored).not.toHaveBeenCalled();
    expect(local.getItem(SK.library)).toBe('[{"id":"projeto-b"}]');
    expect(local.getItem(SK.brands)).toBeNull();
  });

  it('mantém exclusão durável após o push limpar LS, sem perder Janine com 23 cards', async () => {
    const janine = { id: 'janine', name: 'CLINICA JANINE ARAUJO', doc: {
      slides: Array.from({ length: 23 }, (_, index) => ({ id: `card-${index}`, subtitle: `Texto ${index}`, bgImageId: `imagem-${index}` })),
    } };
    database = { 'email:a@x.com': { ...slot([janine]), keys: {
      ...slot([janine]).keys, [SK.libraryDeletedIds]: '["apagado"]',
    } } };
    local.removeItem(SK.libraryDeletedIds); // versão antiga limpava depois de push bem-sucedido
    expect(await snapshotAccountVaultForOwners(['email:a@x.com'], { snapshot: {
      library: [janine, { id: 'apagado', name: 'Versão stale de outra aba' }],
    } })).toBe(true);
    expect(JSON.parse(database['email:a@x.com'].keys[SK.library])).toEqual([janine]);
    expect(JSON.parse(database['email:a@x.com'].keys[SK.libraryDeletedIds])).toEqual(['apagado']);
    const onRestored = vi.fn();
    expect(await restoreAccountVault('email:a@x.com', [], { onRestored })).toBe(true);
    expect(onRestored.mock.calls[0][0]).toMatchObject({ library: [janine], deletedIds: ['apagado'] });
  });

  it('snapshot.deletedIds protege a intenção mesmo com armazenamento local cheio', async () => {
    database = { 'email:a@x.com': slot([{ id: 'janine' }, { id: 'apagado' }]) };
    vi.spyOn(local, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    expect(await snapshotAccountVaultForOwners(['email:a@x.com'], { snapshot: {
      library: [{ id: 'janine' }], deletedIds: ['apagado'],
    } })).toBe(true);
    expect(JSON.parse(database['email:a@x.com'].keys[SK.library])).toEqual([{ id: 'janine' }]);
    expect(JSON.parse(database['email:a@x.com'].keys[SK.libraryDeletedIds])).toEqual(['apagado']);
    const onRestored = vi.fn();
    expect(await restoreAccountVault('email:a@x.com', [], { onRestored })).toBe(true);
    expect(onRestored.mock.calls[0][0].deletedIds).toEqual(['apagado']);
    expect(onRestored.mock.calls[0][1].localPersisted).toBe(false);
  });

  it('filtra exclusões de todos os aliases antes de escolher o slot por contagem', async () => {
    const janine = { id: 'janine', name: 'Atual', doc: { slides: Array.from({ length: 23 }, (_, id) => ({ id })) } };
    database = {
      'email:a@x.com': { ...slot([janine], 50), keys: { ...slot([janine]).keys, [SK.libraryDeletedIds]: '["apagado"]' } },
      'id:cus_1': slot([{ id: 'janine', name: 'Antigo' }, { id: 'apagado' }], 10),
    };
    expect(await restoreAccountVault('email:a@x.com', ['id:cus_1'])).toBe(true);
    expect(JSON.parse(local.getItem(SK.library))).toEqual([janine]);
    expect(JSON.parse(local.getItem(SK.libraryDeletedIds))).toEqual(['apagado']);
  });

  it('migração de um legado stale mais recente mantém tombstones do cofre durável', async () => {
    database = { 'email:a@x.com': { ...slot([{ id: 'janine' }], 10), keys: {
      ...slot([{ id: 'janine' }]).keys, [SK.libraryDeletedIds]: '["apagado"]',
    } } };
    local.setItem(ACCOUNT_VAULT_KEY, JSON.stringify({
      'email:a@x.com': slot([{ id: 'janine' }, { id: 'apagado' }], 20),
    }));
    expect(await restoreAccountVault('email:a@x.com')).toBe(true);
    expect(JSON.parse(local.getItem(SK.library))).toEqual([{ id: 'janine' }]);
    expect(JSON.parse(database['email:a@x.com'].keys[SK.libraryDeletedIds])).toEqual(['apagado']);
  });

  it('snapshot sem React aceita redução explicada por exclusões e mantém o anti-wipe', async () => {
    database = { 'email:a@x.com': slot([{ id: 'janine' }, { id: 'apagado' }, { id: 'outro' }]) };
    local.setItem(SK.library, '[{"id":"janine"}]');
    local.setItem(SK.libraryDeletedIds, '["apagado","outro"]');
    expect(await snapshotAccountVaultForOwners(['email:a@x.com'])).toBe(true);
    expect(JSON.parse(database['email:a@x.com'].keys[SK.library])).toEqual([{ id: 'janine' }]);
    local.setItem(SK.library, '[]');
    local.removeItem(SK.libraryDeletedIds);
    expect(await snapshotAccountVaultForOwners(['email:a@x.com'])).toBe(false);
    expect(JSON.parse(database['email:a@x.com'].keys[SK.library])).toEqual([{ id: 'janine' }]);
    expect(JSON.parse(database['email:a@x.com'].keys[SK.libraryDeletedIds])).toEqual(['apagado', 'outro']);
  });

  it('exclusões em histórico preservado valem sem restaurar projetos desse histórico', async () => {
    database = {
      'email:a@x.com': slot([{ id: 'janine' }, { id: 'apagado' }]),
      'email:a@x.com#preserved:1': { ...slot([{ id: 'historico-nao-restaurar' }]), keys: {
        ...slot([{ id: 'historico-nao-restaurar' }]).keys, [SK.libraryDeletedIds]: '["apagado"]',
      } },
    };
    expect(await restoreAccountVault('email:a@x.com')).toBe(true);
    expect(JSON.parse(local.getItem(SK.library))).toEqual([{ id: 'janine' }]);
    expect(JSON.parse(local.getItem(SK.libraryDeletedIds))).toEqual(['apagado']);
  });

  it('tombstones de outra conta não removem um ID coincidente da conta restaurada', async () => {
    database = {
      'email:a@x.com': slot([{ id: 'janine' }]),
      'email:b@x.com': { ...slot([]), keys: { ...slot([]).keys, [SK.libraryDeletedIds]: '["janine"]' } },
      'email:b@x.com#preserved:1': { keys: { [SK.libraryDeletedIds]: '["janine"]' } },
    };
    local.setItem(SK.dataOwner, '"email:b@x.com"');
    local.setItem(SK.libraryDeletedIds, '["janine"]');
    expect(await restoreAccountVault('email:a@x.com')).toBe(true);
    expect(JSON.parse(local.getItem(SK.library))).toEqual([{ id: 'janine' }]);
  });

  it('restore respeita exclusão ativa da própria conta que ainda não chegou ao cofre', async () => {
    database = { 'email:a@x.com': slot([{ id: 'janine' }, { id: 'apagado' }]) };
    local.setItem(SK.dataOwner, '"email:a@x.com"');
    local.setItem(SK.libraryDeletedIds, '["apagado"]');
    expect(await restoreAccountVault('email:a@x.com')).toBe(true);
    expect(JSON.parse(local.getItem(SK.library))).toEqual([{ id: 'janine' }]);
  });

  it('todos os projetos excluídos restauram intenção e lista vazia sem loop de reload', async () => {
    database = { 'email:a@x.com': { ...slot([{ id: 'apagado' }]), keys: {
      ...slot([{ id: 'apagado' }]).keys, [SK.libraryDeletedIds]: '["apagado"]',
    } } };
    expect(await accountVaultHasProjects('email:a@x.com')).toBe(false);
    expect(await restoreAccountVault('email:a@x.com')).toBe(false);
    expect(local.getItem(SK.library)).toBe('[]');
    expect(JSON.parse(local.getItem(SK.libraryDeletedIds))).toEqual(['apagado']);
    const onRestored = vi.fn();
    expect(await restoreAccountVault('email:a@x.com', [], { onRestored })).toBe(true);
    expect(onRestored.mock.calls[0][0]).toMatchObject({ library: [], deletedIds: ['apagado'] });
    expect(onRestored.mock.calls[0][1].projectCount).toBe(0);
  });

  it('falha de restore mantém o cofre atual e reverte as chaves anteriores', async () => {
    database = { 'email:a@x.com': { ...slot([{ id: 'novo' }]), keys: {
      [SK.library]: '[{"id":"novo"}]', [SK.brands]: '[{"id":"marca-nova"}]',
    } } };
    local.setItem(SK.library, '[{"id":"anterior"}]');
    const write = local.setItem.bind(local);
    vi.spyOn(local, 'setItem').mockImplementation((key, value) => {
      if (key === SK.brands) throw new DOMException('full', 'QuotaExceededError');
      write(key, value);
    });
    expect(await restoreAccountVault('email:a@x.com')).toBe(false);
    expect(local.getItem(SK.library)).toBe('[{"id":"anterior"}]');
    expect(database['email:a@x.com'].keys[SK.library]).toBe('[{"id":"novo"}]');
  });
});
