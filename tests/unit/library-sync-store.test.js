import { beforeEach, describe, expect, it } from 'vitest';
import {
  getLibrarySyncMeta,
  getLibraryManifest,
  putLibraryManifest,
  putLibraryAsset,
  getLibraryAsset,
  resetLibrarySyncStoreForTests,
  resolveLibraryOwnerId,
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
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    await putLibraryAsset('cus_img', 'img_1', { dataUrl, contentType: 'image/jpeg' });
    const got = await getLibraryAsset('cus_img', 'img_1');
    expect(got.dataUrl).toContain('data:image/jpeg;base64,');
    expect(await getLibraryAsset('cus_other', 'img_1')).toBeNull();

    const meta = await getLibrarySyncMeta('cus_missing');
    expect(meta).toBeNull();
  });

  it('resolveLibraryOwnerId prefere customerId e cai para email', () => {
    expect(resolveLibraryOwnerId({ customerId: 'cus_abc', email: 'a@b.com' })).toBe('cus_abc');
    expect(resolveLibraryOwnerId({ email: 'A@B.com' })).toBe('em_a_b_com');
    expect(resolveLibraryOwnerId({ billingDisabled: true })).toBe('billing-disabled');
  });

  it('merge por defeito não apaga projetos que só existem na nuvem', async () => {
    await putLibraryManifest('cus_merge', {
      docs: [
        { id: 'a', name: 'Clínica', updatedAt: 100, doc: {} },
        { id: 'b', name: 'Carrossel', updatedAt: 100, doc: {} },
      ],
      assetIds: [],
    });
    const merged = await putLibraryManifest('cus_merge', {
      docs: [
        { id: 'c', name: 'Novo', updatedAt: 200, doc: {} },
      ],
      assetIds: [],
    }, { force: true });
    const ids = merged.manifest.docs.map((d) => d.id).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
    expect(merged.meta.projectCount).toBe(3);
  });

  it('replace=true pode encolher; deletedIds remove no merge', async () => {
    await putLibraryManifest('cus_del', {
      docs: [
        { id: 'keep', name: 'Keep', updatedAt: 1, doc: {} },
        { id: 'gone', name: 'Gone', updatedAt: 1, doc: {} },
      ],
      assetIds: [],
    });
    const afterDel = await putLibraryManifest('cus_del', {
      docs: [{ id: 'keep', name: 'Keep', updatedAt: 2, doc: {} }],
      deletedIds: ['gone'],
      assetIds: [],
    }, { force: true });
    expect(afterDel.manifest.docs.map((d) => d.id)).toEqual(['keep']);

    const replaced = await putLibraryManifest('cus_del', {
      docs: [{ id: 'only', name: 'Only', updatedAt: 3, doc: {} }],
      assetIds: [],
    }, { force: true, replace: true });
    expect(replaced.manifest.docs.map((d) => d.id)).toEqual(['only']);
  });
});
