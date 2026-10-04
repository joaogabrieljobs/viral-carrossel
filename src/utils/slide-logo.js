import { imagePut, newImageId, imagemComoDataUrl, dataUrlParaBlob } from './image-store.js';

/** Tamanho em px na escala 1080. */
export const LOGO_SIZE_MIN = 40;
export const LOGO_SIZE_MAX = 480;
export const LOGO_SIZE_DEFAULT = 120;

/**
 * Resolve a URL da logo a inserir em todos os cards. A logo específica do
 * projeto substitui a do perfil de marca; ambas vivem no IndexedDB.
 */
export async function resolveLogoDataUrl(brand = {}, styleKit = {}) {
  if (styleKit?.logo?.dataUrl) return styleKit.logo.dataUrl;
  if (styleKit?.logo?.imageId) return imagemComoDataUrl(styleKit.logo.imageId);
  if (brand?.logo && typeof brand.logo === 'string') return brand.logo;
  if (brand?.logoImageId) return imagemComoDataUrl(brand.logoImageId);
  return null;
}

/** Patch de marca para logo visível em todos os cards (overlay). */
export function brandLogoInsertPatch(logoDataUrl, brand = {}) {
  return {
    logo: logoDataUrl,
    logoSize: brand.logoSize ?? LOGO_SIZE_DEFAULT,
    logoOpacity: brand.logoOpacity ?? 90,
    logoPosition: brand.logoPosition || 'tr',
  };
}

/**
 * Garante que cada slide mostra a logo da marca (desoculta; não apaga override PNG).
 * Usado pelo botão “Inserir logo em todos os cards” e após gerar carrossel.
 * @param {object[]} slides
 * @param {string[]|null} onlyIds — se definido, só estes ids de slide
 */
export function stampLogoVisibleOnSlides(slides = [], onlyIds = null) {
  const filter = onlyIds ? new Set(onlyIds) : null;
  return (slides || []).map((s) => {
    if (filter && !filter.has(s?.id)) return s;
    return s?.logoHidden ? { ...s, logoHidden: false } : s;
  });
}

/**
 * Oculta a logo nos cards (logoHidden). Não remove a logo da marca.
 * @param {object[]} slides
 * @param {string[]|null} onlyIds — se definido, só estes ids; senão todos
 */
export function hideLogoOnSlides(slides = [], onlyIds = null) {
  const filter = onlyIds ? new Set(onlyIds) : null;
  return (slides || []).map((s) => {
    if (filter && !filter.has(s?.id)) return s;
    return s?.logoHidden ? s : { ...s, logoHidden: true };
  });
}

/**
 * Grava uma logo como camada própria do card, sem promover o arquivo para a
 * identidade global da marca. Quando `hideUnselected` está ativo, a operação
 * “só nos selecionados” também impede que a logo herdada apareça nos demais.
 */
export function applyLogoAssetToSlides(slides = [], {
  ids = null,
  logoImageId = null,
  logoImage = null,
  hideUnselected = false,
} = {}) {
  const filter = ids ? new Set(ids) : null;
  return (slides || []).map((slide) => {
    const selected = !filter || filter.has(slide?.id);
    if (!selected) {
      if (!hideUnselected || slide?.logoHidden) return slide;
      return { ...slide, logoHidden: true };
    }
    return {
      ...slide,
      ...(logoImageId ? { logoImageId } : {}),
      ...(logoImage ? { logoImage } : {}),
      logoHidden: false,
    };
  });
}

/** Política única para novos cards: desligado oculta; logo do projeto vira
 * camada por card; logo do perfil continua herdada sem alterar a identidade. */
export function applyGenerationLogoPolicy(slides = [], {
  enabled = true,
  projectLogoAsset = null,
  hasBrandLogo = false,
} = {}) {
  if (!enabled) return hideLogoOnSlides(slides);
  if (projectLogoAsset) return applyLogoAssetToSlides(slides, projectLogoAsset);
  if (hasBrandLogo) return stampLogoVisibleOnSlides(slides);
  return slides;
}

