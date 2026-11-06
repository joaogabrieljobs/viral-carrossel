import { imageGet, imagePut, newImageId, dataUrlParaBlob, blobParaDataUrl } from './image-store.js';

const referenceUnavailable = () => Object.assign(
  new Error('Reenvie a referência deste card: o arquivo não está disponível neste navegador.'),
  { code: 'slide_reference_unavailable' },
);
const legacyReference = (slide) => typeof slide?.refImage === 'string' ? slide.refImage.trim() : '';
export const MAX_SLIDE_IMAGE_REFERENCES = 4;
export const SLIDE_REFERENCE_MENTION_MAX = 24;

export function normalizeSlideReferenceMention(value, fallback = 'imagem1') {
  const clean = String(value || '')
    .trim()
    .replace(/^@+/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  const safe = clean && !/^\d/.test(clean) ? clean : clean ? `imagem_${clean}` : String(fallback || 'imagem1');
  return safe.slice(0, SLIDE_REFERENCE_MENTION_MAX) || 'imagem1';
}

export function uniqueSlideReferenceMention(value, used = [], fallback = 'imagem1') {
  const occupied = new Set((Array.isArray(used) ? used : []).map(item => normalizeSlideReferenceMention(item)));
  const base = normalizeSlideReferenceMention(value, fallback);
  if (!occupied.has(base)) return base;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${base.slice(0, SLIDE_REFERENCE_MENTION_MAX - String(suffix).length)}${suffix}`;
    if (!occupied.has(candidate)) return candidate;
  }
  return `${base.slice(0, SLIDE_REFERENCE_MENTION_MAX - 4)}_${Date.now().toString(36).slice(-3)}`;
}

function validReferenceFile(file) {
  return file && typeof file.arrayBuffer === 'function' && file.size
    && String(file.type || '').startsWith('image/');
}

export function normalizeSlideImageReferences(value) {
  return (Array.isArray(value) ? value : [])
    .filter((ref) => ref && typeof ref === 'object'
      && (ref.imageId || ref.assetId || (typeof ref.dataUrl === 'string' && ref.dataUrl.startsWith('data:image/'))))
    .slice(0, MAX_SLIDE_IMAGE_REFERENCES)
    .map((ref, index) => ({
      id:String(ref.id || ref.imageId || ref.assetId || `inline-${index + 1}`),
      name:String(ref.name || 'Referência').slice(0, 80),
      ...(String(ref.mention || '').trim() ? { mention:normalizeSlideReferenceMention(ref.mention, `imagem${index + 1}`) } : {}),
      ...(ref.imageId ? { imageId:String(ref.imageId) } : {}),
      ...(ref.assetId ? { assetId:String(ref.assetId) } : {}),
      ...(typeof ref.dataUrl === 'string' && ref.dataUrl.startsWith('data:image/') ? { dataUrl:ref.dataUrl } : {}),
    }));
}

/** Lista visual e semântica: a ordem é a mesma enviada ao modelo de imagem. */
export function slideReferenceDescriptors(slide = {}) {
  const descriptors = [];
  const used = [];
  const hasLegacy = Boolean(slide.refImageId || slide.refImageAssetId || legacyReference(slide) || slide.refImageFailed);
  if (hasLegacy) {
    const mention = uniqueSlideReferenceMention(slide.refImageMention, used, 'imagem1');
    used.push(mention);
    descriptors.push({
      key:'legacy',
      mention,
      name:String(slide.refImageName || 'Referência 1').slice(0, 80),
      refImageId:slide.refImageId || slide.refImageAssetId || null,
      refImageAssetId:slide.refImageAssetId,
      refImage:legacyReference(slide),
      refImageFailed:slide.refImageFailed,
    });
  }
  normalizeSlideImageReferences(slide.imageReferences)
    .slice(0, Math.max(0, MAX_SLIDE_IMAGE_REFERENCES - descriptors.length))
    .forEach((ref, index) => {
      const position = descriptors.length + 1;
      const mention = uniqueSlideReferenceMention(ref.mention, used, `imagem${position}`);
      used.push(mention);
      descriptors.push({
        key:ref.id || ref.imageId || ref.assetId || `ref-${index}`,
        mention,
        name:ref.name || `Referência ${position}`,
        refImageId:ref.imageId || ref.assetId,
        refImageAssetId:ref.assetId,
        refImage:ref.dataUrl || '',
      });
    });
  return descriptors;
}

/** Explica os @nomes sem depender de o modelo adivinhar a ordem dos anexos. */
export function composeSlideReferencePrompt(slide = {}, extra = '') {
  const references = slideReferenceDescriptors(slide);
  const direction = String(extra || '').trim();
  if (!references.length) return direction;
  const labels = references.map((ref, index) => (
    `- @${ref.mention} = reference image ${index + 1} (${String(ref.name).replace(/\s+/g, ' ').slice(0, 80)})`
  )).join('\n');
  const guide = `REFERENCE IMAGE LABELS (same order as the attached images):\n${labels}\nWhen the direction cites an @label, use that exact reference image and do not confuse it with the others.`;
  return [guide, direction].filter(Boolean).join('\n\n');
}

/** Nova coleção por card: cada item mantém seu próprio ID e nome. */
export async function storeSlideImageReference(file) {
  if (!validReferenceFile(file)) {
    throw new Error('Escolha um arquivo de imagem válido para usar como referência.');
  }
  const imageId = newImageId();
  try {
    await imagePut(imageId, file);
  } catch {
    throw new Error('Não foi possível guardar a referência neste navegador. Tente novamente; as imagens anteriores foram preservadas.');
  }
  return { id:imageId, imageId, name:String(file.name || 'Referência').slice(0, 80) };
}

/** Guarda os bytes originais; o documento só recebe o ID após o commit no IndexedDB. */
export async function storeSlideReference(file) {
  try {
    const stored = await storeSlideImageReference(file);
    return { refImageId:stored.imageId, refImage:null, refImageAssetId:null };
  } catch (error) {
    if (error?.message?.includes('as imagens anteriores foram preservadas')) {
      throw new Error('Não foi possível guardar a referência neste navegador. Tente novamente; a imagem anterior foi preservada.');
    }
    throw error;
  }
}

/** Migração do formato antigo/backup, sem apagar a única cópia se o disco falhar. */
export async function importSlideReference(slide) {
  const source = legacyReference(slide);
  if (!source.startsWith('data:image/')) return slide;
  try {
    const blob = dataUrlParaBlob(source);
    if (!blob?.size) return slide;
    const refImageId = slide.refImageId || slide.refImageAssetId || newImageId();
    await imagePut(refImageId, blob);
    return { ...slide, refImageId, refImage: null, refImageFailed: false, refImageError: null };
  } catch {
    return slide;
  }
}

/** Uma referência específica nunca é trocada silenciosamente pelo moodboard. */
export async function resolveSlideReference(slide = {}) {
  const imageId = slide.refImageId || slide.refImageAssetId;
  if (imageId) {
    try {
      const entry = await imageGet(imageId);
      if (entry?.blob) return await blobParaDataUrl(entry.blob);
    } catch { /* A cópia legada abaixo ainda pode estar disponível. */ }
  }
  const source = legacyReference(slide);
  if (source) return source;
  if (imageId || slide.refImageFailed) throw referenceUnavailable();
  return null;
}

/** Referência legada + coleção nova, na ordem visível no editor. */
export async function resolveSlideImageReferences(slide = {}) {
  const resolved = [];
  if (slide.refImageId || slide.refImageAssetId || legacyReference(slide) || slide.refImageFailed) {
    resolved.push(await resolveSlideReference(slide));
  }
  const remaining = Math.max(0, MAX_SLIDE_IMAGE_REFERENCES - resolved.length);
  const extras = normalizeSlideImageReferences(slide.imageReferences).slice(0, remaining);
  for (const ref of extras) {
    resolved.push(await resolveSlideReference({
      refImageId:ref.imageId || ref.assetId,
      refImageAssetId:ref.assetId,
      refImage:ref.dataUrl,
    }));
  }
  return resolved.filter(Boolean);
}

/** Backup portátil: embute a referência e não leva IDs específicos deste navegador. */
export async function exportSlideReference(slide) {
  if (!slide || !(slide.refImageId || slide.refImageAssetId || slide.refImage || slide.refImageFailed)) return slide;
  let source = await resolveSlideReference(slide);
  if (source && !source.startsWith('data:image/')) {
    try {
      const response = await fetch(source);
      if (!response.ok) throw referenceUnavailable();
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw referenceUnavailable();
      source = await blobParaDataUrl(blob);
    } catch { throw referenceUnavailable(); }
  }
  if (!source) throw referenceUnavailable();
  const { refImageId, refImageAssetId, refImageFailed, refImageError, ...portable } = slide;
  return { ...portable, refImage: source };
}
