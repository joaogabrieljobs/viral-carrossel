import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sanitizeDocForShare,
  packDocWithImagesForShare,
  hydrateSharedDocImages,
  normalizeShareCode,
  buildTeamShareInviteUrl,
  stashPendingShareCode,
  peekPendingShareCode,
  consumePendingShareCode,
  readShareCodeFromSearch,
  PENDING_SHARE_KEY,
} from '../../src/utils/project-share.js';

vi.mock('../../src/utils/image-store.js', () => ({
  imagemComoDataUrl: vi.fn(async (id) => (id === 'id1' ? 'data:image/png;base64,AAAA' : null)),
  guardarImagemDoSlide: vi.fn(async () => ({ bgImage: 'blob:x', bgImageId: 'new1' })),
  imagePut: vi.fn(async () => undefined),
  imageGet: vi.fn(async (id) => id === 'id1'
    ? { blob: new Blob([Buffer.from('AAAA', 'base64')], { type: 'image/png' }) } : null),
  newImageId: vi.fn(() => 'new-reference-id'),
  dataUrlParaBlob: (src) => new Blob([Buffer.from(src.split(',')[1], 'base64')], { type: 'image/png' }),
  blobParaDataUrl: async (blob) => `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`,
}));

vi.mock('../../src/utils/slide-logo.js', () => ({
  exportSlideLogo: vi.fn(async (s) => s),
  importSlideLogo: vi.fn(async (s) => s),
  exportBrandLogo: vi.fn(async (b) => b),
  importBrandLogo: vi.fn(async (b) => b),
}));

vi.mock('../../src/utils/style-kit-storage.js', () => ({
  exportProjectReferences: vi.fn(async (k) => k),
  migrateProjectReferences: vi.fn(async (k) => k),
}));

describe('sanitizeDocForShare', () => {
  it('remove blob: runtime e mantém data URL já embutida', () => {
    const clean = sanitizeDocForShare({
      caption: 'Legenda ok',
      slides: [
        {
          title: 'A',
          subtitle: 'B',
          bodyAfterImage: 'CTA',
          bgImage: 'data:image/png;base64,AAAA',
          bgImageId: 'id1',
        },
        {
          title: 'B',
          bgImage: 'blob:http://localhost/x',
        },
      ],
      brand: { name: 'Marca', logo: 'blob:y' },
    });
    expect(clean.caption).toBe('Legenda ok');
    expect(clean.slides[0].bgImage).toMatch(/^data:image/);
    expect(clean.slides[1].bgImage).toBeNull();
    expect(clean.brand.logo).toBeNull();
  });
});

