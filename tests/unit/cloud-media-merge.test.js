import { describe, expect, it } from 'vitest';
import { mergeHydratedBrandMedia, mergeHydratedProjectMedia } from '../../src/utils/cloud-media-merge.js';

describe('mídia da nuvem após restaurar textos', () => {
  it('preenche a foto atrasada sem trocar textos nem a foto editada pelo usuário', () => {
    const current = { id: 'janine', name: 'Projeto renomeado', doc: { slides: [
      { id: 'a', title: 'Texto novo', bgImageAssetId: 'asset-a', bgImageId: 'old-a', bgImageFailed: true },
      { id: 'b', title: 'Editado', bgImageAssetId: 'asset-b', bgImage: 'blob:foto-editada' },
      { id: 'c', title: 'Outro', bgImageAssetId: 'asset-novo' },
    ] } };
    const incoming = { id: 'janine', name: 'Nome antigo', doc: { slides: [
      { id: 'a', title: 'Texto antigo', bgImageAssetId: 'asset-a', bgImage: 'data:image/png;base64,AAAA', bgImageId: null },
      { id: 'b', title: 'Antigo', bgImageAssetId: 'asset-b', bgImage: 'blob:foto-antiga', bgImageId: 'stored-b' },
      { id: 'c', bgImageAssetId: 'asset-antigo', bgImage: 'blob:errada' },
    ] } };
    const merged = mergeHydratedProjectMedia(current, incoming);
    expect(merged.name).toBe('Projeto renomeado');
    expect(merged.doc.slides[0]).toMatchObject({
      title: 'Texto novo', bgImage: 'data:image/png;base64,AAAA',
      bgImageId: 'old-a', bgImageFailed: false,
    });
    expect(merged.doc.slides[1]).toBe(current.doc.slides[1]);
    expect(merged.doc.slides[2]).toBe(current.doc.slides[2]);
  });

  it('só aplica logo da mesma versão de imagem e preserva a marca modificada', () => {
    const current = { id: 'brand', name: 'Novo nome', logoAssetId: 'logo-1', logo: null };
    const hydrated = { id: 'brand', name: 'Nome antigo', logoAssetId: 'logo-1', logo: 'data:image/png;base64,AAAA' };
    expect(mergeHydratedBrandMedia(current, hydrated)).toMatchObject({
      name: 'Novo nome', logo: 'data:image/png;base64,AAAA',
    });
    expect(mergeHydratedBrandMedia({ ...current, logoAssetId: 'logo-2' }, hydrated).logo).toBeNull();
    expect(mergeHydratedBrandMedia({ ...current, logo: 'blob:usuario' }, hydrated).logo).toBe('blob:usuario');
  });
});
