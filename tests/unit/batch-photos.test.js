import { describe, it, expect } from 'vitest';
import { applyBatchPhotosToSlides, summarizeBatchPhotoImport } from '../../src/utils/batch-photos.js';

const mkSlide = (n) => ({ id: `s${n}`, num: n, title: `T${n}`, subtitle: 'sub', bgImage: null });

describe('applyBatchPhotosToSlides', () => {
  it('cria um card por imagem quando só há um slide vazio', () => {
    const slides = [mkSlide(1)];
    const payloads = [
      { bgImage: 'a', bgImageId: 'ida' },
      { bgImage: 'b', bgImageId: 'idb' },
      { bgImage: 'c', bgImageId: 'idc' },
    ];
    const next = applyBatchPhotosToSlides(slides, payloads, mkSlide, null);
    expect(next).toHaveLength(3);
    expect(next.map((s) => s.bgImage)).toEqual(['a', 'b', 'c']);
    expect(next[1].title).toBe('');
    expect(next[2].num).toBe(3);
  });

  it('não ignora fotos extras além do número de cards', () => {
    const slides = [mkSlide(1)];
    const payloads = Array.from({ length: 8 }, (_, i) => ({ bgImage: `u${i}`, bgImageId: `id${i}` }));
    const next = applyBatchPhotosToSlides(slides, payloads, mkSlide, null);
    expect(next).toHaveLength(8);
  });

  it('mantém slides sobrantes quando há menos fotos', () => {
    const slides = [mkSlide(1), mkSlide(2), mkSlide(3)];
    const next = applyBatchPhotosToSlides(slides, [{ bgImage: 'x', bgImageId: 'idx' }], mkSlide, null);
    expect(next).toHaveLength(3);
    expect(next[0].bgImage).toBe('x');
    expect(next[1].title).toBe('T2');
  });
});

describe('summarizeBatchPhotoImport', () => {
  it('explica criação de cards novos', () => {
    const s = summarizeBatchPhotoImport({ applied: 8, created: 7, leftoverSlides: 0, skippedNulls: 0 });
    expect(s.tone).toBe('success');
    expect(s.message).toMatch(/7/);
  });
});