describe('packDocWithImagesForShare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('embute foto a partir do IndexedDB (bgImageId)', async () => {
    const { doc, packedImages } = await packDocWithImagesForShare({
      slides: [{ title: 'A', bgImage: null, bgImageId: 'id1' }],
      brand: { name: 'X' },
    });
    expect(packedImages).toBe(1);
    expect(doc.slides[0].bgImage).toBe('data:image/png;base64,AAAA');
    expect(doc.shareMeta.includesImages).toBe(true);
  });

  it('não reduz a foto que já tem id na nuvem; a outra conta lê o original', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { doc, packedImages } = await packDocWithImagesForShare({
      slides: [{ title: 'A', bgImage: 'data:image/jpeg;base64,LOW', bgImageAssetId: 'photo-1' }],
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(packedImages).toBe(0);
    expect(doc.slides[0].bgImage).toBeNull();
    expect(doc.slides[0].bgImageAssetId).toBe('photo-1');
    vi.unstubAllGlobals();
  });

  it('mantém o id da nuvem quando a foto não cabe no pedido', async () => {
    const huge = `data:image/png;base64,${'A'.repeat(2_000_000)}`;
    const { doc, imagesOmitted } = await packDocWithImagesForShare({
      slides: [
        { title: 'A', bgImage: huge, bgImageAssetId: 'photo-a' },
        { title: 'B', bgImage: huge, bgImageAssetId: 'photo-b' },
      ],
    });
    expect(doc.slides.map((slide) => slide.bgImageAssetId)).toEqual(['photo-a', 'photo-b']);
    expect(doc.slides.every((slide) => !String(slide.bgImage || '').startsWith('data:'))).toBe(true);
  });

  it('mantém o id mesmo das fotos retiradas para o pedido caber', async () => {
    const medium = `data:image/jpeg;base64,${'B'.repeat(200_000)}`;
    const slides = Array.from({ length: 16 }, (_, index) => ({
      title: `Card ${index}`,
      bgImage: medium,
      bgImageAssetId: `photo-${index}`,
    }));
    const { doc } = await packDocWithImagesForShare({ slides });
    expect(doc.slides.every((slide) => slide.bgImage == null)).toBe(true);
    expect(doc.slides.map((slide) => slide.bgImageAssetId)).toEqual(slides.map((slide) => slide.bgImageAssetId));
  });

  it('quem entra pelo código lê a foto do dono e não guarda o id da outra conta', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      expect(href).toContain('/api/project-share?');
      expect(href).toContain('code=AB12CD34');
      expect(href).toContain('asset=photo-1');
      return {
        ok: true,
        text: async () => JSON.stringify({ asset: { dataUrl: 'data:image/png;base64,BBBB' } }),
      };
    }));
    const imported = await hydrateSharedDocImages({
      slides: [{ id: 's1', title: 'Equipa', bgImage: null, bgImageAssetId: 'photo-1' }],
    }, { code: 'AB12CD34' });
    expect(imported.slides[0]).toMatchObject({
      bgImage: 'blob:x',
      bgImageId: 'new1',
      title: 'Equipa',
    });
    expect(imported.slides[0].bgImageAssetId).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('ignora o JPEG reduzido do envio quando o original ainda tem id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ asset: { dataUrl: 'data:image/png;base64,FULL' } }),
    })));
    const imported = await hydrateSharedDocImages({
      slides: [{ id: 's1', bgImage: 'data:image/jpeg;base64,LOW', bgImageAssetId: 'photo-1' }],
    }, { code: 'AB12CD34' });
    expect(imported.slides[0].bgImage).toBe('blob:x');
    expect(String(fetch.mock.calls[0][0])).toContain('asset=photo-1');
    vi.unstubAllGlobals();
  });

  it('omite fotos se o payload ficar enorme (limite serverless)', async () => {
    const huge = `data:image/png;base64,${'A'.repeat(2_000_000)}`;
    const { doc, packedImages, imagesOmitted } = await packDocWithImagesForShare({
      slides: [
        { title: 'A', bgImage: huge },
        { title: 'B', bgImage: huge },
      ],
      brand: { name: 'X' },
    });
    expect(packedImages).toBe(0);
    expect(imagesOmitted).toBeGreaterThan(0);
    expect(doc.slides.every((s) => !s.bgImage)).toBe(true);
    expect(JSON.stringify(doc).length).toBeLessThan(2_800_000);
  });

  it('partilha embute os bytes da referência e importa um ID novo independente da conta original', async () => {
    const { doc } = await packDocWithImagesForShare({ slides: [{
      id: 's1', title: 'Direção com referência', refImageId: 'id1', refImageAssetId: 'remote-original',
      imgExtraPrompt: 'Preserve a composição.',
    }] });
    expect(doc.slides[0].refImage).toBe('data:image/png;base64,AAAA');
    expect(doc.slides[0].refImageId).toBeUndefined();
    expect(doc.slides[0].refImageAssetId).toBeUndefined();
    const imported = await hydrateSharedDocImages(doc);
    expect(imported.slides[0]).toMatchObject({
      refImage: null, refImageId: 'new-reference-id', imgExtraPrompt: 'Preserve a composição.',
    });
    expect(imported.slides[0].refImageAssetId).toBeFalsy();
  });

  it('partilha não confirma um documento portátil se a referência existir só como ID perdido', async () => {
    await expect(packDocWithImagesForShare({ slides: [{ refImageId: 'missing-reference' }] }))
      .rejects.toThrow(/referência/i);
  });
});

describe('team share invite link', () => {
  beforeEach(() => {
    const session = new Map();
    vi.stubGlobal('sessionStorage', {
      getItem: (k) => (session.has(k) ? session.get(k) : null),
      setItem: (k, v) => { session.set(String(k), String(v)); },
      removeItem: (k) => { session.delete(k); },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normaliza código e monta URL ?share=', () => {
    expect(normalizeShareCode(' ab12-cd34 ')).toBe('AB12CD34');
    expect(normalizeShareCode('xx')).toBe('');
    expect(buildTeamShareInviteUrl('ab12cd34', 'https://viralcarrossel.com.br'))
      .toBe('https://viralcarrossel.com.br/?share=AB12CD34&app=1');
    expect(readShareCodeFromSearch('?share=zz99yy88&utm=1')).toBe('ZZ99YY88');
  });

  it('stash / peek / consume no sessionStorage', () => {
    expect(stashPendingShareCode('hello12')).toBe('HELLO12');
    expect(peekPendingShareCode()).toBe('HELLO12');
    expect(sessionStorage.getItem(PENDING_SHARE_KEY)).toBe('HELLO12');
    expect(consumePendingShareCode()).toBe('HELLO12');
    expect(peekPendingShareCode()).toBe('');
  });
});
