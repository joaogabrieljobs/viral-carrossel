// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useEffect, useRef, useMemo } from 'react';
import { Shuffle } from 'lucide-react';
import { clampRect } from '../../utils/canvas-layout.js';

function vcIsCoarseTouchDevice() {
  return typeof window !== 'undefined' &&
    ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0);
}

/** Distância máx. (Manhattan em px) para contar «toque» na zona foto — 18px era pouco com rato em card escalado. */
function vcPhotoZoneTapSlopPx() {
  if (typeof window === 'undefined') return 72;
  try {
    if (window.matchMedia?.('(pointer: coarse)').matches) return 140;
  } catch { /* ignore */ }
  if (vcIsCoarseTouchDevice()) return 140;
  return 72;
}

function pctBox(rect, f) {
  const r = clampRect(rect);
  return {
    position: 'absolute',
    left: (f.w * r.x) / 100,
    top: (f.h * r.y) / 100,
    width: (f.w * r.w) / 100,
    height: (f.h * r.h) / 100,
    boxSizing: 'border-box',
  };
}

const VC_ZONE_DRAG_MIME = 'application/x-vc-canvas-zone';

/** Contorno + arrastar / redimensionar canto SE (zonas canvas). Opcional: grip para trocar conteúdo entre slides.
 *  A zona `photo` fica por cima do conteúdo — `photoZoneTap` abre o import de imagem em clique simples (sem arrasto). */
