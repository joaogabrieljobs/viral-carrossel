import { it, expect, vi, afterEach } from 'vitest';
import { prepareImageReferencesForUpload } from '../../src/utils/image-reference-upload.js';
import { MAX_REFERENCE_BYTES } from '../../shared/image-references.js';

afterEach(() => vi.unstubAllGlobals());
it('mantém ordem de anexos e HTTPS; não trunca um quinto anexo', async () => {
  const refs = ['data:image/png;base64,YQ==', 'https://cdn.example/ref.webp'];
  expect(await prepareImageReferencesForUpload(refs)).toEqual(refs);
  await expect(prepareImageReferencesForUpload(Array(5).fill(refs[0]))).rejects.toMatchObject({ code: 'reference_invalid' });
});
it('reduz a cópia grande sem alterar a referência original', async () => {
  const large = `data:image/png;base64,${Buffer.alloc(MAX_REFERENCE_BYTES + 1000).toString('base64')}`;
  vi.stubGlobal('Image', class {
    naturalWidth = 4000; naturalHeight = 3000;
    set src(_) { queueMicrotask(() => this.onload()); }
  });
  const ctx = { fillRect: vi.fn(), drawImage: vi.fn() };
  const canvas = { getContext: () => ctx, toDataURL: vi.fn().mockReturnValueOnce(large.replace('png', 'jpeg')).mockReturnValue('data:image/jpeg;base64,YQ==') };
  vi.stubGlobal('document', { createElement: () => canvas });
  const refs = [large];
  expect(await prepareImageReferencesForUpload(refs)).toEqual(['data:image/jpeg;base64,YQ==']);
  expect(refs[0]).toBe(large);
  expect(canvas.width).toBe(1536);
  expect(canvas.height).toBe(1152);
  expect(ctx.fillRect).toHaveBeenCalled();
});
