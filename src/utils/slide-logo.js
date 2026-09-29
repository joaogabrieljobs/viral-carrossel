import { imagePut, newImageId, imagemComoDataUrl, dataUrlParaBlob } from './image-store.js';

export async function storeSlideLogo(file) {
  if (file.type !== 'image/png') throw new Error('Escolha uma logo em PNG para preservar a transparência.');
  if (file.size > 2 * 1024 * 1024) throw new Error('A logo deve ter no máximo 2 MB.');
  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if ([137, 80, 78, 71, 13, 10, 26, 10].some((value, i) => signature[i] !== value)) throw new Error('Este arquivo não é um PNG válido.');
  const logoImageId = newImageId();
  // Original PNG: nenhuma conversão para JPEG ou preenchimento de fundo.
  await imagePut(logoImageId, file);
  return { logoImageId, logoImage: URL.createObjectURL(file), logoHidden: false };
}

export function brandWithSlideLogo(brand, slide) {
  if (!slide.logoImageId && !slide.logoHidden) return brand;
  return { ...brand, logo: slide.logoHidden ? null : (slide.logoImage || null),
    logoPosition: slide.logoPosition || brand.logoPosition || 'tr',
    logoSize: slide.logoSize ?? brand.logoSize ?? 60,
    logoOpacity: slide.logoOpacity ?? 100 };
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
