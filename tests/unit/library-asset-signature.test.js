import { beforeEach, describe, expect, it } from 'vitest';
import {
  putLibraryAsset,
  resetLibrarySyncStoreForTests,
} from '../../api/lib/library-sync-store.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

beforeEach(resetLibrarySyncStoreForTests);

describe('assinatura dos assets de imagem', () => {
  it('aceita formato permitido quando os bytes correspondem ao MIME', async () => {
    await expect(putLibraryAsset('cus_asset', 'foto_1', { dataUrl: PNG }))
      .resolves.toMatchObject({ contentType: 'image/png' });
  });

  it.each([
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    'data:image/png;base64,PHN2Zz48L3N2Zz4=',
    PNG.replace('image/png', 'image/jpeg'),
  ])('recusa MIME aberto, conteúdo forjado ou rótulo divergente', async (dataUrl) => {
    await expect(putLibraryAsset('cus_asset', 'foto_invalida', { dataUrl }))
      .rejects.toMatchObject({ code: 'library_bad_asset' });
  });
});
