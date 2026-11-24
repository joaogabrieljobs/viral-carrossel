import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SK, bindAccountDataWriteOwner, lsSet, unlockAccountDataWrites } from '../../src/utils/storage.js';
import { persistAISettings } from '../../src/hooks/useAiSettings.js';
import { saveCustomVisualPresets } from '../../src/utils/account-preferences.js';
import { CUSTOM_VISUAL_PRESETS_KEY } from '../../src/utils/custom-visual-presets.js';
import { USER_PROFILE_KEY, saveUserProfile } from '../../src/utils/user-profile.js';

// FE-25: a aba aberta com a conta A continuava gravando chave própria de IA,
// ganchos, padrões salvos e perfil depois que outra aba entrava com a conta B.
// Biblioteca, pastas e marcas já eram travadas; estas preferências, não.
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
const settingsOfA = { persistKeys: true, textProvider: 'openai', keys: { openai: 'chave-de-teste-da-conta-a' } };
const presetOfA = [{ id: 'custom_a', isCustom: true, label: 'Estilo da A', brand: { bg: '#111111' }, slideDefaults: {} }];

describe('FE-25 — aba antiga não regrava preferências da conta depois da troca em outra aba', () => {
  let local;
  let session;
  let blocked;

  beforeEach(() => {
    unlockAccountDataWrites();
    local = makeMemoryStorage();
    session = makeMemoryStorage();
    blocked = [];
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', session);
    vi.stubGlobal('window', { dispatchEvent: (event) => { blocked.push(event.type); return true; } });
    vi.stubGlobal('CustomEvent', class { constructor(type, init) { this.type = type; this.detail = init?.detail; } });
    // Esta aba abriu com a conta A.
    local.setItem(SK.dataOwner, JSON.stringify('id:conta-a'));
    bindAccountDataWriteOwner('id:conta-a', { switchedHere: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Outra aba saiu de A e entrou com B: limpou as chaves e gravou o novo dono. */
  const otherTabSwitchesToB = () => {
    for (const key of [SK.aiSettings, SK.aiKeys, SK.hookLibrary, CUSTOM_VISUAL_PRESETS_KEY, USER_PROFILE_KEY]) local.removeItem(key);
    local.setItem(SK.dataOwner, JSON.stringify('id:conta-b'));
  };

  it('com a mesma conta, tudo grava como antes', () => {
    expect(persistAISettings(settingsOfA)).toBe(true);
    expect(JSON.parse(local.getItem(SK.aiKeys))).toEqual(settingsOfA.keys);
    expect(JSON.parse(local.getItem(SK.aiSettings))).toMatchObject({ persistKeys: true, textProvider: 'openai' });
    expect(lsSet(SK.hookLibrary, [{ title: 'Gancho' }])).toBe(true);
    expect(saveCustomVisualPresets(presetOfA)).toBe(true);
    expect(JSON.parse(local.getItem(CUSTOM_VISUAL_PRESETS_KEY))[0].id).toBe('custom_a');
    expect(saveUserProfile({ name: 'Ana' }).name).toBe('Ana');
    expect(JSON.parse(local.getItem(USER_PROFILE_KEY)).name).toBe('Ana');
    expect(blocked).toEqual([]);
  });

  it('chave própria e configurações de IA de A não vão para o navegador de B', () => {
    otherTabSwitchesToB();
    expect(persistAISettings(settingsOfA)).toBe(false);
    expect(local.getItem(SK.aiKeys)).toBeNull();
    expect(local.getItem(SK.aiSettings)).toBeNull();
    expect(session.getItem(SK.aiKeys)).toBeNull();
    expect(blocked).toContain('vc:account-write-blocked');
  });

  it('ganchos, padrões salvos e perfil de A também não', () => {
    otherTabSwitchesToB();
    expect(lsSet(SK.hookLibrary, [{ title: 'Gancho da A' }])).toBe(false);
    expect(local.getItem(SK.hookLibrary)).toBeNull();
    expect(saveCustomVisualPresets(presetOfA)).toBe(false);
    expect(local.getItem(CUSTOM_VISUAL_PRESETS_KEY)).toBeNull();
    expect(() => saveUserProfile({ name: 'Ana' })).toThrow(/conta mudou/i);
    expect(local.getItem(USER_PROFILE_KEY)).toBeNull();
  });

  it('a troca feita nesta própria aba continua gravando para a conta nova', () => {
    local.setItem(SK.dataOwner, JSON.stringify('id:conta-b'));
    bindAccountDataWriteOwner('id:conta-b', { switchedHere: true });
    expect(persistAISettings(settingsOfA)).toBe(true);
    expect(saveCustomVisualPresets(presetOfA)).toBe(true);
  });
});
