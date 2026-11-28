import { useRef } from 'react';

/**
 * Célula de texto do quadro (tabela, métricas, passos): no celular, um toque
 * entra na edição. Com mouse continua o duplo clique (um clique não edita).
 *
 * Pedido do João (28/11, iPhone): a tabela TRAÇO / LIMITE não dava para
 * editar. O duplo toque no Safari do iPhone não chega como `dblclick`.
 *
 * O foco é dado dentro do próprio toque: no iPhone o teclado só abre quando o
 * foco vem do gesto da pessoa, não de um efeito que roda depois.
 */
export function useTouchTapToEdit(ref, { enabled, editing, setEditing }) {
  const touch = useRef(false);
  return {
    onPointerDown: editing
      ? (event) => event.stopPropagation()
      : (event) => { touch.current = event.pointerType === 'touch'; },
    onClick: enabled && !editing ? (event) => {
      if (!touch.current) return;
      touch.current = false;
      event.stopPropagation();
      const el = ref.current;
      if (el) {
        el.contentEditable = 'true';
        el.focus();
        const selection = window.getSelection?.();
        const range = document.createRange?.();
        if (selection && range) {
          range.selectNodeContents(el);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      setEditing(true);
    } : undefined,
  };
}
