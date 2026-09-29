import { it, expect, vi, afterEach } from 'vitest';
import { lsSet } from '../../src/utils/storage.js';
afterEach(() => vi.unstubAllGlobals());
it('quota não remove a única cópia de uma imagem nem o moodboard legado', () => {
  const setItem = vi.fn().mockImplementationOnce(() => { throw new DOMException('full', 'QuotaExceededError'); });
  vi.stubGlobal('localStorage', { setItem });
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  const image = 'data:image/png;base64,YQ==';
  lsSet('vc_library', [{ doc: { slides: [{ bgImage: image }, { bgImage: image, bgImageId: 'saved' }], styleKit: { refImages: [{ dataUrl: image }] } } }]);
  const saved = JSON.parse(setItem.mock.calls[1][1])[0].doc;
  expect(saved.slides[0].bgImage).toBe(image);
  expect(saved.slides[1].bgImage).toBeUndefined();
  expect(saved.styleKit.refImages[0].dataUrl).toBe(image);
});
