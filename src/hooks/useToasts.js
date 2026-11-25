/** Fila de toasts do app + atalho setError (toast de erro com TTL maior). */
import { useState, useCallback } from 'react';
import { uid } from '../utils/doc-schema.js';
import { translateStorageErrorText } from '../utils/storage-error-message.js';

export function toastTtl(kind = 'info', ttl = null) {
  // Erros ficam tempo suficiente para leitura, mas também saem sozinhos.
  // Chamadas realmente bloqueantes ainda podem informar `ttl = 0`.
  const fallbackTtl = kind === 'error' ? 7000 : 3500;
  return Number.isFinite(ttl) ? Math.max(0, ttl) : fallbackTtl;
}

/** Nenhum aviso repete o erro cru de armazenamento do navegador (em inglês). */
export function toastMessage(message) {
  return typeof message === 'string' ? translateStorageErrorText(message) : message;
}

export function useToasts() {
  // ── TOAST helpers — declarados ANTES de qualquer callback que os referencie
  // no array de deps (exportDoc, exportAllDocs etc.). Ordem importa: deps array
  // é avaliado no momento do useCallback, e const é TDZ até a linha rodar.
  const [toasts, setToasts] = useState([]);
  const dismissToast = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);
  // `options.action` ({ label, onClick }) põe um botão no próprio aviso: quem
  // lê "dá para desfazer" precisa do controle ali, inclusive no celular.
  const toast = useCallback((message, kind='info', ttl=null, options=null) => {
    const id = uid();
    const action = options?.action?.label && typeof options.action.onClick === 'function'
      ? { label: String(options.action.label), onClick: options.action.onClick } : null;
    setToasts(t => [...t, { id, message: toastMessage(message), kind, ...(action ? { action } : {}) }]);
    const effectiveTtl = toastTtl(kind, ttl);
    if (effectiveTtl > 0) setTimeout(() => dismissToast(id), effectiveTtl);
    return id;
  }, [dismissToast]);
  const setError = useCallback((msg) => { if (msg) toast(msg, 'error', 7000); }, [toast]);

  return { toasts, dismissToast, toast, setError };
}
