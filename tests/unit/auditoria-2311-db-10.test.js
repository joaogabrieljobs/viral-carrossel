// DB-10 (auditoria de 23/11): no "Backup completo", o card com foto guardada
// só na conta (sem os bytes neste navegador) saía sem a foto e não entrava na
// contagem do aviso "N slide(s) sem imagem".
// Este arquivo cobre a contagem. Baixar as fotos da conta na hora do backup
// continua pendente.
import { describe, expect, it, vi } from 'vitest';
import { fundoDoSlideParaBackup } from '../../src/hooks/useLibrary.js';

const FOTO = 'data:image/png;base64,Zm90bw==';

describe('DB-10: card com foto só na conta entra na contagem do aviso do backup', () => {
  it('card com foto na conta e sem os bytes neste navegador conta como sem imagem', async () => {
    const ler = vi.fn();
    const slide = { id: 's1', title: 'Capa', bgImageAssetId: 'asset-na-conta' };
    const result = await fundoDoSlideParaBackup(slide, ler);
    expect(result.missing).toBe(true);
    expect(result.slide).toBe(slide);
    expect(ler).not.toHaveBeenCalled();
  });

  it('prévia temporária (blob:) não serve em outro aparelho: também conta', async () => {
    const slide = { id: 's1', bgImageAssetId: 'asset-na-conta', bgImage: 'blob:https://moont.ai/1234' };
    expect((await fundoDoSlideParaBackup(slide, vi.fn())).missing).toBe(true);
  });

  it('card que já carrega a foto embutida não conta', async () => {
    const slide = { id: 's1', bgImageAssetId: 'asset-na-conta', bgImage: FOTO };
    expect(await fundoDoSlideParaBackup(slide, vi.fn())).toEqual({ slide, missing: false });
  });

  it('card sem foto nenhuma não conta', async () => {
    const slide = { id: 's1', title: 'Só texto' };
    expect(await fundoDoSlideParaBackup(slide, vi.fn())).toEqual({ slide, missing: false });
    expect(await fundoDoSlideParaBackup(null, vi.fn())).toEqual({ slide: null, missing: false });
  });

  it('foto guardada neste navegador volta embutida, como antes', async () => {
    const ler = vi.fn(async () => FOTO);
    const slide = { id: 's1', bgImageId: 'img-1', bgImageAssetId: 'asset-na-conta' };
    const result = await fundoDoSlideParaBackup(slide, ler);
    expect(ler).toHaveBeenCalledWith('img-1');
    expect(result).toEqual({ slide: { ...slide, bgImage: FOTO }, missing: false });
  });

  it('foto com identificador mas sem bytes, ou leitura que falha, conta como antes', async () => {
    const slide = { id: 's1', bgImageId: 'img-1' };
    expect(await fundoDoSlideParaBackup(slide, vi.fn(async () => null))).toEqual({ slide, missing: true });
    expect(await fundoDoSlideParaBackup(slide, vi.fn(async () => { throw new Error('IndexedDB'); })))
      .toEqual({ slide, missing: true });
  });
});
