import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/utils/image-store.js', async importOriginal => ({ ...(await importOriginal()), imagePut: vi.fn().mockResolvedValue(undefined), imagemComoDataUrl: vi.fn() }));
import { imagePut, imagemComoDataUrl, semImagensDeRuntime, idsDeImagemEmUso } from '../../src/utils/image-store.js';
import { brandWithSlideLogo, resolveLogoControls, storeSlideLogo, exportSlideLogo, importSlideLogo } from '../../src/utils/slide-logo.js';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

describe('logo por card', () => {
  it('guarda os bytes PNG originais e rejeita JPEG/arquivo falso', async () => {
    const file = new Blob([Buffer.from(PNG, 'base64')], { type: 'image/png' });
    const result = await storeSlideLogo(file);
    expect(imagePut).toHaveBeenLastCalledWith(result.logoImageId, file);
    expect(await imagePut.mock.calls.at(-1)[1].arrayBuffer()).toEqual(await file.arrayBuffer());
    URL.revokeObjectURL(result.logoImage);
    await expect(storeSlideLogo(new Blob(['jpeg'], { type: 'image/jpeg' }))).rejects.toThrow('PNG');
    await expect(storeSlideLogo(new Blob(['fake'], { type: 'image/png' }))).rejects.toThrow('válido');
  });
  it('troca a logo somente quando há override no card; permite esconder e herdar marca', () => {
    const brand = { logo: 'global.png', logoSize: 40, logoPosition: 'br', logoOpacity: 70 };
    expect(brandWithSlideLogo(brand, {})).toBe(brand);
    expect(brandWithSlideLogo(brand, { logoImageId: 'local', logoImage: 'blob:local', logoSize: 90 })).toMatchObject({ logo: 'blob:local', logoSize: 90, logoOpacity: 70, logoPosition: 'br' });
    expect(brandWithSlideLogo(brand, { logoHidden: true }).logo).toBeNull();
    expect(brand.logo).toBe('global.png');
  });
  it('resolveLogoControls alinha UI e render quando o card ainda não gravou posição', () => {
    const brand = { logoPosition: 'bl', logoSize: 50, logoOpacity: 51 };
    expect(resolveLogoControls(brand, {})).toEqual({ logoPosition: 'bl', logoSize: 50, logoOpacity: 51 });
    expect(resolveLogoControls(brand, { logoPosition: 'tr', logoSize: 200, logoOpacity: 100 })).toEqual({ logoPosition: 'tr', logoSize: 200, logoOpacity: 100 });
  });
  it('não grava bytes em localStorage e protege o ID contra limpeza de órfãos', () => {
    const lib = [{ doc: { slides: [{ logoImageId: 'logo1', logoImage: 'blob:runtime' }, { title: 'outro' }] } }];
    expect(idsDeImagemEmUso(lib)).toContain('logo1');
    expect(semImagensDeRuntime(lib)[0].doc.slides[0]).toEqual({ logoImageId: 'logo1' });
  });
  it('backup é portátil e a importação cria um ID independente', async () => {
    imagemComoDataUrl.mockResolvedValue(`data:image/png;base64,${PNG}`);
    const exported = await exportSlideLogo({ logoImageId: 'original', logoImage: 'blob:runtime', title: 'Card' });
    expect(exported.logoImageId).toBeUndefined();
    const restored = await importSlideLogo(exported);
    expect(restored.logoImageId).not.toBe('original');
    expect(restored.title).toBe('Card');
    URL.revokeObjectURL(restored.logoImage);
  });
});
