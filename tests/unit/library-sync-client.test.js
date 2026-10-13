import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('library-sync client pack', () => {
  let local;

  beforeEach(() => {
    local = makeMemoryStorage();
    vi.stubGlobal('localStorage', local);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('packLibraryForCloud monta manifesto com projetos locais', async () => {
    local.setItem(SK.library, JSON.stringify([
      {
        id: 'p1',
        name: 'Carrossel',
        doc: {
          slides: [{ id: 's1', title: 'Oi', bgImageId: null, bgImage: null }],
          brand: { id: 'default', name: 'Marca' },
          styleKit: { contextMd: 'brief', refImages: [] },
        },
      },
    ]));
    local.setItem(SK.libraryFolders, JSON.stringify([]));
    local.setItem(SK.brands, JSON.stringify([{ id: 'default', name: 'Marca' }]));
    local.setItem(SK.activeBrandId, JSON.stringify('default'));
    local.setItem(SK.activeDocId, JSON.stringify('p1'));

    const { packLibraryForCloud } = await import('../../src/utils/library-sync.js');
    const { manifest, projectCount, assets } = await packLibraryForCloud();
    expect(projectCount).toBe(1);
    expect(manifest.docs[0].name).toBe('Carrossel');
    expect(manifest.docs[0].doc.slides[0].title).toBe('Oi');
    expect(manifest.vcVersion).toBe(3);
    expect(assets.size).toBe(0);
  });

  it('localLibraryFingerprint reflecte updatedAt e contagem', async () => {
    local.setItem(SK.library, JSON.stringify([
      { id: 'a', updatedAt: 100 },
      { id: 'b', updatedAt: 500, createdAt: 1 },
    ]));
    const { localLibraryFingerprint } = await import('../../src/utils/library-sync.js');
    expect(localLibraryFingerprint()).toEqual({ count: 2, maxUpdated: 500 });
  });
});
