import { applySlideImageToStoredProject } from './image-store.js';
import { reconcileFreeImageFallback } from './free-image-fallback.js';

/**
 * Uma foto que termina depois da troca de projeto segue a mesma transição
 * visual do editor ativo: entrega a mídia ao alvo ainda válido e restaura o
 * layout anterior à falha. Isso acontece na gravação da ação, nunca no boot.
 * O módulo de armazenamento continua sem dependência do diretor de arte.
 */
export function applyFreeSlideImageToStoredProject(library = [], projectId, target) {
  const result = applySlideImageToStoredProject(library, projectId, target);
  if (!result.applied) return result;
  const before = (library || []).find(entry => entry?.id === projectId)?.doc?.slides || [];
  let changed = false;
  const reconciled = result.library.map(entry => {
    if (entry?.id !== projectId || !Array.isArray(entry?.doc?.slides)) return entry;
    const slides = reconcileFreeImageFallback(before, entry.doc.slides);
    if (slides === entry.doc.slides) return entry;
    changed = true;
    return { ...entry, doc: { ...entry.doc, slides } };
  });
  return changed ? { ...result, library: reconciled } : result;
}
