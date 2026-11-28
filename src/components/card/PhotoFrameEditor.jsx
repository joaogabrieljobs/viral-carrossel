import React from 'react';
import {
  moveFrameRect, panPhoto, photoCropState, resizeFrameRect, zoomPhoto,
} from '../../utils/photo-frame.js';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const HANDLE_CURSOR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
const HANDLE_LABEL = {
  nw: 'canto superior esquerdo', n: 'borda de cima', ne: 'canto superior direito', e: 'borda direita',
  se: 'canto inferior direito', s: 'borda de baixo', sw: 'canto inferior esquerdo', w: 'borda esquerda',
};
/** Abaixo disto o gesto ainda é toque (selecionar, duplo toque). */
const DRAG_THRESHOLD_PX = 4;
const DOUBLE_TAP_MS = 320;

/** Alça por dentro da moldura: a foto em tela cheia encosta na borda do card,
 *  que corta o que passa dela (a alça centrada no canto mostrava só um quarto). */
function handlePosition(handle) {
  const x = handle.includes('w') ? 0 : handle.includes('e') ? 100 : 50;
  const y = handle.includes('n') ? 0 : handle.includes('s') ? 100 : 50;
  const shift = (v) => (v === 0 ? '0' : v === 100 ? '-100%' : '-50%');
  return { left: `${x}%`, top: `${y}%`, transform: `translate(${shift(x)}, ${shift(y)})` };
}

/**
 * Edição da foto direto no card, depois de selecioná-la (pedido do João, 27/11):
 *
 * - arrastar a foto move a moldura no card (com a mão);
 * - as alças nos cantos e nas bordas mudam o tamanho da moldura;
 * - duplo clique (ou duplo toque) entra no recorte: a moldura fica parada, a
 *   imagem anda dentro dela e ganha zoom pela roda, pela pinça ou pelos botões.
 *   Esc, "Concluir" ou um toque fora saem do recorte.
 *
 * Cada movimento grava (`onPatch`); o histórico junta os passos de um mesmo
 * gesto num desfazer só. `rect` é a zona da foto em % do card; `frame` é o
 * tamanho do card em px (1080 de largura); `slide` traz o enquadramento atual.
 */
