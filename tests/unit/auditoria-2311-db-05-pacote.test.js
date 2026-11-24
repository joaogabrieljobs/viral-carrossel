// DB-05 (segundo sintoma): o pacote enviado à conta trocava `bgImageAssetId:
// null` e `refImageAssetId: null` por chave ausente e acrescentava `logoImage:
// null`. O card que voltava da conta não era igual ao que tinha sido salvo.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/image-store.js', async (importOriginal) => ({
  ...(await importOriginal()),
  imagemComoDataUrl: vi.fn(async () => null),
}));

import { packLibraryForCloud } from '../../src/utils/library-sync.js';

const pack = async (slides) => (await packLibraryForCloud({
  library: [{ id: 'p1', name: 'P', doc: { slides } }], brandRoster: [], libraryFolders: [],
  activeBrandId: '', activeDocId: 'p1', deletedIds: [], ignoreLocalDeletedIds: true,
})).manifest.docs[0].doc.slides;

describe('DB-05: empacotar para a conta não muda um card sem mídia', () => {
  it('card recém-gerado (ids de mídia nulos, sem logo própria) sai igual ao que entrou', async () => {
    const generated = {
      id: 's1', num: 1, title: 'Decisão registrada 1', imageQuery: 'editorial meeting notes',
      bgImage: null, bgImageId: null, bgImageAssetId: null,
      refImage: null, refImageId: null, refImageAssetId: null,
    };
    const [packed] = await pack([generated]);
    expect(packed).toEqual(generated);
    expect(Object.keys(packed).sort()).toEqual(Object.keys(generated).sort());
  });

  it('card que já veio da conta (sem essas chaves) também não ganha chaves novas', async () => {
    const fromCloud = { id: 's1', num: 1, title: 'Da conta', bgImage: null, bgImageId: null, refImage: null, refImageId: null };
    const [packed] = await pack([fromCloud]);
    expect(Object.keys(packed).sort()).toEqual(Object.keys(fromCloud).sort());
  });

  it('card com asset confirmado continua levando o asset e sem bytes', async () => {
    const [packed] = await pack([{
      id: 's1', bgImage: 'blob:local', bgImageId: null, bgImageAssetId: 'original_abc', logoImage: 'blob:logo', logoImageAssetId: 'logo_1',
    }]);
    expect(packed).toMatchObject({ bgImage: null, bgImageAssetId: 'original_abc', logoImage: null, logoImageAssetId: 'logo_1' });
  });
});