/** Aplica ou remove logo nos ids indicados (Fatia 3 — ações em massa). */
export function applyLogoVisibilityOnSlides(slides = [], { ids = null, hidden = false } = {}) {
  return hidden
    ? hideLogoOnSlides(slides, ids)
    : stampLogoVisibleOnSlides(slides, ids);
}

export async function storeSlideLogo(file) {
  if (file.type !== 'image/png') throw new Error('Escolha uma logo em PNG para preservar a transparência.');
  if (file.size > 2 * 1024 * 1024) throw new Error('A logo deve ter no máximo 2 MB.');
  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if ([137, 80, 78, 71, 13, 10, 26, 10].some((value, i) => signature[i] !== value)) throw new Error('Este arquivo não é um PNG válido.');
  const logoImageId = newImageId();
  await imagePut(logoImageId, file);
  return { logoImageId, logoImage: URL.createObjectURL(file), logoHidden: false };
}

/** Controles efetivos (card override → marca → default). */
export function resolveLogoControls(brand = {}, slide = {}) {
  return {
    logoPosition: slide.logoPosition || brand.logoPosition || 'tr',
    logoSize: slide.logoSize ?? brand.logoSize ?? LOGO_SIZE_DEFAULT,
    logoOpacity: slide.logoOpacity ?? brand.logoOpacity ?? 90,
  };
}

/**
 * Merge marca + overrides do card.
 * - logoHidden: esconde neste card (mantém a marca nos outros)
 * - logoImage / logoImageId: PNG só deste card; enquanto o blob hidrata, não
 *   mostra uma logo global diferente no lugar
 * - logoSize / position / opacity no slide: override mesmo com logo da marca
 */
export function brandWithSlideLogo(brand, slide = {}) {
  if (slide.logoHidden) {
    return { ...brand, logo: null, ...resolveLogoControls(brand, slide) };
  }
  const ctrl = resolveLogoControls(brand, slide);
  const hasSlideAsset = !!(slide.logoImageId || slide.logoImage);
  const logo = hasSlideAsset
    ? (slide.logoImage || null)
    : (brand?.logo || null);
  const hasCtrlOverride = slide.logoPosition != null
    || slide.logoSize != null
    || slide.logoOpacity != null
    || hasSlideAsset;
  if (!hasCtrlOverride && logo === brand?.logo) return brand;
  return { ...brand, logo, ...ctrl };
}

/** Limpa overrides de layout do card (volta a herdar a marca). */
export function clearSlideLogoLayout() {
  return { logoPosition: undefined, logoSize: undefined, logoOpacity: undefined };
}

export async function exportSlideLogo(slide) {
  if (!slide?.logoImageId) return slide;
  const dataUrl = await imagemComoDataUrl(slide.logoImageId);
  if (!dataUrl) throw new Error('A logo de um card não está disponível para o backup. Reimporte o PNG.');
  const { logoImageId, ...rest } = slide;
  return { ...rest, logoImage: dataUrl };
}

export async function importSlideLogo(slide) {
  if (!slide?.logoImage?.startsWith('data:image/png;base64,')) return slide;
  const blob = dataUrlParaBlob(slide.logoImage);
  return { ...slide, ...(await storeSlideLogo(blob)) };
}

/** Torna a logo global portátil no JSON, sem carregar o ID local para outro navegador. */
export async function exportBrandLogo(brand = {}) {
  if (!brand?.logoImageId) return brand;
  const dataUrl = await imagemComoDataUrl(brand.logoImageId);
  if (!dataUrl) throw new Error('A logo da marca não está disponível para o backup. Reimporte o PNG.');
  const { logoImageId, ...rest } = brand;
  return { ...rest, logo: dataUrl };
}

/** Guarda no IndexedDB a logo global embutida por um backup antigo/portátil. */
export async function importBrandLogo(brand = {}) {
  if (!brand?.logo?.startsWith('data:image/png;base64,')) return brand;
  const blob = dataUrlParaBlob(brand.logo);
  if (!blob) return brand;
  const stored = await storeSlideLogo(blob);
  return { ...brand, logo: stored.logoImage, logoImageId: stored.logoImageId };
}
