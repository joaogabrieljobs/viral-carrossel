/** Fila de toasts do app + atalho setError (toast de erro com TTL maior). */
import { useState, useCallback } from 'react';
import { uid } from '../utils/doc-schema.js';

export function toastTtl(kind = 'info', ttl = null) {
  const fallbackTtl = kind === 'error' ? 7000 : 3500;
  return Number.isFinite(ttl) ? Math.max(0, ttl) : fallbackTtl;
}

export function useToasts() {
  // ── TOAST helpers — declarados ANTES de qualquer callback que os referencie
  // no array de deps (exportDoc, exportAllDocs etc.). Ordem importa: deps array
  // é avaliado no momento do useCallback, e const é TDZ até a linha rodar.
  const [toasts, setToasts] = useState([]);
  const dismissToast = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);
  const toast = useCallback((message, kind='info', ttl=null) => {
    const id = uid();
    setToasts(t => [...t, { id, message, kind }]);
    // Erros ficam tempo suficiente para leitura, mas também saem sozinhos.
    // Chamadas realmente bloqueantes ainda podem informar `ttl = 0`.
    const effectiveTtl = toastTtl(kind, ttl);
    if (effectiveTtl > 0) setTimeout(() => dismissToast(id), effectiveTtl);
    return id;
  }, [dismissToast]);
  const setError = useCallback((msg) => { if (msg) toast(msg, 'error', 5000); }, [toast]);

  return { toasts, dismissToast, toast, setError };
}
