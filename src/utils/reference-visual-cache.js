import { normalizeReferenceVisualAnalysis } from './reference-visual-analysis.js';
import { referencePaletteRefIds } from './reference-palette.js';
import { isOriginalImageAsset } from './cloud-image-assets.js';
import { REFERENCE_VISION_MODEL, REFERENCE_VISION_MAX_IMAGES } from '../../shared/reference-vision.js';

const VERSION = 1;
const text = value => typeof value === 'string' ? value : '';

// Identificador de cache, não assinatura de segurança. Inclui o conteúdo
// inline para que substituir bytes mantendo o ID também invalide a leitura.
function fingerprint(value) {
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= globalThis.BigInt(value.charCodeAt(i));
    hash = globalThis.BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

function referenceVisualLookKey(kit) {
  const references = (Array.isArray(kit?.refImages) ? kit.refImages : []).map(ref => ({
    id: text(ref?.id),
    key: text(ref?.assetId || ref?.imageId || ref?.id),
    ...(text(ref?.dataUrl) ? { bytes: fingerprint(ref.dataUrl) } : {}),
  }));
  return fingerprint(JSON.stringify({ version: VERSION, model: REFERENCE_VISION_MODEL, references,
    stylePrompt: text(kit?.stylePrompt), contextMd: text(kit?.contextMd) }));
}

function referenceVisualBriefKey({ brief = '', application = '' } = {}) {
  return fingerprint(JSON.stringify({ brief: text(brief), application: text(application) }));
}

function contextKeyFor(lookKey, briefKey) {
  return fingerprint(JSON.stringify({ lookKey, briefKey }));
}

export function referenceVisualContextKey(kit, { brief = '', application = '' } = {}) {
  return contextKeyFor(referenceVisualLookKey(kit), referenceVisualBriefKey({ brief, application }));
}

export function normalizeReferenceVisualRecord(raw) {
  if (!raw || raw.version !== VERSION || raw.model !== REFERENCE_VISION_MODEL
    || !/^[a-f0-9]{16}$/.test(text(raw.contextKey)) || !/^[a-f0-9]{16}$/.test(text(raw.lookKey)) || !Array.isArray(raw.refIds)
    || !/^[a-f0-9]{16}$/.test(text(raw.briefKey))
    || !raw.refIds.length || raw.refIds.length > REFERENCE_VISION_MAX_IMAGES
    || raw.refIds.some(id => typeof id !== 'string' || !id || id.length > 300)
    || !Array.isArray(raw.contentIds) || raw.contentIds.length !== raw.refIds.length
    || raw.contentIds.some(id => !isOriginalImageAsset(id))
    || raw.contextKey !== contextKeyFor(raw.lookKey, raw.briefKey)) return null;
  const analysis = normalizeReferenceVisualAnalysis(raw.analysis);
  return analysis ? { version: VERSION, model: REFERENCE_VISION_MODEL,
    refIds: [...raw.refIds], contentIds: [...raw.contentIds], briefKey: raw.briefKey,
    contextKey: raw.contextKey, lookKey: raw.lookKey, analysis } : null;
}

export function referenceVisualRecord(kit, analysis, context = {}) {
  return normalizeReferenceVisualRecord({ version: VERSION, model: REFERENCE_VISION_MODEL,
    refIds: referencePaletteRefIds(kit), contentIds: context.contentIds || kit?.refImages?.map(ref => ref?.assetId),
    briefKey: referenceVisualBriefKey(context), contextKey: referenceVisualContextKey(kit, context),
    lookKey: referenceVisualLookKey(kit), analysis });
}

/** Guard síncrono para aplicar um resultado ao kit que ainda está em edição. */
export function recordMatchesKit(raw, kit) {
  const record = normalizeReferenceVisualRecord(raw);
  const refIds = referencePaletteRefIds(kit);
  return !!record && record.refIds.length === refIds.length
    && record.refIds.every((id, index) => id === refIds[index])
    && record.lookKey === referenceVisualLookKey(kit);
}

export function matchingReferenceVisualRecord(kit, context = {}) {
  const record = normalizeReferenceVisualRecord(kit?.referenceVisual);
  if (!recordMatchesKit(record, kit) || record.contextKey !== referenceVisualContextKey(kit, context)
    || (context.contentIds && (context.contentIds.length !== record.contentIds.length
      || context.contentIds.some((id, index) => id !== record.contentIds[index])))) return null;
  return record;
}

/** Apenas pack/hydrate: a conversão precisa provar os mesmos originais e ordem. */
export function rebindReferenceVisualRecord(raw, beforeKit, afterKit, { contentIds } = {}) {
  const record = normalizeReferenceVisualRecord(raw);
  if (!recordMatchesKit(record, beforeKit)
    || text(beforeKit?.stylePrompt) !== text(afterKit?.stylePrompt)
    || text(beforeKit?.contextMd) !== text(afterKit?.contextMd)) return null;
  const before = beforeKit.refImages;
  const after = Array.isArray(afterKit?.refImages) ? afterKit.refImages : [];
  if (after.length !== before.length || after.some((ref, index) =>
    text(ref?.id || ref?.imageId || ref?.assetId) !== text(before[index]?.id || before[index]?.imageId || before[index]?.assetId))) return null;
  // O pack acabou de calcular assetId dos bytes. Na hidratação também se
  // verifica a cópia local, pois ela pode ter sido substituída sob o mesmo ID.
  const verified = contentIds || after.map(ref => ref?.assetId);
  if ((!contentIds && after.some(ref => text(ref?.dataUrl)))
    || verified.length !== record.contentIds.length
    || verified.some((id, index) => id !== record.contentIds[index])
    || after.some((ref, index) => isOriginalImageAsset(ref?.assetId) && ref.assetId !== record.contentIds[index])) return null;
  const lookKey = referenceVisualLookKey(afterKit);
  return normalizeReferenceVisualRecord({ ...record, refIds: referencePaletteRefIds(afterKit), lookKey,
    contextKey: contextKeyFor(lookKey, record.briefKey) });
}

/** Resultado assíncrono: o sync pode ter canonizado as refs antes do commit. */
export function referenceVisualRecordForKit(raw, sourceKit, currentKit) {
  const record = normalizeReferenceVisualRecord(raw);
  return recordMatchesKit(record, currentKit) ? record
    : rebindReferenceVisualRecord(record, sourceKit, currentKit);
}

/** Regenerar uma foto não reanalisa o flyer; trocar o kit invalida a leitura. */
export function referenceVisualAnalysisForSavedPlan(plan, kit) {
  const analysis = normalizeReferenceVisualAnalysis(plan?.referenceVisualAnalysis);
  const record = normalizeReferenceVisualRecord(kit?.referenceVisual);
  if (!analysis || !recordMatchesKit(record, kit)
    || JSON.stringify(analysis) !== JSON.stringify(record.analysis)) return null;
  return analysis;
}
