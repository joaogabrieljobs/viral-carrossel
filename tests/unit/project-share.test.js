import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeDocForShare, packDocWithImagesForShare } from '../../src/utils/project-share.js';

vi.mock('../../src/utils/image-store.js', () => ({
  imagemComoDataUrl: vi.fn(async (id) => (id === 'id1' ? 'data:image/png;base64,AAAA' : null)),
  guardarImagemDoSlide: vi.fn(async () => ({ bgImage: 'blob:x', bgImageId: 'new1' })),
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
});
