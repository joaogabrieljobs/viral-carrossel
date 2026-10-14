import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_VAULT_KEY,
  accountVaultHasProjects,
  getAccountVaultImageIds,
  restoreAccountVault,
  snapshotAccountVault,
  snapshotAccountVaultForOwners,
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
    vi.restoreAllMocks();
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

  it('não sobrescreve cofre cheio com snapshot vazio', () => {
    local.setItem(SK.library, JSON.stringify([{ id: 'keep' }, { id: 'two' }]));
    snapshotAccountVault('email:a@x.com');
    local.setItem(SK.library, JSON.stringify([]));
    expect(snapshotAccountVault('email:a@x.com')).toBe(false);
    local.removeItem(SK.library);
    restoreAccountVault('email:a@x.com');
    expect(JSON.parse(local.getItem(SK.library))).toHaveLength(2);
  });

  it('restaura pelo alias id:cus quando o login pede email:', () => {
    local.setItem(SK.library, JSON.stringify([{ id: 'janine', name: 'Clinica Janine' }]));
    snapshotAccountVault('id:cus_1');
    local.removeItem(SK.library);
    expect(restoreAccountVault('email:a@x.com', ['email:a@x.com', 'id:cus_1'])).toBe(true);
    expect(JSON.parse(local.getItem(SK.library))[0].name).toBe('Clinica Janine');
  });

  it('quota ao gravar cofre devolve false e preserva o snapshot anterior', () => {
    local.setItem(SK.library, JSON.stringify([{ id: 'p1', name: 'Antes' }]));
    snapshotAccountVault('email:a@x.com');
    const previous = local.getItem(ACCOUNT_VAULT_KEY);
    local.setItem(SK.library, JSON.stringify([{ id: 'p1', name: 'Edição atual' }]));
    const setItem = local.setItem.bind(local);
    vi.spyOn(local, 'setItem').mockImplementation((key, value) => {
      if (key === ACCOUNT_VAULT_KEY) throw new DOMException('full', 'QuotaExceededError');
      setItem(key, value);
    });

    expect(snapshotAccountVault('email:a@x.com')).toBe(false);
    expect(snapshotAccountVaultForOwners(['email:a@x.com', 'id:cus_1'])).toBe(false);
    expect(local.getItem(ACCOUNT_VAULT_KEY)).toBe(previous);
    expect(JSON.parse(local.getItem(SK.library))[0].name).toBe('Edição atual');
  });

  it('guarda aliases iguais em um slot canônico e restaura por qualquer alias', () => {
    const library = JSON.stringify([{ id: 'p1', name: 'Meu' }]);
    local.setItem(SK.library, library);
    const write = vi.spyOn(local, 'setItem');
    expect(snapshotAccountVaultForOwners(['id:cus_1', 'email:a@x.com'])).toBe(true);
    const vault = JSON.parse(local.getItem(ACCOUNT_VAULT_KEY));
    expect(vault['email:a@x.com'].keys[SK.library]).toBe(library);
    expect(vault['id:cus_1']).toEqual({ aliasOf: 'email:a@x.com' });
    expect(write.mock.calls.filter(([key]) => key === ACCOUNT_VAULT_KEY)).toHaveLength(1);
    expect(accountVaultHasProjects('id:cus_1')).toBe(true);

    local.removeItem(SK.library);
    expect(restoreAccountVault('id:cus_1')).toBe(true);
    expect(local.getItem(SK.library)).toBe(library);
  });

  it('deduplica slots legados idênticos sem considerar savedAt parte do conteúdo', () => {
    const keys = { [SK.library]: JSON.stringify([{ id: 'p1' }]) };
    local.setItem(ACCOUNT_VAULT_KEY, JSON.stringify({
      'email:a@x.com': { savedAt: 1, keys },
      'id:cus_1': { savedAt: 2, keys },
    }));
    local.setItem(SK.library, keys[SK.library]);
    expect(snapshotAccountVaultForOwners(['email:a@x.com', 'id:cus_1'])).toBe(true);
    const vault = JSON.parse(local.getItem(ACCOUNT_VAULT_KEY));
    expect(vault['id:cus_1']).toEqual({ aliasOf: 'email:a@x.com' });
  });

  it('preserva aliases legados divergentes, mesmo com a mesma contagem de projetos', () => {
    vi.spyOn(Date, 'now').mockReturnValue(30);
    const current = JSON.stringify([{ id: 'p1', name: 'Atual' }]);
    const divergent = { savedAt: 20, keys: { [SK.library]: JSON.stringify([{ id: 'outro' }]) } };
    local.setItem(ACCOUNT_VAULT_KEY, JSON.stringify({
      'email:a@x.com': { savedAt: 10, keys: { [SK.library]: current } },
      'id:cus_1': divergent,
    }));
    local.setItem(SK.library, current);
    expect(snapshotAccountVaultForOwners(['email:a@x.com', 'id:cus_1'])).toBe(true);
    expect(JSON.parse(local.getItem(ACCOUNT_VAULT_KEY))['id:cus_1']).toEqual(divergent);
    local.removeItem(SK.library);
    expect(restoreAccountVault('id:cus_1', ['email:a@x.com'])).toBe(true);
    expect(local.getItem(SK.library)).toBe(current); // mesma contagem: versão mais recente
  });

  it('atualizar a conta não mantém cópias antigas que eram idênticas entre aliases', () => {
    const previous = { [SK.library]: '[{"id":"p1","name":"Antes"}]' };
    const current = '[{"id":"p1","name":"Edição atual"}]';
    local.setItem(ACCOUNT_VAULT_KEY, JSON.stringify({
      'email:a@x.com': { savedAt: 1, keys: previous },
      'id:cus_1': { savedAt: 2, keys: previous },
    }));
    local.setItem(SK.library, current);
    expect(snapshotAccountVaultForOwners(['email:a@x.com', 'id:cus_1'])).toBe(true);
    const vault = JSON.parse(local.getItem(ACCOUNT_VAULT_KEY));
    expect(vault['id:cus_1']).toEqual({ aliasOf: 'email:a@x.com' });
    expect(vault['email:a@x.com'].keys[SK.library]).toBe(current);
  });

  it('não elimina dados diferentes de um alias só porque a biblioteca é igual', () => {
    const library = JSON.stringify([{ id: 'p1' }]);
    const divergent = { savedAt: 1, keys: { [SK.library]: library, [SK.brands]: '[{"id":"outra"}]' } };
    local.setItem(ACCOUNT_VAULT_KEY, JSON.stringify({ 'id:cus_1': divergent }));
    local.setItem(SK.library, library);
    local.setItem(SK.brands, '[{"id":"atual"}]');
    snapshotAccountVaultForOwners(['email:a@x.com', 'id:cus_1']);
    expect(JSON.parse(local.getItem(ACCOUNT_VAULT_KEY))['id:cus_1']).toEqual(divergent);
  });

  it('atualiza um alias existente no slot canônico sem criar outra cópia', () => {
    local.setItem(SK.library, '[{"id":"p1","name":"Antes"}]');
    snapshotAccountVaultForOwners(['email:a@x.com', 'id:cus_1']);
    const current = '[{"id":"p1","name":"Depois"}]';
    local.setItem(SK.library, current);
    expect(snapshotAccountVault('id:cus_1')).toBe(true);
    const vault = JSON.parse(local.getItem(ACCOUNT_VAULT_KEY));
    expect(vault['email:a@x.com'].keys[SK.library]).toBe(current);
    expect(vault['id:cus_1']).toEqual({ aliasOf: 'email:a@x.com' });
  });

  it('não anuncia restore de marcas quando a biblioteca não coube', () => {
    local.setItem(SK.library, '[{"id":"p1"}]');
    local.setItem(SK.brands, '[{"id":"b1"}]');
    snapshotAccountVault('email:a@x.com');
    const vault = local.getItem(ACCOUNT_VAULT_KEY);
    local.removeItem(SK.library);
    local.removeItem(SK.brands);
    const setItem = local.setItem.bind(local);
    vi.spyOn(local, 'setItem').mockImplementation((key, value) => {
      if (key === SK.library) throw new DOMException('full', 'QuotaExceededError');
      setItem(key, value);
    });
    expect(restoreAccountVault('email:a@x.com')).toBe(false);
    expect(restoreAccountVault('email:a@x.com')).toBe(false);
    expect(local.getItem(SK.library)).toBeNull();
    expect(local.getItem(SK.brands)).toBeNull();
    expect(local.getItem(ACCOUNT_VAULT_KEY)).toBe(vault);
  });

  it('reverte restauração parcial quando uma chave posterior falha', () => {
    local.setItem(SK.library, '[{"id":"restaurado"}]');
    local.setItem(SK.brands, '[{"id":"marca-restaurada"}]');
    snapshotAccountVault('email:a@x.com');
    local.setItem(SK.library, '[{"id":"original"}]');
    local.setItem(SK.brands, '[{"id":"marca-original"}]');
    const setItem = local.setItem.bind(local);
    vi.spyOn(local, 'setItem').mockImplementation((key, value) => {
      if (key === SK.brands) throw new DOMException('full', 'QuotaExceededError');
      setItem(key, value);
    });
    expect(restoreAccountVault('email:a@x.com')).toBe(false);
    expect(local.getItem(SK.library)).toBe('[{"id":"original"}]');
    expect(local.getItem(SK.brands)).toBe('[{"id":"marca-original"}]');
    expect(accountVaultHasProjects('email:a@x.com')).toBe(true);
  });

  it('verifica os bytes restaurados antes de confirmar sucesso', () => {
    local.setItem(SK.library, '[{"id":"p1"}]');
    snapshotAccountVault('email:a@x.com');
    local.removeItem(SK.library);
    vi.spyOn(local, 'setItem').mockImplementation(() => {});
    expect(restoreAccountVault('email:a@x.com')).toBe(false);
    expect(local.getItem(SK.library)).toBeNull();
  });

  it('slot só de marcas ou biblioteca vazia não solicita reload', () => {
    local.setItem(ACCOUNT_VAULT_KEY, JSON.stringify({
      'email:marcas@x.com': { keys: { [SK.brands]: '[{"id":"b1"}]' } },
      'email:vazia@x.com': { keys: { [SK.library]: '[]', [SK.brands]: '[{"id":"b1"}]' } },
    }));
    expect(restoreAccountVault('email:marcas@x.com')).toBe(false);
    expect(restoreAccountVault('email:vazia@x.com')).toBe(false);
    expect(local.getItem(SK.brands)).toBeNull();
  });

  it('protege imagens de todas as contas, kits e aliases divergentes contra GC', () => {
    const doc = {
      slides: [{ bgImageId: 'bg', logoImageId: 'card-logo', refImageId: 'card-ref' }],
      brand: { logoImageId: 'doc-logo', styleKit: { refImages: [{ imageId: 'brand-kit-ref' }] } },
      styleKit: { logo: { imageId: 'kit-logo' }, refImages: [{ imageId: 'kit-ref' }] },
    };
    local.setItem(ACCOUNT_VAULT_KEY, JSON.stringify({
      'email:a@x.com': { keys: { [SK.library]: JSON.stringify([{ id: 'p1', doc }]),
        [SK.brands]: JSON.stringify([{ logoImageId: 'roster-logo', styleKit: { logo: { imageId: 'roster-kit-logo' } } }]) } },
      'id:cus_1': { aliasOf: 'email:a@x.com' },
      'id:legacy': { keys: { [SK.library]: JSON.stringify([{ doc: { slides: [{ bgImageId: 'legacy-bg' }] } }]) } },
      'email:b@x.com': { keys: { [SK.library]: JSON.stringify([{ doc: { slides: [{ refImageId: 'other-account-ref' }] } }]) } },
      'broken': { aliasOf: 'missing' },
      'cycle-a': { aliasOf: 'cycle-b' },
      'cycle-b': { aliasOf: 'cycle-a' },
    }));
    expect([...getAccountVaultImageIds()].sort()).toEqual([
      'bg', 'brand-kit-ref', 'card-logo', 'card-ref', 'doc-logo', 'kit-logo', 'kit-ref',
      'legacy-bg', 'other-account-ref', 'roster-kit-logo', 'roster-logo',
    ].sort());
    expect(restoreAccountVault('broken')).toBe(false);
    expect(accountVaultHasProjects('cycle-a')).toBe(false);
  });
});
