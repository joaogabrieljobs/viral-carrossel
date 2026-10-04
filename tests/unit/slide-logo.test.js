import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/utils/image-store.js', async importOriginal => ({ ...(await importOriginal()), imagePut: vi.fn().mockResolvedValue(undefined), imagemComoDataUrl: vi.fn() }));
import { imagePut, imagemComoDataUrl, semImagensDeRuntime, idsDeImagemEmUso } from '../../src/utils/image-store.js';
import {
  brandWithSlideLogo,
  resolveLogoControls,
  storeSlideLogo,
  exportSlideLogo,
  importSlideLogo,
  exportBrandLogo,
  importBrandLogo,
  resolveLogoDataUrl,
  applyLogoAssetToSlides,
  applyGenerationLogoPolicy,
} from '../../src/utils/slide-logo.js';
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
    expect(brandWithSlideLogo(brand, { logoImageId: 'local' }).logo).toBeNull();
    expect(brandWithSlideLogo(brand, { logoHidden: true }).logo).toBeNull();
    expect(brand.logo).toBe('global.png');
  });
  it('aplica uma logo somente nos cards selecionados sem alterar a marca global', () => {
    const brand = { logo: 'brand-a.png', logoImageId: 'brand-a' };
    const slides = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const result = applyLogoAssetToSlides(slides, {
      ids: ['b'],
      logoImageId: 'project-b',
      logoImage: 'blob:project-b',
      hideUnselected: false,
    });
    expect(brand).toEqual({ logo: 'brand-a.png', logoImageId: 'brand-a' });
    expect(result[0]).toBe(slides[0]);
    expect(result[1]).toMatchObject({ logoImageId: 'project-b', logoImage: 'blob:project-b', logoHidden: false });
    expect(result[2]).toBe(slides[2]);
    expect(brandWithSlideLogo(brand, result[0]).logo).toBe('brand-a.png');
    expect(brandWithSlideLogo(brand, result[1]).logo).toBe('blob:project-b');
  });
  it('respeita “não aplicar nos novos cards” e mantém logo de projeto como camada', () => {
    const slides = [{ id: 'a' }, { id: 'b', logoHidden: false }];
    expect(applyGenerationLogoPolicy(slides, {
      enabled: false,
      hasBrandLogo: true,
    }).every((slide) => slide.logoHidden)).toBe(true);

    const project = applyGenerationLogoPolicy(slides, {
      enabled: true,
      hasBrandLogo: true,
      projectLogoAsset: { logoImageId: 'project-b', logoImage: 'blob:project-b' },
    });
    expect(project.every((slide) => slide.logoImageId === 'project-b' && slide.logoHidden === false)).toBe(true);
  });
  it('resolveLogoControls alinha UI e render quando o card ainda não gravou posição', () => {
    const brand = { logoPosition: 'bl', logoSize: 50, logoOpacity: 51 };
    expect(resolveLogoControls(brand, {})).toEqual({ logoPosition: 'bl', logoSize: 50, logoOpacity: 51 });
    expect(resolveLogoControls(brand, { logoPosition: 'tr', logoSize: 200, logoOpacity: 100 })).toEqual({ logoPosition: 'tr', logoSize: 200, logoOpacity: 100 });
  });
  it('logo específica do projeto tem prioridade sobre a logo do perfil', async () => {
    imagemComoDataUrl.mockResolvedValue('data:image/png;base64,PROJETO');
    await expect(resolveLogoDataUrl(
      { logo: 'data:image/png;base64,MARCA', logoImageId: 'marca' },
      { logo: { imageId: 'projeto' } },
    )).resolves.toBe('data:image/png;base64,PROJETO');
    expect(imagemComoDataUrl).toHaveBeenLastCalledWith('projeto');
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
  it('backup da logo global troca o ID local por PNG portátil e recria o ID ao importar', async () => {
    imagemComoDataUrl.mockResolvedValue(`data:image/png;base64,${PNG}`);
    const exported = await exportBrandLogo({ id: 'musa', logoImageId: 'logo-local', logo: 'blob:local' });
    expect(exported.logoImageId).toBeUndefined();
    expect(exported.logo).toMatch(/^data:image\/png;base64,/);
    const restored = await importBrandLogo(exported);
    expect(restored.logoImageId).toMatch(/^img_/);
    expect(restored.logoImageId).not.toBe('logo-local');
    expect(restored.logo).toMatch(/^blob:/);
    URL.revokeObjectURL(restored.logo);
  });
});
