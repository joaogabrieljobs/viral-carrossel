import { beforeEach, describe, expect, it } from 'vitest';
import {
  getLibrarySyncMeta,
  getLibraryManifest,
  putLibraryManifest,
  putLibraryAsset,
  getLibraryAsset,
  resetLibrarySyncStoreForTests,
} from '../../api/lib/library-sync-store.js';

describe('library-sync-store', () => {
  beforeEach(() => {
    resetLibrarySyncStoreForTests();
  });

  it('isola manifesto por customerId', async () => {
    await putLibraryManifest('cus_aaa', {
      docs: [{ id: '1', name: 'A', doc: { slides: [] } }],
      folders: [],
      brands: [],
      assetIds: [],
    });
    await putLibraryManifest('cus_bbb', {
      docs: [{ id: '2', name: 'B', doc: { slides: [] } }],
      folders: [],
      brands: [],
      assetIds: [],
    });

    const a = await getLibraryManifest('cus_aaa');
    const b = await getLibraryManifest('cus_bbb');
    expect(a.docs[0].name).toBe('A');
    expect(b.docs[0].name).toBe('B');
    expect(a.customerId).toBe('cus_aaa');
    expect(b.customerId).toBe('cus_bbb');
  });

  it('incrementa revision e detecta conflito', async () => {
    const first = await putLibraryManifest('cus_x', {
      docs: [{ id: '1', name: 'v1', doc: {} }],
      assetIds: [],
    });
    expect(first.meta.revision).toBe(1);

    const second = await putLibraryManifest('cus_x', {
      docs: [{ id: '1', name: 'v2', doc: {} }],
      assetIds: [],
    }, { baseRevision: 1 });
    expect(second.meta.revision).toBe(2);

    await expect(
      putLibraryManifest('cus_x', {
        docs: [{ id: '1', name: 'stale', doc: {} }],
        assetIds: [],
      }, { baseRevision: 1 }),
    ).rejects.toMatchObject({ code: 'library_conflict' });

    const forced = await putLibraryManifest('cus_x', {
      docs: [{ id: '1', name: 'force', doc: {} }],
      assetIds: [],
    }, { force: true });
    expect(forced.manifest.docs[0].name).toBe('force');
    expect(forced.meta.revision).toBe(3);
  });

  it('grava e lê assets por conta', async () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQ';
    await putLibraryAsset('cus_img', 'img_1', { dataUrl, contentType: 'image/jpeg' });
    const got = await getLibraryAsset('cus_img', 'img_1');
    expect(got.dataUrl).toBe(dataUrl);
    expect(await getLibraryAsset('cus_other', 'img_1')).toBeNull();

    const meta = await getLibrarySyncMeta('cus_missing');
    expect(meta).toBeNull();
  });
});
