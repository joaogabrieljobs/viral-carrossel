import { describe, expect, it } from 'vitest';
import { mergeGeneratedSlidesWithConcurrentMedia } from '../../src/utils/generation-media-merge.js';

describe('mergeGeneratedSlidesWithConcurrentMedia', () => {
  it('preserva só a foto importada durante a geração de texto', () => {
    const snapshot = [
      { id:'old-1', title:'Antes 1', bgImage:null, bgImageId:null },
      { id:'old-2', title:'Antes 2', bgImage:null, bgImageId:null },
    ];
    const current = [
      { ...snapshot[0], bgImage:'data:image/png;base64,manual', bgImageId:'manual-1', bgImageSource:'imported', bgX:72 },
      snapshot[1],
    ];
    const generated = [
      { id:'new-1', title:'Texto novo 1', bgImage:null, bgImageId:null, imageQuery:'image one' },
      { id:'new-2', title:'Texto novo 2', bgImage:null, bgImageId:null, imageQuery:'image two' },
    ];
    const merged = mergeGeneratedSlidesWithConcurrentMedia(generated, snapshot, current);
    expect(merged.slides[0]).toMatchObject({ id:'old-1', title:'Texto novo 1', bgImageId:'manual-1', bgImageSource:'imported', bgX:72 });
    expect(merged.slides[1]).toEqual(generated[1]);
    expect([...merged.protectedSlideIds]).toEqual(['old-1']);
  });

  it('não mantém foto antiga quando ela não mudou após confirmar a substituição', () => {
    const snapshot = [{ id:'old-1', bgImageId:'old-photo' }];
    const generated = [{ id:'new-1', title:'Texto novo', bgImage:null, bgImageId:null }];
    const merged = mergeGeneratedSlidesWithConcurrentMedia(generated, snapshot, [{ ...snapshot[0] }]);
    expect(merged.slides).toEqual(generated);
    expect(merged.protectedSlideIds.size).toBe(0);
  });

  it('não confunde hidratação tardia do mesmo asset com importação manual', () => {
    const snapshot = [{ id:'old-1', bgImageAssetId:'asset-1', bgImage:null, bgImageId:null }];
    const current = [{ ...snapshot[0], bgImage:'blob:hydrated', bgImageId:'local-cache-1' }];
    const generated = [{ id:'new-1', title:'Texto novo', bgImage:null, bgImageId:null }];
    const merged = mergeGeneratedSlidesWithConcurrentMedia(generated, snapshot, current);
    expect(merged.slides).toEqual(generated);
    expect(merged.protectedSlideIds.size).toBe(0);
  });

  it('protege a substituição manual mesmo antes de limpar o asset remoto antigo', () => {
    const snapshot = [{ id:'old-1', bgImageAssetId:'asset-1', bgImage:'blob:old', bgImageId:'local-old', bgImageSource:'imported' }];
    const current = [{ ...snapshot[0], bgImage:'blob:new', bgImageId:'local-new' }];
    const generated = [{ id:'new-1', title:'Texto novo', bgImage:null, bgImageId:null }];
    const merged = mergeGeneratedSlidesWithConcurrentMedia(generated, snapshot, current);
    expect(merged.slides[0]).toMatchObject({ id:'old-1', bgImage:'blob:new', bgImageId:'local-new' });
    expect([...merged.protectedSlideIds]).toEqual(['old-1']);
  });
});
