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

  it('recupera logo e referências do estilo sem reverter texto ou identidade visual', () => {
    const current = { id: 'janine', doc: {
      slides: [{ id: 'a', title: 'Texto editado' }],
      styleKit: {
        contextMd: 'Brief novo',
        logo: { assetId: 'logo-1', name: 'Minha logo' },
        refImages: [{ id: 'r1', name: 'Minha referência', assetId: 'ref-1' }],
      },
    } };
    const hydrated = { id: 'janine', doc: {
      slides: [{ id: 'a', title: 'Texto antigo' }],
      styleKit: {
        contextMd: 'Brief antigo',
        logo: { assetId: 'logo-1', name: 'Nome antigo', imageId: 'stored-logo' },
        refImages: [{ id: 'outro', name: 'Nome antigo', assetId: 'ref-1', imageId: 'stored-ref' }],
      },
    } };
    const merged = mergeHydratedProjectMedia(current, hydrated);
    expect(merged.doc.slides[0].title).toBe('Texto editado');
    expect(merged.doc.styleKit).toMatchObject({
      contextMd: 'Brief novo',
      logo: { assetId: 'logo-1', name: 'Minha logo', imageId: 'stored-logo' },
      refImages: [{ id: 'r1', name: 'Minha referência', assetId: 'ref-1', imageId: 'stored-ref' }],
    });
    expect(current.doc.styleKit.logo.imageId).toBeUndefined();
    expect(current.doc.styleKit.refImages[0].imageId).toBeUndefined();
  });

  it('não ressuscita referências removidas nem substitui logo ou referência editada durante o download', () => {
    const current = { id: 'janine', doc: {
      slides: [{ id: 'a' }],
      styleKit: {
        logo: { assetId: 'logo-1', imageId: 'logo-editada' },
        refImages: [
          { id: 'r1', assetId: 'ref-1', imageId: 'ref-editada' },
          { id: 'r2', assetId: 'ref-nova' },
        ],
      },
    } };
    const hydrated = { id: 'janine', doc: {
      slides: [{ id: 'a' }],
      styleKit: {
        logo: { assetId: 'logo-1', imageId: 'logo-antiga' },
        refImages: [
          { id: 'r1', assetId: 'ref-1', imageId: 'ref-antiga' },
          { id: 'removida', assetId: 'ref-removida', imageId: 'ref-removida-antiga' },
          { id: 'r2', assetId: 'ref-antiga-2', imageId: 'ref-antiga-2' },
        ],
      },
    } };
    expect(mergeHydratedProjectMedia(current, hydrated)).toBe(current);
  });
});
