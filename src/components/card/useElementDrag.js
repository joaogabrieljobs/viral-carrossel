import React from 'react';
import { getElementOffset, clampOffsetPct } from '../../utils/card-elements.js';

/** Abaixo disto o gesto ainda é clique — abrir a foto, selecionar o card. */
const LIMIAR_ARRASTO_PX = 4;

/**
 * Arrastar qualquer elemento do card com o rato ou o dedo.
 *
 * Devolve uma fábrica: `bind(chave)` produz as props a espalhar no elemento.
 * O clique só vira arrasto depois de {@link LIMIAR_ARRASTO_PX} — sem isso um
 * toque na zona da foto passaria a arrastar em vez de abrir o importador.
 *
 * `interactionScale` é o `transform: scale()` da pré-visualização. O ponteiro
 * anda em pixels de ecrã e o offset é em pixels do card (1080 de largura), por
 * isso todo delta é dividido pela escala — sem isso o elemento anda mais devagar
 * que o dedo, e quanto menor a miniatura pior fica.
 */
export function useElementDrag({ f, slide, onOffsetChange, enabled, interactionScale = 1 }) {
  const arrasto = React.useRef(null);
  const slideRef = React.useRef(slide);
  slideRef.current = slide;
  const onChangeRef = React.useRef(onOffsetChange);
  onChangeRef.current = onOffsetChange;

  const fim = React.useCallback((ev) => {
    const d = arrasto.current;
    arrasto.current = null;
    if (!d) return;
    try { ev?.currentTarget?.releasePointerCapture?.(d.pointerId); } catch { /* ignore */ }
    // Passou do limiar: engole o clique que o browser dispara a seguir, senão
    // soltar o título em cima da zona da foto abriria o seletor de imagem.
    if (d.moveu) {
      const engole = (e) => { e.stopPropagation(); e.preventDefault(); };
      window.addEventListener('click', engole, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', engole, { capture: true }), 0);
    }
  }, []);

  const move = React.useCallback((ev) => {
    const d = arrasto.current;
    if (!d) return;
    const esc = Math.max(0.05, interactionScale || 1);
    // Acumula contra o offset capturado no pointerdown, NÃO contra o slide atual:
    // vários pointermove cabem entre dois renders, e reler o slide a cada um
    // fazia todos partirem do mesmo valor — o arrasto rápido perdia distância
    // (medido: 40px de gesto viravam 15px de deslocamento).
    d.totalX = (ev.clientX - d.startX) / esc;
    d.totalY = (ev.clientY - d.startY) / esc;
    if (!d.moveu && Math.abs(d.totalX) + Math.abs(d.totalY) < LIMIAR_ARRASTO_PX) return;
    d.moveu = true;
    onChangeRef.current?.(d.chave, {
      x: clampOffsetPct(d.baseX + (d.totalX / f.w) * 100),
      y: clampOffsetPct(d.baseY + (d.totalY / f.h) * 100),
    });
  }, [f, interactionScale]);

  const bind = React.useCallback((chave) => {
    if (!enabled) return null;
    return {
      onPointerDown: (ev) => {
        if (ev.button != null && ev.button !== 0) return;
        ev.stopPropagation();
        const base = getElementOffset(slideRef.current, chave);
        arrasto.current = {
          chave, pointerId: ev.pointerId,
          startX: ev.clientX, startY: ev.clientY,
          baseX: base.x, baseY: base.y,
          totalX: 0, totalY: 0, moveu: false,
        };
        try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch { /* ignore */ }
      },
      onPointerMove: move,
      onPointerUp: fim,
      onPointerCancel: fim,
      style: { cursor: 'grab', touchAction: 'none' },
    };
  }, [enabled, move, fim]);

  return bind;
}

export { LIMIAR_ARRASTO_PX };
