import { TITLE_FONTS } from './design-data.js';
import { BODY_FONTS } from './brand-visuals.js';

// A IA escolhe apenas valores que o editor sabe representar, nunca CSS arbitrário.
export const PROJECT_DESIGN_SCHEMA = {
  layout: '', titleFont: '', bodyFont: '', titleCase: '', titleWeight: 400,
  bg: '', titleColor: '', subtitleColor: '', textColor: '', accent: '',
};

export function buildProjectDesignInstructions(kit) {
  if (!kit?.contextMd?.trim() && !kit?.stylePrompt?.trim()) return '';
  return `IDENTIDADE EDITÁVEL DO PROJETO:
Preencha projectDesign a partir das regras explícitas do brief e estilo. Campo não especificado: string vazia (titleWeight: 0). Não deduza a identidade a partir do assunto, nem transforme cores de acento em filtros de imagem.
layout: fullbleed se o brief exigir imagem em toda a peça; classic se pedir foto em área separada; vazio se não especificado.
titleFont: nome exato entre ${TITLE_FONTS.map(f => f.name).join(', ')}.
bodyFont: nome exato entre ${BODY_FONTS.map(f => f.name).join(', ')}.
Se a fonte pedida não existir na lista, deixe vazio. titleCase: upper, lower ou normal. titleWeight: peso indicado, 100 a 900; Anton e Bebas Neue usam 400. Cores somente #RRGGBB. Não invente logo nem use nomes de arquivos como imagens. O editor aplicará esses valores apenas ao projeto atual.`;
}

export function projectDesignBrandPatch(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const patch = {};
  const title = TITLE_FONTS.find(f => f.name === raw.titleFont);
  const body = BODY_FONTS.find(f => f.name === raw.bodyFont);
  if (title) { patch.titleFont = title.val; patch.customTitleFont = null; }
  if (body) patch.bodyFont = body.val;
  if (['upper', 'lower', 'normal'].includes(raw.titleCase)) patch.textTitleCase = raw.titleCase;
  if (Number.isInteger(raw.titleWeight) && raw.titleWeight >= 100 && raw.titleWeight <= 900) patch.textTitleWeight = raw.titleWeight;
  if (title && ['Anton', 'Bebas Neue'].includes(title.name)) patch.textTitleWeight = 400;
  for (const key of ['bg', 'titleColor', 'subtitleColor', 'textColor', 'accent']) {
    if (typeof raw[key] === 'string' && /^#[0-9a-f]{6}$/i.test(raw[key])) patch[key] = raw[key];
  }
  return patch;
}

/** Fotos com overlay escuro precisam de texto claro; não altera a paleta salva. */
export function needsLightPhotoText(slide) {
  const fullPhoto = slide?.photoRegion == null || slide.photoRegion === 'full';
  const photo = slide?.canvas?.zones?.photo;
  const canvasFullPhoto = !photo || (photo.w >= 90 && photo.h >= 90);
  return !!slide?.bgImage && fullPhoto && canvasFullPhoto && !slide?.useCultureLayout && (slide.overlay ?? 0) >= 38;
}
