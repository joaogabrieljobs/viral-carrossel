import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Minus, Plus, Scan, ChevronLeft, ChevronRight } from 'lucide-react';
import './canvas-navigator.css';

export const clampCanvasZoom = value => Math.max(0.25, Math.min(3, Number(value) || 1));

/** Preview only: the export tree always keeps scale=1. */
export function useCanvasZoom(scrollRef, resetKey) {
  const [zoom, setZoom] = useState(1);
  const anchor = useRef(null);
  const live = useRef(zoom);
  live.current = zoom;
  const changeZoom = (value, point) => {
    const root = scrollRef.current;
    const next = clampCanvasZoom(value);
    if (root) {
      const rect = root.getBoundingClientRect();
      const x = point ? point.x - rect.left : root.clientWidth / 2;
      const y = point ? point.y - rect.top : root.clientHeight / 2;
      // Anchor within the selected card so a reflow of the desktop grid cannot
      // send the user to an unrelated row.
      const candidates = [...root.querySelectorAll('[data-canvas-card]')];
      const card = candidates.find(element => {
        const box = element.getBoundingClientRect();
        return box.left <= rect.left + x && box.right >= rect.left + x && box.top <= rect.top + y && box.bottom >= rect.top + y;
      }) || root.querySelector('[data-canvas-active="true"]');
      const box = card?.getBoundingClientRect();
      anchor.current = box ? { card, x, y, rx: (rect.left + x - box.left) / box.width, ry: (rect.top + y - box.top) / box.height } : null;
    }
    setZoom(next);
  };
  useLayoutEffect(() => {
    const root = scrollRef.current;
    const saved = anchor.current;
    if (root && saved?.card?.isConnected) {
      const rect = root.getBoundingClientRect();
      const box = saved.card.getBoundingClientRect();
      root.scrollLeft += box.left - rect.left + saved.rx * box.width - saved.x;
      root.scrollTop += box.top - rect.top + saved.ry * box.height - saved.y;
    }
    anchor.current = null;
  }, [zoom, scrollRef]);
  useEffect(() => { anchor.current = null; setZoom(1); }, [resetKey]);
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return undefined;
    let pinch = null;
    const distance = touches => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const wheel = event => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      changeZoom(live.current * Math.exp(-event.deltaY * 0.008), { x: event.clientX, y: event.clientY });
    };
    const start = event => {
      if (event.touches.length !== 2) return;
      pinch = { distance: distance(event.touches), zoom: live.current };
      root.dataset.pinching = 'true';
    };
    const move = event => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      changeZoom(pinch.zoom * distance(event.touches) / Math.max(1, pinch.distance), {
        x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
        y: (event.touches[0].clientY + event.touches[1].clientY) / 2,
      });
    };
    const end = event => {
      if (event.touches.length === 0) {
        pinch = null;
        // The parent swipe handler must still see the flag for this event.
        queueMicrotask(() => { delete root.dataset.pinching; });
      }
    };
    root.addEventListener('wheel', wheel, { passive: false });
    root.addEventListener('touchstart', start, { passive: true });
    root.addEventListener('touchmove', move, { passive: false });
    root.addEventListener('touchend', end);
    root.addEventListener('touchcancel', end);
    return () => {
      root.removeEventListener('wheel', wheel);
      root.removeEventListener('touchstart', start);
      root.removeEventListener('touchmove', move);
      root.removeEventListener('touchend', end);
      root.removeEventListener('touchcancel', end);
    };
  }, [scrollRef, resetKey]);
  return { zoom, changeZoom };
}

