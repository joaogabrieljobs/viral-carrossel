import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../urlSourceFetch.js', () => ({ assertPublicHttpUrl: url => url }));

import { downloadImageAsBase64, sniffImageMime } from '../../api/lib/sjinn.js';

const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(16, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16, 1)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4, 0), Buffer.from('WEBP'), Buffer.alloc(8, 1)]);

function respond(bytes, contentType) {
  return { ok: true, status: 200, headers: { get: () => contentType }, arrayBuffer: async () => bytes };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('sjinn download', () => {
  it('identifica PNG, JPEG e WebP pelos bytes', () => {
    expect(sniffImageMime(PNG)).toBe('image/png');
    expect(sniffImageMime(JPEG)).toBe('image/jpeg');
    expect(sniffImageMime(WEBP)).toBe('image/webp');
    expect(sniffImageMime(Buffer.from('not an image at all'))).toBeNull();
  });

  it('ignora um content-type genérico do CDN quando os bytes são imagem', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respond(PNG, 'application/octet-stream')));
    const result = await downloadImageAsBase64('https://cdn.example/result');
    expect(result).toEqual({ b64_json: PNG.toString('base64'), mime: 'image/png' });
  });

  it('aceita o cabeçalho image/* quando os bytes não têm assinatura conhecida', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respond(Buffer.alloc(20, 7), 'image/avif; charset=binary')));
    expect((await downloadImageAsBase64('https://cdn.example/result')).mime).toBe('image/avif');
  });

  it('recusa um arquivo que não é imagem em vez de gravar um data URL inválido', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respond(Buffer.from('<html>erro</html>'), 'text/html')));
    await expect(downloadImageAsBase64('https://cdn.example/result')).rejects.toMatchObject({ code: 'image_result_invalid' });
  });
});
