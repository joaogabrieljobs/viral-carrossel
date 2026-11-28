import React, { useEffect, useRef } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { wheelValue } from '../../utils/text-size-wheel.js';

/**
 * Roda de tamanho da letra no celular (pedido do João, 28/11). Aparece quando
 * uma caixa de texto está selecionada; girar para cima (ou para a direita, na
 * versão deitada) aumenta, para baixo diminui. Cada mudança vai direto para o
 * card, então dá para ver o resultado enquanto gira. O histórico junta as
 * mudanças seguidas num só Desfazer.
 */
export default function FontSizeWheel({
  label, value, min, max, step = 1, onChange, onClose,
  orientation = 'vertical', length = 200, style,
}) {
  const vertical = orientation === 'vertical';
  const rootRef = useRef(null);
  const drag = useRef(null);
  const latest = useRef(value);
  latest.current = value;

  // A pinça e o arrasto do quadro escutam toque nativo: a roda fica com o dedo.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const stop = (event) => event.stopPropagation();
    el.addEventListener('touchstart', stop, { passive: true });
    el.addEventListener('touchmove', stop, { passive: true });
    return () => {
      el.removeEventListener('touchstart', stop);
      el.removeEventListener('touchmove', stop);
    };
  }, []);

  const emit = (next) => { if (next !== latest.current) onChange(next); };
  const nudge = (dir) => emit(wheelValue({ start: latest.current + dir * step, pixels: 0, min, max, step }));

  const onPointerDown = (event) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: latest.current };
  };
  const onPointerMove = (event) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    event.stopPropagation();
    const pixels = vertical ? d.y - event.clientY : event.clientX - d.x;
    emit(wheelValue({ start: d.start, pixels, min, max, step }));
  };
  const onPointerEnd = (event) => {
    if (drag.current?.id === event.pointerId) drag.current = null;
  };
  const onKeyDown = (event) => {
    if (['ArrowUp', 'ArrowRight'].includes(event.key)) { event.preventDefault(); nudge(1); }
    if (['ArrowDown', 'ArrowLeft'].includes(event.key)) { event.preventDefault(); nudge(-1); }
  };

  // As ranhuras andam com o valor: parece uma roda girando.
  const offset = ((value - min) / (max - min)) * 360;
  const ridges = vertical
    ? { backgroundImage: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.28) 0 1px, transparent 1px 9px)', backgroundPosition: `0 ${-offset}px` }
    : { backgroundImage: 'repeating-linear-gradient(to right, rgba(255,255,255,0.28) 0 1px, transparent 1px 9px)', backgroundPosition: `${offset}px 0` };
  const shown = step < 1 ? value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : Math.round(value);
  // Deitada, os botões têm 44 px de largura; em pé, 38 px de altura deixam
  // mais roda para girar.
  const button = {
    width: 44, height: vertical ? 38 : 44, flexShrink: 0, borderRadius: 9999, border: 'none', cursor: 'pointer',
    background: 'transparent', color: 'var(--text-primary)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };

  const plus = (
    <button type="button" aria-label={`Aumentar o ${label}`} onClick={() => nudge(1)} style={button}><Plus size={18} /></button>
  );
  const minus = (
    <button type="button" aria-label={`Diminuir o ${label}`} onClick={() => nudge(-1)} style={button}><Minus size={18} /></button>
  );

  return (
    <div
      ref={rootRef}
      data-vc-font-wheel={orientation}
      style={{
        display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center',
        [vertical ? 'height' : 'width']: length, [vertical ? 'width' : 'height']: 44,
        borderRadius: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)', touchAction: 'none', userSelect: 'none',
        WebkitUserSelect: 'none', zIndex: 7, ...style,
      }}
    >
      {onClose ? (
        <button type="button" aria-label="Fechar ajuste de tamanho" onClick={onClose} style={{ ...button, color: 'var(--accent)' }}>
          <Check size={18} />
        </button>
      ) : null}
      {vertical ? plus : minus}
      <div
        role="slider"
        tabIndex={0}
        aria-label={`Tamanho do ${label}`}
        aria-orientation={orientation}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={String(shown)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onTouchStart={(event) => event.stopPropagation()}
        onTouchEnd={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        style={{
          flex: 1, alignSelf: 'stretch', position: 'relative', cursor: vertical ? 'ns-resize' : 'ew-resize',
          margin: vertical ? '2px 6px' : '6px 2px', borderRadius: 9999, overflow: 'hidden',
          background: 'rgba(255,255,255,0.06)', ...ridges,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{
          padding: '3px 6px', borderRadius: 8, background: 'var(--accent)', color: 'var(--accent-on-dark, #111)',
          fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
          pointerEvents: 'none',
        }}>{shown}</span>
      </div>
      {vertical ? minus : plus}
    </div>
  );
}
