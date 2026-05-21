/** Biblioteca local de hooks (capas) salvos pelo usuário.
 *  Schema de entry: { id, hook, niche, tone, savedAt, usageCount }
 *  Persistência fica fora deste módulo (App owns localStorage). */

export const HOOK_LIBRARY_MAX = 50;

/** Adiciona um hook à biblioteca, com dedup por (hook, niche).
 *  Duplicata: incrementa usageCount + atualiza savedAt no mesmo slot.
 *  Não-duplicata: prepend, com truncamento FIFO a HOOK_LIBRARY_MAX. */
export function saveHookToLibrary(prev, { hook, niche, tone }) {
  const cleaned = String(hook || '').trim();
  if (!cleaned) return prev;
  const dupIdx = prev.findIndex(
    (h) => h.hook === cleaned && (h.niche || '') === (niche || ''),
  );
  if (dupIdx >= 0) {
    const next = [...prev];
    next[dupIdx] = {
      ...next[dupIdx],
      usageCount: (next[dupIdx].usageCount || 1) + 1,
      savedAt: Date.now(),
    };
    return next;
  }
  const entry = {
    id: 'hook_' + Math.random().toString(36).slice(2, 10),
    hook: cleaned,
    niche: (niche || '').trim(),
    tone: (tone || '').trim(),
    savedAt: Date.now(),
    usageCount: 1,
  };
  const next = [entry, ...prev];
  if (next.length > HOOK_LIBRARY_MAX) next.length = HOOK_LIBRARY_MAX;
  return next;
}

/** Sugere hooks pra um nicho: match exato primeiro, depois substring, depois geral.
 *  Útil em GenerateModal pra mostrar inspiração na hora de criar um novo carrossel. */
export function getHooksForNiche(library, niche, limit = 5) {
  if (!Array.isArray(library) || library.length === 0) return [];
  const n = String(niche || '').trim().toLowerCase();
  if (!n) return library.slice(0, limit);
  const exact = library.filter((h) => (h.niche || '').toLowerCase() === n);
  if (exact.length >= limit) return exact.slice(0, limit);
  const partial = library.filter(
    (h) =>
      !exact.includes(h) &&
      ((h.niche || '').toLowerCase().includes(n) || n.includes((h.niche || '').toLowerCase())),
  );
  return [...exact, ...partial].slice(0, limit);
}