export function CanvasNavigator({ zoom, onZoom, onFit, index, count, onNavigate, isPresentation = false }) {
  const label = isPresentation ? 'Slide' : 'Card';
  return (
    <div className="vc-canvas-navigator" role="toolbar" aria-label="Zoom e navegação dos cards">
      <button type="button" aria-label={`${label} anterior`} disabled={index <= 0} onClick={() => onNavigate(index - 1)}><ChevronLeft size={16} /></button>
      <select aria-label="Ir para o card" value={index} onChange={e => onNavigate(Number(e.target.value))}>
        {Array.from({ length: count }, (_, i) => <option value={i} key={i}>{label} {i + 1} / {count}</option>)}
      </select>
      <button type="button" aria-label={`Próximo ${label.toLowerCase()}`} disabled={index >= count - 1} onClick={() => onNavigate(index + 1)}><ChevronRight size={16} /></button>
      <span className="vc-canvas-navigator-divider" />
      <button type="button" aria-label="Diminuir zoom" disabled={zoom <= 0.25} onClick={() => onZoom(Math.round((zoom - 0.1) * 10) / 10)}><Minus size={16} /></button>
      <output aria-label="Zoom da área de trabalho">{Math.round(zoom * 100)}%</output>
      <button type="button" aria-label="Aumentar zoom" disabled={zoom >= 3} onClick={() => onZoom(Math.round((zoom + 0.1) * 10) / 10)}><Plus size={16} /></button>
      <input className="vc-canvas-zoom-range" aria-label="Zoom dos cards" type="range" min="25" max="300" step="10" value={Math.round(zoom * 100)} onChange={e => onZoom(Number(e.target.value) / 100)} />
      <button type="button" aria-label="Ajustar cards à tela" title="Ajustar à tela" onClick={onFit}><Scan size={16} /><span className="vc-canvas-fit-label">Ajustar</span></button>
    </div>
  );
}

/** iOS ignores scrollbar width styling; this rail remains visible and draggable. */
export function MobileScrollRail({ scrollRef, watchKey }) {
  const railRef = useRef(null);
  const drag = useRef(null);
  const [metrics, setMetrics] = useState({ progress: 0, ratio: 1 });
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return undefined;
    const update = () => setMetrics({
      ratio: Math.min(1, root.clientHeight / Math.max(1, root.scrollHeight)),
      progress: Math.max(0, Math.min(1, root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight))),
      railHeight: Math.max(44, root.clientHeight - 100),
    });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    if (root.firstElementChild) observer.observe(root.firstElementChild);
    root.addEventListener('scroll', update, { passive: true });
    return () => { observer.disconnect(); root.removeEventListener('scroll', update); };
  }, [scrollRef, watchKey]);
  if (metrics.ratio >= 0.995) return null;
  const thumb = Math.min(1, Math.max(0.16, metrics.ratio, 44 / (metrics.railHeight || 200)));
  const move = event => {
    if (!drag.current) return;
    const root = scrollRef.current;
    const travel = railRef.current.clientHeight * (1 - thumb);
    root.scrollTop = drag.current.scroll + (event.clientY - drag.current.y) / Math.max(1, travel) * (root.scrollHeight - root.clientHeight);
  };
  return (
    <div ref={railRef} className="vc-mobile-scroll-rail">
      <div className="vc-mobile-scroll-track" />
      <div role="scrollbar" aria-label="Rolar área dos cards" aria-controls="vc-cards-viewport" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(metrics.progress * 100)} tabIndex={0}
        className="vc-mobile-scroll-thumb"
        style={{ height: `${thumb * 100}%`, top: `${metrics.progress * (1 - thumb) * 100}%` }}
        onPointerDown={event => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { y: event.clientY, scroll: scrollRef.current.scrollTop };
        }}
        onPointerMove={move}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onKeyDown={event => {
          const root = scrollRef.current;
          const delta = { ArrowDown: 48, ArrowUp: -48, PageDown: root.clientHeight * 0.8, PageUp: -root.clientHeight * 0.8 };
          if (event.key in delta) { event.preventDefault(); root.scrollTop += delta[event.key]; }
          if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); root.scrollTop = event.key === 'Home' ? 0 : root.scrollHeight; }
        }}
      ><span /></div>
    </div>
  );
}