/** `interactionScale` = `transform: scale()` aplicado ao card na pré-visualização; sem isto o arrasto em ecrã fica «lento/errado» no telemóvel. */
function CanvasZonesOverlay({ f, zones, keys, onPatch, swapSlideIdx = null, swapZoneKeys, photoZoneTap = null, photoZoneFileChange = null, interactionScale = 1 }) {
  const dragRef = React.useRef(null);
  const zonesRef = React.useRef(zones);
  zonesRef.current = zones;

  const swapKeysEffective = React.useMemo(() => {
    if (swapSlideIdx == null) return null;
    if (Array.isArray(swapZoneKeys) && swapZoneKeys.length === 0) return [];
    const allow = swapZoneKeys && swapZoneKeys.length
      ? new Set(swapZoneKeys)
      : null;
    return keys.filter((k) => (allow ? allow.has(k) : true));
  }, [keys, swapSlideIdx, swapZoneKeys]);

  React.useEffect(() => {
    const sPx = Math.max(0.05, interactionScale || 1);
    const step = (clientX, clientY) => {
      const d = dragRef.current;
      if (!d || !onPatch) return;
      const dx = clientX - d.lastX;
      const dy = clientY - d.lastY;
      d.dist = (d.dist ?? 0) + Math.abs(dx) + Math.abs(dy);
      d.lastX = clientX;
      d.lastY = clientY;
      const cur = zonesRef.current[d.key];
      if (!cur) return;
      const b = clampRect(cur);
      const nx = dx / (f.w * sPx);
      const ny = dy / (f.h * sPx);
      if (d.mode === 'move') {
        onPatch({
          [d.key]: clampRect({
            ...b,
            x: b.x + nx * 100,
            y: b.y + ny * 100,
          }),
        });
      } else {
        onPatch({
          [d.key]: clampRect({
            ...b,
            w: b.w + nx * 100,
            h: b.h + ny * 100,
          }),
        });
      }
    };

    const mm = (e) => step(e.clientX, e.clientY);
    const tm = (e) => {
      if (!dragRef.current || !e.touches?.[0]) return;
      step(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    };
    /** Toque rápido sem arrasto relevante na zona foto = import (telemóveis: jitter do dedo aumenta tolerância). */
    const finish = () => {
      const d = dragRef.current;
      if (!d?.key || !photoZoneTap) {
        dragRef.current = null;
        return;
      }
      const tapSlop = d.key === 'photo' ? vcPhotoZoneTapSlopPx() : 18;
      /*
       * Toque na zona foto: `el.click()` no input file tem de correr no mesmo turno que o toque do utilizador
       * (Safari iOS). `tryPhotoZoneTapOnTouch` no `onTouchEnd` da zona faz isso.
       * O `touchend` no window pode disparar *antes* do handler da zona com delegação React — não esvaziar
       * `dragRef` aqui, senão o tap perde o estado. Limpa num microtask se a zona não consumiu.
       */
      if (d.key === 'photo' && d.fromTouch) {
        queueMicrotask(() => {
          if (dragRef.current === d) dragRef.current = null;
        });
        return;
      }
      dragRef.current = null;
      if (d.key === 'photo' && d.mode === 'move' && (d.dist ?? 0) < tapSlop) photoZoneTap();
    };

    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', finish);
    window.addEventListener('touchmove', tm, { passive: false });
    window.addEventListener('touchend', finish);
    window.addEventListener('touchcancel', finish);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', finish);
      window.removeEventListener('touchmove', tm);
      window.removeEventListener('touchend', finish);
      window.removeEventListener('touchcancel', finish);
    };
  }, [f.h, f.w, onPatch, photoZoneTap, interactionScale]);

  if (!zones || !onPatch) return null;

  return (
    <>
      {keys.map((k) => {
        if (!zones[k]) return null;
        const r = clampRect(zones[k]);
        const box = pctBox(r, f);
        const showSwapGrip = swapKeysEffective && swapKeysEffective.includes(k);

        const startResizeTouch = (e) => {
          const t = e.touches?.[0];
          if (!t) return;
          e.preventDefault();
          e.stopPropagation();
          dragRef.current = {
            key: k,
            mode: 'se',
            lastX: t.clientX,
            lastY: t.clientY,
            dist: 0,
          };
        };

        const startMove = (clientX, clientY, ev) => {
          ev.preventDefault?.();
          ev.stopPropagation?.();
          const fromTouch = !!(ev && String(ev.type || '').startsWith('touch'));
          dragRef.current = {
            key: k,
            mode: 'move',
            lastX: clientX,
            lastY: clientY,
            dist: 0,
            fromTouch,
          };
        };

        /** Safari/iOS: `input.click()` tem de correr na mesma cadeia do toque do utilizador.
         *  Abre o import aqui no `onTouchEnd` da zona; o fallback no `window` (`finish`) cobre rato. */
        const photoTapSlop = k === 'photo' ? vcPhotoZoneTapSlopPx() : 18;
        const tryPhotoZoneTapOnTouch = (e) => {
          if (k !== 'photo' || !photoZoneTap) return;
          const d = dragRef.current;
          if (!d || d.key !== 'photo' || d.mode !== 'move') return;
          if ((d.dist ?? 0) >= photoTapSlop) {
            dragRef.current = null;
            return;
          }
          e.stopPropagation();
          photoZoneTap();
          dragRef.current = null;
        };
        /** Rato: abre o ficheiro no `mouseup` da própria zona (mais fiável com delegação React / escalado). */
        const tryPhotoZoneTapOnMouseUp = (e) => {
          if (k !== 'photo' || !photoZoneTap) return;
          if (e.button !== 0) return;
          const d = dragRef.current;
          if (!d || d.key !== 'photo' || d.mode !== 'move' || d.fromTouch) return;
          if ((d.dist ?? 0) >= photoTapSlop) return;
          e.stopPropagation();
          photoZoneTap();
          dragRef.current = null;
        };

        return (
          <div
            key={k}
            style={{
              ...box,
              zIndex: 45,
              pointerEvents: 'auto',
              touchAction: 'none',
              border: '2px dashed var(--accent)',
              borderRadius: 8,
              background: 'var(--accent-surface)',
            }}
            onTouchStart={(e) => {
              if (e.target.closest('input[type="file"]') || e.target.closest('[data-vc-handle]') || e.target.closest('[data-vc-swap-grip]')) return;
              const t = e.touches[0];
              if (!t) return;
              startMove(t.clientX, t.clientY, e);
            }}
            onTouchEnd={(e) => {
              if (e.target.closest('input[type="file"]') || e.target.closest('[data-vc-handle]') || e.target.closest('[data-vc-swap-grip]')) return;
              tryPhotoZoneTapOnTouch(e);
            }}
            onMouseDown={(e) => {
              if (e.target.closest('input[type="file"]') || e.target.closest('[data-vc-handle]') || e.target.closest('[data-vc-swap-grip]')) return;
              startMove(e.clientX, e.clientY, e);
            }}
            onMouseUp={(e) => {
              if (e.target.closest('input[type="file"]') || e.target.closest('[data-vc-handle]') || e.target.closest('[data-vc-swap-grip]')) return;
              tryPhotoZoneTapOnMouseUp(e);
            }}
          >
            {k === 'photo' && photoZoneFileChange ? (
              <input
                type="file"
                accept="image/*"
                onChange={photoZoneFileChange}
                onTouchStart={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  left: '10%',
                  top: '10%',
                  width: '80%',
                  height: '80%',
                  opacity: 0.03,
                  zIndex: 1,
                  fontSize: 24,
                  cursor: 'pointer',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  boxSizing: 'border-box',
                }}
                aria-label="Importar imagem — toque no centro; arraste pelas bordas da moldura para mover"
              />
            ) : null}
            {showSwapGrip && (
              <div
                data-vc-swap-grip
                draggable
                title="Arrastar para outro card para trocar conteúdo"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    VC_ZONE_DRAG_MIME,
                    JSON.stringify({ slideIdx: swapSlideIdx, zone: k }),
                  );
                  e.dataTransfer.effectAllowed = 'copyMove';
                }}
                style={{
                  position: 'absolute',
                  left: 5,
                  top: 5,
                  padding: '6px 12px',
                  minWidth: 36,
                  minHeight: 32,
                  borderRadius: 9999,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--font-ui)',
                  letterSpacing: '-0.022em',
                  background: 'var(--accent)',
                  color: '#fff',
                  cursor: 'grab',
                  zIndex: 2,
                  lineHeight: 1.2,
                  userSelect: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              ><Shuffle size={14} aria-hidden/></div>
            )}
            <div
              data-vc-handle
              title="Redimensionar"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dragRef.current = {
                  key: k,
                  mode: 'se',
                  lastX: e.clientX,
                  lastY: e.clientY,
                  dist: 0,
                };
              }}
              onTouchStart={startResizeTouch}
              style={{
                position: 'absolute',
                right: -4,
                bottom: -4,
                width: 18,
                height: 18,
                borderRadius: 3,
                background: 'var(--accent)',
                cursor: 'nwse-resize',
                border: '2px solid #fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              }}
            />
          </div>
        );
      })}
    </>
  );
}

export {
  vcIsCoarseTouchDevice,
  vcPhotoZoneTapSlopPx,
  pctBox,
  VC_ZONE_DRAG_MIME,
  CanvasZonesOverlay,
};
