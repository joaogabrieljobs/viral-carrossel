/**
 * Última defesa contra perda silenciosa de fotos: um navegador que não
 * conseguiu carregar uma imagem (`bgImageFailed: true`) não pode, ao salvar,
 * apagar a referência ao asset que a conta já guarda. A referência volta para
 * o documento e a falha é zerada, para o cliente hidratar de novo da nuvem.
 *
 * Remover a foto de propósito continua funcionando: o editor zera a imagem
 * com `bgImageFailed: false`, e isso não é tocado aqui.
 */

const SLIDE_MEDIA = [
  ['bgImageAssetId', 'bgImage', 'bgImageId', 'bgImageFailed', 'bgImageError'],
  ['logoImageAssetId', 'logoImage', 'logoImageId', 'logoImageFailed', 'logoImageError'],
  ['refImageAssetId', 'refImage', 'refImageId', 'refImageFailed', 'refImageError'],
];

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function slideMap(entry) {
  const slides = Array.isArray(entry?.doc?.slides) ? entry.doc.slides : [];
  return new Map(slides.filter(slide => isRecord(slide) && slide.id != null).map(slide => [slide.id, slide]));
}

function referenceKeys(ref) {
  return [ref?.id, ref?.assetId, ref?.imageId]
    .filter((value) => typeof value === 'string' && value);
}

function preserveReferenceList(before, after) {
  const previous = Array.isArray(before?.imageReferences) ? before.imageReferences : [];
  const incoming = Array.isArray(after?.imageReferences) ? after.imageReferences : [];
  const removed = new Set((Array.isArray(after?.removedImageReferenceIds)
    ? after.removedImageReferenceIds : []).map(String));
  const next = incoming.map((ref) => ({ ...ref }));
  const restored = [];

  for (const oldRef of previous) {
    const assetId = typeof oldRef?.assetId === 'string' ? oldRef.assetId : '';
    if (!assetId) continue;
    const keys = referenceKeys(oldRef);
    if (keys.some((key) => removed.has(key))) continue;
    const index = next.findIndex((ref) => {
      const candidate = new Set(referenceKeys(ref));
      return keys.some((key) => candidate.has(key));
    });
    if (index >= 0) {
      if (!next[index].assetId) {
        next[index] = { ...next[index], assetId };
        restored.push({ field:'imageReferences', assetId });
      }
      continue;
    }
    next.push({ ...oldRef });
    restored.push({ field:'imageReferences', assetId });
  }
  return { references:next, restored };
}

/**
 * @returns {{ entry: object, restored: Array<{ slideId: string, field: string, assetId: string }> }}
 */
export function preserveDroppedMediaReferences(previousEntry, nextEntry) {
  const restored = [];
  if (!isRecord(previousEntry) || !isRecord(nextEntry) || !Array.isArray(nextEntry.doc?.slides)) {
    return { entry: nextEntry, restored };
  }
  const previous = slideMap(previousEntry);
  if (!previous.size) return { entry: nextEntry, restored };
  let changed = false;
  const slides = nextEntry.doc.slides.map(slide => {
    if (!isRecord(slide) || slide.id == null) return slide;
    const before = previous.get(slide.id);
    if (!before) {
      if (!Object.prototype.hasOwnProperty.call(slide, 'removedImageReferenceIds')) return slide;
      const { removedImageReferenceIds: _removed, ...clean } = slide;
      changed = true;
      return clean;
    }
    let next = slide;
    for (const [assetKey, imageKey, idKey, failedKey, errorKey] of SLIDE_MEDIA) {
      const kept = typeof before[assetKey] === 'string' && before[assetKey];
      if (!kept || next[assetKey]) continue;
      if (next[failedKey] !== true || next[imageKey] || next[idKey]) continue;
      next = { ...next, [assetKey]: kept, [failedKey]: false, [errorKey]: null };
      restored.push({ slideId: String(slide.id), field: assetKey, assetId: kept });
    }
    const guardedReferences = preserveReferenceList(before, next);
    if (guardedReferences.references.length !== (Array.isArray(next.imageReferences) ? next.imageReferences.length : 0)
      || guardedReferences.references.some((ref, index) => ref.assetId !== next.imageReferences?.[index]?.assetId)) {
      next = { ...next, imageReferences:guardedReferences.references };
      guardedReferences.restored.forEach((item) => restored.push({ slideId:String(slide.id), ...item }));
    }
    // O marcador é um comando de uma gravação, não faz parte do documento.
    if (Object.prototype.hasOwnProperty.call(next, 'removedImageReferenceIds')) {
      const { removedImageReferenceIds: _removed, ...clean } = next;
      next = clean;
    }
    if (next !== slide) changed = true;
    return next;
  });
  if (!changed) return { entry: nextEntry, restored };
  return { entry: { ...nextEntry, doc: { ...nextEntry.doc, slides } }, restored };
}