export default function PhotoFrameEditor({ rect, frame, slide, imageSrc, onPatch, interactionScale = 1 }) {
  const [mode, setMode] = React.useState('frame');
  const [imageSize, setImageSize] = React.useState(null);
  const rootRef = React.useRef(null);
  const gesture = React.useRef(null);
  const pointers = React.useRef(new Map());
  const lastTap = React.useRef(0);
  const live = React.useRef({ rect, slide, onPatch, mode, imageSize });
  live.current = { rect, slide, onPatch, mode, imageSize };

  React.useEffect(() => {
    if (!imageSrc || typeof window === 'undefined' || !window.Image) return undefined;
    let alive = true;
    const img = new window.Image();
    img.onload = () => { if (alive) setImageSize({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.src = imageSrc;
    return () => { alive = false; };
  }, [imageSrc]);

  const cardBox = () => rootRef.current?.parentElement?.getBoundingClientRect?.() || null;
  // Tamanho real da imagem para medir a sobra. Se o carregamento assíncrono
  // ainda não respondeu, a imagem já está no cache do card: ler na hora evita
  // o primeiro arrasto sem efeito (sobra zero).
  const knownImageSize = () => {
    if (live.current.imageSize) return live.current.imageSize;
    if (!imageSrc || typeof window === 'undefined' || !window.Image) return null;
    const img = new window.Image();
    img.src = imageSrc;
    return img.complete && img.naturalWidth ? { w: img.naturalWidth, h: img.naturalHeight } : null;
  };
  const frameGeometry = () => {
    const { rect: r } = live.current;
    const size = knownImageSize();
    return {
      frameW: (r.w / 100) * frame.w,
      frameH: (r.h / 100) * frame.h,
      imageW: size?.w || 0,
      imageH: size?.h || 0,
    };
  };

  // Recorte: Esc e toque fora saem.
  React.useEffect(() => {
    if (mode !== 'crop') return undefined;
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); setMode('frame'); } };
    const onDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setMode('frame');
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [mode]);

  // Roda do mouse dá zoom no recorte. Precisa de listener não passivo para
  // impedir a rolagem da página.
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el || mode !== 'crop') return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const state = photoCropState(live.current.slide);
      live.current.onPatch?.(zoomPhoto(state, Math.exp(-event.deltaY * 0.0015)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [mode]);

  const cancelFrameGesture = () => {
    const g = gesture.current;
    gesture.current = null;
    if (g?.moved && (g.kind === 'move' || g.kind === 'resize')) live.current.onPatch?.({ zone: g.rect });
  };

  // O deslize do carrossel e a pinça do zoom da tela escutam toque direto no
  // DOM (fora do React). Parar aqui, no próprio elemento, impede que mexer na
  // foto troque de card ou amplie a tela inteira.
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const stop = (event) => {
      // Fora do recorte, dois dedos são o zoom da tela: o gesto da moldura é
      // desfeito e o toque segue para o zoom.
      if (live.current.mode !== 'crop' && (event.touches?.length || 0) >= 2) {
        cancelFrameGesture();
        return;
      }
      event.stopPropagation();
    };
    const kinds = ['touchstart', 'touchmove', 'touchend', 'touchcancel'];
    kinds.forEach((kind) => el.addEventListener(kind, stop, { passive: true }));
    return () => kinds.forEach((kind) => el.removeEventListener(kind, stop));
  }, []);

  const startGesture = (event, kind, handle = null) => {
    if (event.button != null && event.button !== 0) return;
    event.stopPropagation();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* sem captura */ }
    const box = cardBox();
    if (!box?.width) return;
    if (pointers.current.size >= 2 && live.current.mode !== 'crop') { cancelFrameGesture(); return; }
    if (pointers.current.size === 2 && live.current.mode === 'crop') {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: 'pinch', distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, state: photoCropState(live.current.slide), box };
      return;
    }
    gesture.current = {
      kind, handle, box, moved: false,
      startX: event.clientX, startY: event.clientY,
      rect: { ...live.current.rect },
      state: photoCropState(live.current.slide),
    };
  };

  const moveGesture = (event) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (!g) return;
    event.stopPropagation();
    if (event.cancelable) event.preventDefault();
    if (g.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      live.current.onPatch?.(zoomPhoto(g.state, Math.hypot(a.x - b.x, a.y - b.y) / g.distance));
      return;
    }
    const sx = event.clientX - g.startX;
    const sy = event.clientY - g.startY;
    if (!g.moved && Math.abs(sx) + Math.abs(sy) < DRAG_THRESHOLD_PX) return;
    g.moved = true;
    const dxPct = (sx / g.box.width) * 100;
    const dyPct = (sy / g.box.height) * 100;
    if (g.kind === 'move') live.current.onPatch?.({ zone: moveFrameRect(g.rect, dxPct, dyPct) });
    else if (g.kind === 'resize') live.current.onPatch?.({ zone: resizeFrameRect(g.rect, g.handle, dxPct, dyPct) });
    else if (g.kind === 'pan') {
      live.current.onPatch?.(panPhoto(g.state, (dxPct / 100) * frame.w, (dyPct / 100) * frame.h, frameGeometry()));
    }
  };

  const endGesture = (event) => {
    pointers.current.delete(event.pointerId);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* sem captura */ }
    const g = gesture.current;
    if (pointers.current.size > 0) {
      // Saiu um dedo da pinça: o outro continua arrastando a partir daqui.
      if (g?.kind === 'pinch') {
        const [p] = [...pointers.current.values()];
        gesture.current = { kind: 'pan', box: g.box, moved: true, startX: p.x, startY: p.y, state: photoCropState(live.current.slide) };
      }
      return;
    }
    gesture.current = null;
    if (!g) return;
    event.stopPropagation();
    if (g.moved) {
      // Engole o clique que o navegador dispara depois do arrasto.
      const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
      return;
    }
    // Duplo toque no celular (o dblclick nem sempre chega com touch-action: none).
    if (g.kind === 'move' && event.pointerType !== 'mouse') {
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) { lastTap.current = 0; setMode('crop'); }
      else lastTap.current = now;
    }
  };

  const zoomBy = (factor) => (event) => {
    event.stopPropagation();
    onPatch?.(zoomPhoto(photoCropState(slide), factor));
  };

  const onKeyDown = (event) => {
    const step = event.shiftKey ? 5 : 1;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (event.key === 'Enter' && mode === 'frame') { event.preventDefault(); event.stopPropagation(); setMode('crop'); return; }
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    if (mode === 'frame') onPatch?.({ zone: moveFrameRect(rect, delta[0], delta[1]) });
    else onPatch?.(panPhoto(photoCropState(slide), -delta[0] * 10, -delta[1] * 10, frameGeometry()));
  };

  const scale = Math.max(0.05, interactionScale || 1);
  const handlePx = Math.max(14, 18 / scale);
  const ui = (px) => px / scale;
  const crop = mode === 'crop';
  return <div
    ref={rootRef}
    data-vc-photo-frame-editor={mode}
    role="group"
    aria-label={crop
      ? 'Recorte da foto: arraste para enquadrar, use a roda, a pinça ou os botões para zoom; Esc conclui'
      : 'Foto selecionada: arraste para mover, use as alças para mudar o tamanho, duplo clique para recortar'}
    tabIndex={0}
    onKeyDown={onKeyDown}
    onClick={(event) => event.stopPropagation()}
    onDoubleClick={(event) => { event.stopPropagation(); setMode('crop'); }}
    onPointerDown={(event) => startGesture(event, crop ? 'pan' : 'move')}
    onPointerMove={moveGesture}
    onPointerUp={endGesture}
    onPointerCancel={endGesture}
    style={{
      position: 'absolute', left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%`,
      boxSizing: 'border-box', zIndex: crop ? 40 : 3, touchAction: 'none',
      userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
      cursor: crop ? 'grab' : 'move',
      outline: `${ui(2)}px ${crop ? 'dashed' : 'solid'} ${crop ? '#D9F95B' : '#6D5EF8'}`,
      outlineOffset: 0,
      boxShadow: crop ? `0 0 0 ${frame.w * 2}px rgba(10, 9, 8, 0.45)` : 'none',
    }}
  >
    {crop ? <div
      onPointerDown={(event) => event.stopPropagation()}
      style={{ position: 'absolute', left: '50%', bottom: ui(12), transform: 'translateX(-50%)', display: 'flex', gap: ui(6),
        alignItems: 'center', padding: ui(6), borderRadius: ui(999), background: 'rgba(16, 15, 24, 0.88)', zIndex: 2 }}
    >
      <button type="button" aria-label="Diminuir o zoom da foto" onClick={zoomBy(1 / 1.15)} style={pill(ui)}>−</button>
      <button type="button" aria-label="Aumentar o zoom da foto" onClick={zoomBy(1.15)} style={pill(ui)}>+</button>
      <button type="button" onClick={(event) => { event.stopPropagation(); setMode('frame'); }} style={{ ...pill(ui), background: '#D9F95B', color: '#14121F', padding: `0 ${ui(14)}px` }}>Concluir</button>
    </div> : HANDLES.map((handle) => <span
      key={handle}
      role="button"
      aria-label={`Redimensionar a foto pelo ${HANDLE_LABEL[handle]}`}
      data-vc-photo-handle={handle}
      onPointerDown={(event) => startGesture(event, 'resize', handle)}
      onPointerMove={moveGesture}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      style={{
        position: 'absolute', ...handlePosition(handle), width: handlePx, height: handlePx,
        borderRadius: handle.length === 2 ? '50%' : ui(4),
        background: '#FFFFFF', border: `${ui(2)}px solid #6D5EF8`, boxSizing: 'border-box',
        cursor: HANDLE_CURSOR[handle], touchAction: 'none', zIndex: 41,
      }}
    />)}
  </div>;
}

function pill(ui) {
  return {
    minWidth: ui(36), height: ui(36), borderRadius: ui(999), border: 'none', cursor: 'pointer',
    background: 'rgba(255, 255, 255, 0.14)', color: '#FFFFFF', fontSize: ui(18), fontWeight: 600, fontFamily: 'inherit', lineHeight: 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  };
}
