import { describe, expect, it } from 'vitest';
import { samePersistedDocument } from '../../src/hooks/useLibrary.js';
import { detachTeamShareMetadata } from '../../src/utils/team-share-metadata.js';

describe('samePersistedDocument', () => {
  it('não trata a abertura do mesmo conteúdo como edição', () => {
    const left = { slides: [{ id: 's1', title: 'Original' }] };
    const right = JSON.parse(JSON.stringify(left));
    expect(samePersistedDocument(left, right)).toBe(true);
  });

  it('ignora URLs de runtime quando a imagem já está no IndexedDB', () => {
    const left = { slides: [{ id: 's1', bgImageId: 'img-1', bgImage: 'blob:antiga' }] };
    const right = { slides: [{ id: 's1', bgImageId: 'img-1', bgImage: 'blob:nova' }] };
    expect(samePersistedDocument(left, right)).toBe(true);
  });

  it('ignora cache local e falha transitória quando o asset remoto é o mesmo', () => {
    const left = {
      slides: [{ id: 's1', bgImageAssetId: 'asset-1', bgImageFailed: true, bgImageError: 'offline' }],
      styleKit: { refImages: [{ assetId: 'ref-1', imageId: 'cache-antigo' }] },
    };
    const right = {
      slides: [{ id: 's1', bgImageAssetId: 'asset-1', bgImageId: 'cache-novo', bgImage: 'blob:nova' }],
      styleKit: { refImages: [{ assetId: 'ref-1', imageId: 'cache-novo', dataUrl: 'data:image/png;base64,AA==' }] },
    };
    expect(samePersistedDocument(left, right)).toBe(true);
  });

  it('detecta uma alteração real do documento', () => {
    const left = { slides: [{ id: 's1', title: 'Antes' }] };
    const right = { slides: [{ id: 's1', title: 'Depois' }] };
    expect(samePersistedDocument(left, right)).toBe(false);
  });
});

describe('detachTeamShareMetadata', () => {
  it('transforma a duplicação em projeto independente sem perder o conteúdo', () => {
    const original = {
      shareCode: 'AB12CD34',
      shareRevision: 7,
      shareUpdatedAt: 123,
      shareMeta: { syncedAt: 100, includesImages: true },
      slides: [{ id: 's1', title: 'Preservado' }],
    };

    const copy = detachTeamShareMetadata(original);

    expect(copy).not.toHaveProperty('shareCode');
    expect(copy).not.toHaveProperty('shareRevision');
    expect(copy).not.toHaveProperty('shareUpdatedAt');
    expect(copy).not.toHaveProperty('shareMeta');
    expect(copy.slides).toEqual(original.slides);
    expect(copy.slides).not.toBe(original.slides);
    expect(original.shareCode).toBe('AB12CD34');
  });
});
