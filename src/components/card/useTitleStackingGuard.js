import React from 'react';
import { measureTitleStacking } from '../../utils/title-stacking.js';
import { observeOverflowInvalidations } from './render-primitives.jsx';

const NONE = Object.freeze({ key: '', leading: 0, reserve: 0 });

/**
 * Guarda de empilhamento do título (ver utils/title-stacking.js): mede o `<h1>`
 * dentro de `wrapRef` e devolve a entrelinha mínima (`leading`, em) e a reserva
 * inferior (`reserve`, em) de que ele precisa. Zero = o título fica como está.
 *
 * `key` identifica o título (texto, fonte, largura da caixa). Enquanto a chave
 * não muda, o valor só sobe: o ajuste automático pode reduzir o corpo e mudar
 * a quebra, e a guarda não pode ficar ligando e desligando.
 */
export function useTitleStackingGuard(wrapRef, key) {
  const [guard, setGuard] = React.useState(NONE);
  const measureRef = React.useRef(null);
  measureRef.current = () => {
    const h1 = wrapRef.current?.querySelector?.('h1');
    if (!h1) return;
    const next = measureTitleStacking(h1);
    // Mesmo valor devolve o mesmo objeto: sem novo render do card.
    setGuard((prev) => {
      const same = prev.key === key;
      const leading = Math.max(same ? prev.leading : 0, next.leading);
      const reserve = Math.max(same ? prev.reserve : 0, next.reserve);
      if (same && prev.leading === leading && prev.reserve === reserve) return prev;
      if (!leading && !reserve) return prev.leading || prev.reserve ? NONE : prev;
      return { key, leading, reserve };
    });
  };
  // Mede a cada render, como o OverflowScaler: o texto muda sem a zona mudar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => { measureRef.current(); });
  // Fonte que termina de carregar e quebra que muda (corpo reduzido pelo
  // ajuste automático) mudam o encontro das linhas sem novo render do card.
  React.useEffect(
    () => observeOverflowInvalidations(wrapRef.current, () => measureRef.current?.()),
    [wrapRef],
  );
  return guard.key === key ? guard : NONE;
}
