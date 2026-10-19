import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  applyLogoLayoutToSlides,
  applyGenerationLogoPolicy,
  brandLogoInsertPatch,
  logoImportControls,
  LOGO_SIZE_IMPORT,
  LOGO_SIZE_MAX,
  clearLogoOffsetOnSlide,
  projectLogoFromStored,
  LOGO_INLINE_MAX_BYTES,
  resolveLogoAssetSource,
  logoContainHitRect,
  classifyLogoPixels,
  logoToneForSurface,
} from '../../src/utils/slide-logo.js';
import { exportProjectReferences, migrateProjectReferences } from '../../src/utils/style-kit-storage.js';
import { normalizeStyleKit } from '../../src/utils/style-kit.js';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

beforeEach(() => {
  imagePut.mockReset().mockResolvedValue(undefined);
  imagemComoDataUrl.mockReset();
  vi.stubGlobal('FileReader', class {
    readAsDataURL(blob) {
      blob.arrayBuffer().then((bytes) => {
        this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;
        this.onload?.();
      });
    }
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('logo por card', () => {
  it('guarda os bytes PNG originais e rejeita JPEG/arquivo falso', async () => {
    const file = new Blob([Buffer.from(PNG, 'base64')], { type: 'image/png' });
    const result = await storeSlideLogo(file);
    expect(imagePut).toHaveBeenLastCalledWith(result.logoImageId, file);
    expect(await imagePut.mock.calls.at(-1)[1].arrayBuffer()).toEqual(await file.arrayBuffer());
    URL.revokeObjectURL(result.logoImage);
    await expect(storeSlideLogo(new Blob(['jpeg'], { type: 'image/jpeg' }))).rejects.toThrow(/PNG/i);
    await expect(storeSlideLogo(new Blob(['fake'], { type: 'image/png' }))).rejects.toThrow('válido');
  });
  it('PNG pequeno continua portátil quando IndexedDB não responde, inclusive após backup e reload', async () => {
    imagePut.mockRejectedValue(new Error('openDB timeout (8000ms)'));
    const stored = await storeSlideLogo(new Blob([Buffer.from(PNG, 'base64')], { type: 'image/png' }));
    expect(stored).toMatchObject({ logoImageId: null, logoImage: `data:image/png;base64,${PNG}` });
    const slides = applyLogoAssetToSlides([{ id: 'a', logoImageId: 'old', logoImage: 'blob:old' }], stored);
    const kit = normalizeStyleKit({ logo: projectLogoFromStored(stored, 'Marca.png') });
    const brand = { logo: stored.logoImage, logoImageId: stored.logoImageId };
    const reloaded = JSON.parse(JSON.stringify(semImagensDeRuntime([{ doc: { slides, brand, styleKit: kit } }])))[0].doc;
    expect(reloaded.slides[0].logoImageId).toBeNull();
    expect(reloaded.slides[0].logoImage).toBe(stored.logoImage);
    expect(reloaded.brand.logo).toBe(stored.logoImage);
    expect(reloaded.styleKit.logo.dataUrl).toBe(stored.logoImage);
    expect(brandWithSlideLogo({}, reloaded.slides[0]).logo).toBe(stored.logoImage);
    expect((await exportSlideLogo(reloaded.slides[0])).logoImage).toBe(stored.logoImage);
    expect((await importSlideLogo(reloaded.slides[0])).logoImage).toBe(stored.logoImage);
    expect((await exportBrandLogo(reloaded.brand)).logo).toBe(stored.logoImage);
    expect((await importBrandLogo(reloaded.brand)).logo).toBe(stored.logoImage);
    const portableKit = await exportProjectReferences(reloaded.styleKit);
    expect((await migrateProjectReferences(portableKit)).logo.dataUrl).toBe(stored.logoImage);
    expect(imagemComoDataUrl).not.toHaveBeenCalled();
  });
  it('arquivo grande com IndexedDB indisponível recebe orientação e nunca um ID falso', async () => {
    imagePut.mockRejectedValue(new Error('blocked'));
    const file = new Blob([Buffer.from(PNG, 'base64'), new Uint8Array(LOGO_INLINE_MAX_BYTES)], { type: 'image/png' });
    await expect(storeSlideLogo(file)).rejects.toThrow(/PNG de até 256 KB/);
  });
  it('ao replicar, mantém o ID e a imagem da mesma origem', () => {
    const brand = { logoImageId: 'brand-id', logo: 'blob:brand' };
    const kit = { logo: { imageId: 'project-id' } };
    const portable = `data:image/png;base64,${PNG}`;
    expect(resolveLogoAssetSource(brand, kit, { logoImage: portable })).toEqual({
      source: 'slide', logoImageId: null, logoImage: portable,
    });
    expect(resolveLogoAssetSource(brand, { logo: { dataUrl: portable } })).toEqual({
      source: 'project', logoImageId: null, logoImage: portable,
    });
    expect(resolveLogoAssetSource(brand, { logo: { dataUrl: portable } }, { logoImageId: 'slide-id' })).toEqual({
      source: 'slide', logoImageId: 'slide-id', logoImage: null,
    });
    expect(resolveLogoAssetSource(brand)).toEqual({ source: 'brand', logoImageId: 'brand-id', logoImage: 'blob:brand' });
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
  it('replica posição, tamanho, opacidade e arrasto livre do card atual', () => {
    const slides = [
      { id: 'a', elementOffsets: { logo: { x: 17, y: -9 }, title: { x: 2, y: 3 } }, logoPosition: 'bl', logoSize: 280, logoOpacity: 64 },
      { id: 'b', elementOffsets: { logo: { x: -5, y: 8 }, title: { x: 4, y: 5 } }, logoPosition: 'tr', logoSize: 90 },
    ];
    const result = applyLogoLayoutToSlides(slides, { sourceSlide: slides[0], brand: {}, ids: null });
    expect(result[1]).toMatchObject({ logoPosition: 'bl', logoSize: 280, logoOpacity: 64, logoHidden: false });
    expect(result[1].elementOffsets.logo).toEqual({ x: 17, y: -9 });
    expect(result[1].elementOffsets.title).toEqual({ x: 4, y: 5 });
    expect(result[1].elementOffsets.logo).not.toBe(slides[0].elementOffsets.logo);
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
  it('import força tamanho legível e não herda logoSize minúsculo', () => {
    expect(logoImportControls({ logoSize: 40 }).logoSize).toBe(LOGO_SIZE_IMPORT);
    expect(brandLogoInsertPatch('blob:x', { logoSize: 80 }).logoSize).toBe(LOGO_SIZE_IMPORT);
    expect(LOGO_SIZE_MAX).toBeGreaterThanOrEqual(900);
    const cleared = clearLogoOffsetOnSlide({
      elementOffsets: { logo: { x: -40, y: 10 }, title: { x: 1, y: 0 } },
    });
    expect(cleared.elementOffsets.logo).toBeUndefined();
    expect(cleared.elementOffsets.title).toEqual({ x: 1, y: 0 });
  });
  it('a caixa da logo segue o desenho e não o quadrado vazio', () => {
    const wide = logoContainHitRect(400, 800, 120);
    expect(wide.width).toBeGreaterThan(wide.height * 3);
    expect(wide.height).toBeLessThan(120);
    expect(wide.top).toBeGreaterThan(100);
    const ink = logoContainHitRect(400, 400, 400, { x: 0.1, y: 0.05, w: 0.8, h: 0.2 });
    expect(ink.height).toBeLessThan(120);
    expect(ink.top).toBeLessThan(80);
    expect(ink.width).toBeLessThan(400);
  });
});

describe('logo no grafite', () => {
  function pixels(width, height, paint) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const [r, g, b, a] = paint(x, y);
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      }
    }
    return data;
  }

  it('tira a placa branca e deixa o desenho', () => {
    const plate = pixels(8, 8, (x, y) => (
      x >= 3 && x <= 4 && y >= 3 && y <= 4 ? [20, 20, 20, 255] : [255, 255, 255, 255]
    ));
    expect(classifyLogoPixels(plate)).toMatchObject({ hide: false, punchWhite: true });
    const blank = pixels(8, 8, () => [255, 255, 255, 255]);
    expect(classifyLogoPixels(blank).hide).toBe(true);
  });

  it('clareia logo escura no grafite e preserva logo colorida', () => {
    expect(logoToneForSurface(0.08, 0, '#1c1c1c')).toBe('light');
    expect(logoToneForSurface(0.45, 0.4, '#1c1c1c')).toBe('original');
    const mark = pixels(8, 8, (x, y) => (
      x === 2 && y === 2 ? [10, 10, 10, 255] : [0, 0, 0, 0]
    ));
    expect(classifyLogoPixels(mark)).toMatchObject({ hide: false, punchWhite: false });
  });
});
