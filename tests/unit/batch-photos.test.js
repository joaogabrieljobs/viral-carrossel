import { describe, it, expect } from 'vitest';
import { applyBatchPhotosToSlides, summarizeBatchPhotoImport, validateImportedPhotoFile } from '../../src/utils/batch-photos.js';

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
    // patch vazio não apaga foto existente
    const kept = applyBatchPhotosToSlides(
      [{ title: 'A', bgImage: 'keep', bgImageId: 'k1' }],
      [{ bgImage: null, bgImageId: null }],
      mkSlide,
      null,
    );
    expect(kept[0].bgImage).toBe('keep');
    expect(kept[0].bgImageId).toBe('k1');
    expect(next).toHaveLength(3);
    expect(next[0].bgImage).toBe('x');
    expect(next[1].title).toBe('T2');
  });

  it('preserva a posição do arquivo quando um item do lote é recusado', () => {
    const slides = [mkSlide(1), mkSlide(2), mkSlide(3)];
    const next = applyBatchPhotosToSlides(
      slides,
      [null, null, { bgImage:'valid-third', bgImageId:'third' }],
      mkSlide,
      null,
    );
    expect(next[0].title).toBe('T1');
    expect(next[1].title).toBe('T2');
    expect(next[2].bgImage).toBe('valid-third');
  });
});

describe('summarizeBatchPhotoImport', () => {
  it('explica criação de cards novos', () => {
    const s = summarizeBatchPhotoImport({ applied: 8, created: 7, leftoverSlides: 0, skippedNulls: 0 });
    expect(s.tone).toBe('success');
    expect(s.message).toMatch(/7/);
  });

  it('avisa quantos arquivos foram recusados em PT-BR', () => {
    const summary = summarizeBatchPhotoImport({
      applied:1,
      created:0,
      leftoverSlides:1,
      skippedNulls:2,
      rejected:2,
      rejectedFiles:['video.mp4', 'brief.pdf'],
    });
    expect(summary.tone).toBe('warning');
    expect(summary.message).toContain('2 arquivos recusados');
    expect(summary.message).toContain('video.mp4');
    expect(summary.message).toContain('brief.pdf');
    expect(summary.message).not.toContain('ficheiro');
  });
});

describe('validateImportedPhotoFile', () => {
  const file = (type, bytes) => ({ type, arrayBuffer:async () => Uint8Array.from(bytes).buffer });
  it('aceita assinaturas PNG, JPEG e WebP', async () => {
    await expect(validateImportedPhotoFile(file('image/png', [137,80,78,71,13,10,26,10]))).resolves.toMatchObject({ valid:true });
    await expect(validateImportedPhotoFile(file('image/jpeg', [255,216,255,224]))).resolves.toMatchObject({ valid:true });
    await expect(validateImportedPhotoFile(file('image/webp', [82,73,70,70,0,0,0,0,87,69,66,80]))).resolves.toMatchObject({ valid:true });
  });
  it('recusa vídeo, PDF, HEIC e MIME disfarçado', async () => {
    for (const candidate of [
      file('video/mp4', [0,0,0,24]), file('application/pdf', [37,80,68,70]),
      file('image/heic', [0,0,0,24]), file('image/png', [37,80,68,70]),
    ]) {
      await expect(validateImportedPhotoFile(candidate)).resolves.toMatchObject({ valid:false });
    }
  });
});
