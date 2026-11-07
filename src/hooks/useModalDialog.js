import { useCallback, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const visibleFocusableElements = (dialog) => (
  [...(dialog?.querySelectorAll?.(FOCUSABLE_SELECTOR) || [])]
    .filter((element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true')
);

/**
 * Torna somente a subárvore do modal interativa.
 *
 * O diálogo vive dentro do editor (não em um portal no `body`). Por isso,
 * percorremos os ancestrais do overlay e marcamos os irmãos de cada nível
 * como `inert`. Assim inputs de arquivo, atalhos e botões atrás do overlay não
 * continuam acionáveis. Os valores anteriores são preservados para suportar
 * diálogos aninhados.
 */
const isolateModalTree = (overlay) => {
  if (!overlay?.parentElement) return () => {};

  const restores = [];
  let branch = overlay;
  while (branch?.parentElement) {
    const parent = branch.parentElement;
    for (const sibling of parent.children) {
      if (sibling === branch) continue;
      const hadInert = sibling.hasAttribute('inert');
      const previousAriaHidden = sibling.getAttribute('aria-hidden');
      sibling.setAttribute('inert', '');
      sibling.setAttribute('aria-hidden', 'true');
      restores.push(() => {
        if (!hadInert) sibling.removeAttribute('inert');
        if (previousAriaHidden == null) sibling.removeAttribute('aria-hidden');
        else sibling.setAttribute('aria-hidden', previousAriaHidden);
      });
    }
    branch = parent;
    if (parent === document.body) break;
  }

  return () => {
    for (let index = restores.length - 1; index >= 0; index -= 1) restores[index]();
  };
};

/**
 * Contrato comum para diálogos do editor: foco inicial, Escape, armadilha de
 * Tab, restauração do foco e bloqueio real do conteúdo de fundo.
 */
export function useModalDialog({ open, onClose, initialFocusRef = null }) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    returnFocusRef.current = document.activeElement;
    const dialog = dialogRef.current;
    const initialTarget = initialFocusRef?.current || visibleFocusableElements(dialog)[0] || dialog;
    initialTarget?.focus?.({ preventScroll: true });
    const restoreModalTree = isolateModalTree(overlayRef.current);

    const keepFocusInside = (event) => {
      if (!dialogRef.current || dialogRef.current.contains(event.target)) return;
      const target = visibleFocusableElements(dialogRef.current)[0] || dialogRef.current;
      target?.focus?.({ preventScroll: true });
    };
    document.addEventListener('focusin', keepFocusInside, true);

    return () => {
      document.removeEventListener('focusin', keepFocusInside, true);
      restoreModalTree();
      const returnTarget = returnFocusRef.current;
      window.requestAnimationFrame(() => {
        if (returnTarget instanceof HTMLElement && returnTarget.isConnected) {
          returnTarget.focus({ preventScroll: true });
        }
      });
    };
  }, [open, initialFocusRef]);

  const onDialogKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current?.();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;

    const controls = visibleFocusableElements(dialogRef.current);
    if (!controls.length) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  return { overlayRef, dialogRef, onDialogKeyDown, returnFocusRef };
}

