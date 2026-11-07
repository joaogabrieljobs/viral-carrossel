import { describe, expect, it } from 'vitest';
import { preserveDroppedMediaReferences } from '../../api/lib/media-reference-guard.js';

const previous = { id: 'p', doc: { slides: [
  { id: 's1', title: 'A', bgImageAssetId: 'original_chunks_aaa', bgImageId: 'img_1' },
  { id: 's2', title: 'B', bgImageAssetId: 'original_chunks_bbb', logoImageAssetId: 'logo_1' },
  { id: 's3', title: 'C' },
] } };

describe('preserveDroppedMediaReferences', () => {
  it('devolve a referência quando o cliente salvou a foto como indisponível', () => {
    const next = { id: 'p', doc: { slides: [
      { id: 's1', title: 'A2', bgImage: null, bgImageId: null, bgImageFailed: true, bgImageError: 'stored_image_missing' },
      { id: 's2', title: 'B', bgImage: null, bgImageId: null, bgImageFailed: true, bgImageError: 'hydrate_timeout',
        logoImage: null, logoImageId: null, logoImageFailed: true, logoImageError: 'stored_image_missing' },
      { id: 's3', title: 'C' },
    ] } };
    const result = preserveDroppedMediaReferences(previous, next);
    expect(result.restored).toEqual([
      { slideId: 's1', field: 'bgImageAssetId', assetId: 'original_chunks_aaa' },
      { slideId: 's2', field: 'bgImageAssetId', assetId: 'original_chunks_bbb' },
      { slideId: 's2', field: 'logoImageAssetId', assetId: 'logo_1' },
    ]);
    expect(result.entry.doc.slides[0]).toMatchObject({
      title: 'A2', bgImageAssetId: 'original_chunks_aaa', bgImageFailed: false, bgImageError: null, bgImageId: null,
    });
    expect(result.entry.doc.slides[1]).toMatchObject({ bgImageAssetId: 'original_chunks_bbb', logoImageAssetId: 'logo_1' });
    expect(result.entry.doc.slides[2]).toBe(next.doc.slides[2]);
    expect(next.doc.slides[0].bgImageAssetId).toBeUndefined();
  });

  it('respeita remoção intencional, troca por outra foto e cards novos', () => {
    const next = { id: 'p', doc: { slides: [
      { id: 's1', bgImage: null, bgImageId: null, bgImageFailed: false, bgImageError: null, bgImageSource: null },
      { id: 's2', bgImageId: 'img_new', bgImageFailed: true, bgImageError: 'generation_failed' },
      { id: 's4', bgImageFailed: true },
    ] } };
    const result = preserveDroppedMediaReferences(previous, next);
    expect(result.restored).toEqual([]);
    expect(result.entry).toBe(next);
  });

  it('preserva referências múltiplas omitidas e o assetId de uma referência conhecida', () => {
    const previousRefs = structuredClone(previous);
    previousRefs.doc.slides[0].imageReferences = [
      { id:'product', name:'Produto', mention:'produto', assetId:'original_ref_product' },
      { id:'room', name:'Ambiente', mention:'ambiente', assetId:'original_ref_room' },
    ];
    const next = { id:'p', doc:{ slides:[{
      id:'s1', title:'A2', imageReferences:[
        { id:'product', name:'Produto novo', mention:'produto' },
      ],
    }] } };
    const result = preserveDroppedMediaReferences(previousRefs, next);
    expect(result.entry.doc.slides[0].imageReferences).toEqual([
      { id:'product', name:'Produto novo', mention:'produto', assetId:'original_ref_product' },
      { id:'room', name:'Ambiente', mention:'ambiente', assetId:'original_ref_room' },
    ]);
    expect(result.restored).toEqual([
      { slideId:'s1', field:'imageReferences', assetId:'original_ref_product' },
      { slideId:'s1', field:'imageReferences', assetId:'original_ref_room' },
    ]);
  });

  it('aceita remoção explícita de referências e consome o marcador de uma gravação', () => {
    const previousRefs = structuredClone(previous);
    previousRefs.doc.slides[0].imageReferences = [
      { id:'product', name:'Produto', mention:'produto', assetId:'original_ref_product' },
      { id:'room', name:'Ambiente', mention:'ambiente', assetId:'original_ref_room' },
    ];
    const next = { id:'p', doc:{ slides:[{
      id:'s1', title:'A2', imageReferences:[],
      removedImageReferenceIds:['product', 'original_ref_room'],
    }] } };
    const result = preserveDroppedMediaReferences(previousRefs, next);
    expect(result.entry.doc.slides[0].imageReferences).toEqual([]);
    expect(result.entry.doc.slides[0].removedImageReferenceIds).toBeUndefined();
    expect(result.restored).toEqual([]);
  });

  it('não altera um asset já presente nem entradas sem slides', () => {
    const next = { id: 'p', doc: { slides: [{ id: 's1', bgImageAssetId: 'original_chunks_ccc', bgImageFailed: true }] } };
    expect(preserveDroppedMediaReferences(previous, next).entry).toBe(next);
    expect(preserveDroppedMediaReferences(null, next).entry).toBe(next);
    expect(preserveDroppedMediaReferences(previous, { id: 'p', name: 'sem doc' }).restored).toEqual([]);
  });
});
