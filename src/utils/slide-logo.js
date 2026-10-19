import { imagePut, newImageId, imagemComoDataUrl, dataUrlParaBlob, blobParaDataUrl } from './image-store.js';

/** Tamanho em px na escala 1080 (caixa da logo no card). */
export const LOGO_SIZE_MIN = 48;
/** Quase a largura do card — logos com muito padding no PNG ainda ficam legíveis. */
export const LOGO_SIZE_MAX = 900;
/** Default antigo (120) saía minúsculo no preview Stories / Feed. */
export const LOGO_SIZE_DEFAULT = 260;
/** Tamanho forçado em todo import novo (não herda valor antigo minúsculo). */
export const LOGO_SIZE_IMPORT = 300;
/** Limita o custo do PNG portátil quando o IndexedDB está indisponível. */
export const LOGO_INLINE_MAX_BYTES = 256 * 1024;

/**
 * Retângulo clicável da logo dentro do quadrado do slider.
 * A caixa segue o desenho (e o recorte opaco, se houver), não o PNG inteiro.
 */
export function logoContainHitRect(box, naturalW, naturalH, ink) {
  const side = Math.max(1, Number(box) || 1);
  const imgW = Math.max(1, Number(naturalW) || 1);
  const imgH = Math.max(1, Number(naturalH) || 1);
  const bounds = ink && ink.w > 0 && ink.h > 0 ? ink : { x: 0, y: 0, w: 1, h: 1 };
  const fit = Math.min(side / imgW, side / imgH);
  const renderedW = imgW * fit;
  const renderedH = imgH * fit;
  const offsetX = (side - renderedW) / 2;
  const offsetY = (side - renderedH) / 2;
  const raw = {
    left: offsetX + bounds.x * renderedW,
    top: offsetY + bounds.y * renderedH,
    width: Math.max(1, bounds.w * renderedW),
    height: Math.max(1, bounds.h * renderedH),
  };
  const pad = Math.min(12, Math.max(4, Math.min(raw.width, raw.height) * 0.08));
  const left = Math.max(0, raw.left - pad);
  const top = Math.max(0, raw.top - pad);
  const right = Math.min(side, raw.left + raw.width + pad);
  const bottom = Math.min(side, raw.top + raw.height + pad);
  return {
    left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top),
  };
}

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

/** ID e imagem são inseparáveis: nunca completar um PNG de card/projeto com
 * o ID de outra logo herdada da marca. */
export function resolveLogoAssetSource(brand = {}, styleKit = {}, slide = {}) {
  if (slide?.logoImageId || slide?.logoImage) {
    return { source: 'slide', logoImageId: slide.logoImageId || null, logoImage: slide.logoImage || null };
  }
  if (styleKit?.logo?.imageId || styleKit?.logo?.dataUrl) {
    return { source: 'project', logoImageId: styleKit.logo.imageId || null, logoImage: styleKit.logo.dataUrl || null };
  }
  if (brand?.logoImageId || brand?.logo) {
    return { source: 'brand', logoImageId: brand.logoImageId || null, logoImage: brand.logo || null };
  }
  return null;
}

/**
 * Controles seguros após importar um ficheiro: tamanho legível + posição estável.
 * Não reutiliza logoSize antigo (ex.: 40–120) que fazia a marca “sumir” do card.
 */
export function logoImportControls(brand = {}) {
  return {
    logoSize: LOGO_SIZE_IMPORT,
    logoOpacity: brand.logoOpacity ?? 90,
    logoPosition: brand.logoPosition || 'tr',
  };
}

/** Remove arrasto da logo (evita ficar fora da área após import). */
export function clearLogoOffsetOnSlide(slide = {}) {
  if (!slide?.elementOffsets || !Object.prototype.hasOwnProperty.call(slide.elementOffsets, 'logo')) {
    return slide;
  }
  const elementOffsets = { ...slide.elementOffsets };
  delete elementOffsets.logo;
  return { ...slide, elementOffsets };
}

export function clearLogoOffsetOnSlides(slides = []) {
  return (slides || []).map(clearLogoOffsetOnSlide);
}

/** Patch de marca para logo visível em todos os cards (overlay). */
export function brandLogoInsertPatch(logoDataUrl, brand = {}) {
  return {
    logo: logoDataUrl,
    ...logoImportControls(brand),
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
      ...((logoImageId || logoImage) ? { logoImageId, logoImage } : {}),
      logoHidden: false,
    };
  });
}

