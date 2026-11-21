import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from '../../src/utils/export-helpers.js';

// MOO-27 (auditoria 20/11): no celular, fechar a folha de compartilhar era
// anunciado como "baixado". downloadBlob agora diz se o arquivo foi entregue.
function phoneWithShare(share) {
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', share, canShare: () => true, maxTouchPoints: 5 });
}
afterEach(() => vi.unstubAllGlobals());

describe('MOO-27 — download pela folha de compartilhar', () => {
  it('pessoa fecha a folha: downloadBlob devolve false', async () => {
    phoneWithShare(vi.fn().mockRejectedValue(Object.assign(new Error('cancelado'), { name: 'AbortError' })));
    await expect(downloadBlob(new Blob(['x'], { type: 'image/png' }), 'card.png')).resolves.toBe(false);
  });

  it('pessoa compartilha/salva: downloadBlob devolve true', async () => {
    phoneWithShare(vi.fn().mockResolvedValue(undefined));
    await expect(downloadBlob(new Blob(['x'], { type: 'image/png' }), 'card.png')).resolves.toBe(true);
  });
});