/**
 * Replica em outros cards a aparência exata da logo do card de origem.
 * Inclui o deslocamento feito por arrasto livre, além de posição, tamanho e
 * opacidade. Se a origem não tem deslocamento, remove o deslocamento antigo do
 * destino para que todos terminem realmente iguais.
 */
export function applyLogoLayoutToSlides(slides = [], {
  sourceSlide = {},
  brand = {},
  ids = null,
} = {}) {
  const filter = ids ? new Set(ids) : null;
  const controls = resolveLogoControls(brand, sourceSlide);
  const sourceLogoOffset = sourceSlide?.elementOffsets?.logo;
  return (slides || []).map((target) => {
    if (filter && !filter.has(target?.id)) return target;
    const elementOffsets = { ...(target?.elementOffsets || {}) };
    if (sourceLogoOffset && typeof sourceLogoOffset === 'object') {
      elementOffsets.logo = { ...sourceLogoOffset };
    } else {
      delete elementOffsets.logo;
    }
    return {
      ...target,
      ...controls,
      logoHidden: false,
      elementOffsets,
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

/** JPEG/WebP viram PNG no navegador. Sem canvas, a logo continua no formato original. */
export async function ensurePngDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return dataUrl;
  if (dataUrl.startsWith('data:image/png;')) return dataUrl;
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return dataUrl;
  const blob = dataUrlParaBlob(dataUrl);
  if (!blob) return dataUrl;
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, bitmap.width);
    canvas.height = Math.max(1, bitmap.height);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    const png = canvas.toDataURL('image/png');
    return png?.startsWith('data:image/png;') ? png : dataUrl;
  } finally {
    bitmap.close?.();
  }
}

async function rasterFileToPng(file) {
  const dataUrl = await blobParaDataUrl(file);
  const png = await ensurePngDataUrl(dataUrl);
  if (!png?.startsWith('data:image/png;')) {
    throw new Error('Escolha uma logo em PNG (fundo transparente) para máxima qualidade.');
  }
  const blob = dataUrlParaBlob(png);
  if (!blob) throw new Error('Escolha uma logo em PNG (fundo transparente) para máxima qualidade.');
  return new File([blob], 'logo.png', { type: 'image/png' });
}

export async function storeSlideLogo(file) {
  if (file?.type === 'image/jpeg' || file?.type === 'image/webp') {
    file = await rasterFileToPng(file);
  }
  if (file.type !== 'image/png') throw new Error('Escolha uma logo em PNG (fundo transparente) para máxima qualidade.');
  if (file.size > 5 * 1024 * 1024) throw new Error('A logo deve ter no máximo 5 MB.');
  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if ([137, 80, 78, 71, 13, 10, 26, 10].some((value, i) => signature[i] !== value)) throw new Error('Este arquivo não é um PNG válido.');
  let logoLowRes = false;
  try {
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(file);
      logoLowRes = Math.max(bmp.width, bmp.height) < 600;
      bmp.close?.();
    }
  } catch { /* ignore */ }
  const logoImageId = newImageId();
  try {
    await imagePut(logoImageId, file);
  } catch {
    if (file.size > LOGO_INLINE_MAX_BYTES) {
      throw new Error('O armazenamento de imagens está temporariamente indisponível. Tente novamente ou use um PNG de até 256 KB.');
    }
    // Bytes originais: mantém transparência e sobrevive a reload/backup. Não
    // publicar ID antes de gravá-lo, nem object URL que só existe nesta aba.
    return { logoImageId: null, logoImage: await blobParaDataUrl(file), logoHidden: false, logoLowRes };
  }
  return {
    logoImageId,
    logoImage: URL.createObjectURL(file),
    logoHidden: false,
    logoLowRes,
  };
}

/** O kit guarda um ID confirmado ou o PNG portátil do modo de contingência. */
export function projectLogoFromStored(stored, name = 'Logo do projeto') {
  return stored.logoImageId
    ? { imageId: stored.logoImageId, name }
    : { dataUrl: stored.logoImage, name };
}

/** Logo no centro de um card com texto cobre a frase. Sem arrasto, fica no canto. */
export function visibleLogoPosition(brand = {}, slide = {}) {
  const pos = slide.logoPosition || brand.logoPosition || 'tr';
  if (slide.elementOffsets?.logo) return pos;
  if (pos !== 'c') return pos;
  const text = `${slide.title || ''} ${slide.subtitle || ''} ${slide.bodyAfterImage || ''}`.trim();
  return text.length > 24 ? 'tr' : pos;
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
