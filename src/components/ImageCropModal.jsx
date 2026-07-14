import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock.js';
import { FORMATS } from '../utils/formats.js';

export default function ImageCropModal({ open, imageSrc, onClose, onApply }) {
  useScrollLock(open);
  const carAr = FORMATS.carrossel.w / FORMATS.carrossel.h;
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [cropN, setCropN] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [lockStory, setLockStory] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const dragRef = useRef(null);
  const natRef = useRef({ w: 0, h: 0 });
  const dispRef = useRef({ w: 0, h: 0 });
  const lockStoryRef = useRef(true);
  lockStoryRef.current = lockStory;

  const maxWp = typeof window !== 'undefined' ? Math.min(520, window.innerWidth - 48) : 520;
  const maxHp = typeof window !== 'undefined' ? Math.min(Math.floor(window.innerHeight * 0.46), 440) : 440;
  const previewScale =
    open && nat.w > 0 && nat.h > 0 ? Math.min(maxWp / nat.w, maxHp / nat.h, 1) : 1;
  const dwPx = open && nat.w > 0 ? Math.max(1, Math.round(nat.w * previewScale)) : 1;
  const dhPx = open && nat.h > 0 ? Math.max(1, Math.round(nat.h * previewScale)) : 1;
  natRef.current = nat;
  dispRef.current = { w: dwPx, h: dhPx };

  const fullImageCrop = useCallback((nw, nh) => ({ x: 0, y: 0, w: nw, h: nh }), []);

  const centeredLockedCrop = useCallback((nw, nh) => {
    let iw = Math.min(nw, nh * carAr);
    let ih = iw / carAr;
    if (ih > nh) {
      ih = nh;
      iw = ih * carAr;
    }
    return { x: (nw - iw) / 2, y: (nh - ih) / 2, w: iw, h: ih };
  }, [carAr]);

  useEffect(() => {
    if (!open || !imageSrc) {
      setNat({ w: 0, h: 0 });
      setCropN({ x: 0, y: 0, w: 0, h: 0 });
      setHint('');
      return;
    }
    setBusy(false);
    setHint('');
    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (!nw || !nh) {
        setHint('Imagem com dimensão inválida.');
        return;
      }
      setNat({ w: nw, h: nh });
      const init = lockStoryRef.current ? centeredLockedCrop(nw, nh) : fullImageCrop(nw, nh);
      setCropN(init);
    };
    img.onerror = () => setHint('Não foi possível carregar esta imagem.');
    if (!String(imageSrc).startsWith('data:')) img.crossOrigin = 'anonymous';
    img.src = imageSrc;
  }, [open, imageSrc, centeredLockedCrop, fullImageCrop]);

  useEffect(() => {
    if (!nat.w || !nat.h) return;
    setCropN(lockStory ? centeredLockedCrop(nat.w, nat.h) : fullImageCrop(nat.w, nat.h));
  }, [lockStory]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!open) return undefined;
    const minSideNat = () => Math.max(32, Math.min(natRef.current.w, natRef.current.h) * 0.04);
    const onMove = (e) => {
      const st = dragRef.current;
      if (!st || st.pointerId !== e.pointerId || !natRef.current.w || !dispRef.current.w) return;
      const nw = natRef.current.w;
      const nh = natRef.current.h;
      const dw = dispRef.current.w;
      const dh = dispRef.current.h;
      const dxN = ((e.clientX - st.cx) / dw) * nw;
      const dyN = ((e.clientY - st.cy) / dh) * nh;
      if (st.kind === 'move') {
        const min = minSideNat();
        const w = st.cw;
        const h = st.ch;
        let nx = st.ox + dxN;
        let ny = st.oy + dyN;
        nx = Math.min(Math.max(0, nx), nw - w);
        ny = Math.min(Math.max(0, ny), nh - h);
        if (w < min || h < min) return;
        setCropN({ x: nx, y: ny, w, h });
      } else if (st.kind === 'resize-se') {
        const mn = minSideNat();
        const ox = st.ox;
        const oy = st.oy;
        let brx = Math.min(Math.max(st.brx + dxN, ox + mn), nw);
        let bry = Math.min(Math.max(st.bry + dyN, oy + mn), nh);
        let nwR = brx - ox;
        let nhR = lockStoryRef.current ? nwR / carAr : bry - oy;
        if (lockStoryRef.current) {
          const maxW = nw - ox;
          const maxH = nh - oy;
          if (nwR > maxW) {
            nwR = maxW;
            nhR = nwR / carAr;
          }
          if (nhR > maxH) {
            nhR = maxH;
            nwR = nhR * carAr;
          }
        } else {
          nwR = Math.min(Math.max(nwR, mn), nw - ox);
          nhR = Math.min(Math.max(nhR, mn), nh - oy);
        }
        let minNw = nwR >= mn ? nwR : mn;
        let minNh = lockStoryRef.current ? minNw / carAr : (nhR >= mn ? nhR : mn);
        if (lockStoryRef.current && oy + minNh > nh) minNh = nh - oy;
        if (!lockStoryRef.current && oy + minNh > nh) minNh = nh - oy;
        if (ox + minNw > nw) minNw = nw - ox;
        if (lockStoryRef.current) minNh = minNw / carAr;
        setCropN({ x: ox, y: oy, w: minNw, h: minNh });
      }
    };
    const onUp = (e) => {
      if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [open, carAr, dwPx, dhPx]);

  function badMouseButton(ev) {
    return ev.pointerType === 'mouse' && ev.button !== 0;
  }

  const startMove = (e) => {
    if (!nat.w || badMouseButton(e)) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { /* noop */ }
    dragRef.current = {
      pointerId: e.pointerId,
      kind: 'move',
      cx: e.clientX,
      cy: e.clientY,
      ox: cropN.x,
      oy: cropN.y,
      cw: cropN.w,
      ch: cropN.h,
    };
  };

  const startResizeSe = (e) => {
    e.stopPropagation();
    if (badMouseButton(e)) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { /* noop */ }
    dragRef.current = {
      pointerId: e.pointerId,
      kind: 'resize-se',
      cx: e.clientX,
      cy: e.clientY,
      ox: cropN.x,
      oy: cropN.y,
      brx: cropN.x + cropN.w,
      bry: cropN.y + cropN.h,
    };
  };

  const handleApply = () => {
    if (!nat.w || !nat.h || busy || !imageSrc) return;
    setBusy(true);
    setHint('');
    queueMicrotask(() => {
      const img = new Image();
      img.crossOrigin = String(imageSrc).startsWith('data:') ? undefined : 'anonymous';
      img.onload = () => {
        try {
          const sx = Math.max(0, Math.min(Math.floor(cropN.x), img.naturalWidth - 2));
          const sy = Math.max(0, Math.min(Math.floor(cropN.y), img.naturalHeight - 2));
          let sw = Math.max(2, Math.floor(cropN.w));
          let sh = Math.max(2, Math.floor(cropN.h));
          sw = Math.min(sw, img.naturalWidth - sx);
          sh = Math.min(sh, img.naturalHeight - sy);
          const maxSide = 2200;
          const ds = Math.min(1, maxSide / Math.max(sw, sh));
          const cw = Math.max(2, Math.round(sw * ds));
          const ch = Math.max(2, Math.round(sh * ds));
          const canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('no ctx');
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
          onApply(canvas.toDataURL('image/jpeg', 0.92));
          onClose();
        } catch {
          setHint(
            'Exportação falhou: URLs externas por vezes bloqueiam leitura. Use Upload neste card ou gere outra imagem.',
          );
        } finally {
          setBusy(false);
        }
      };
      img.onerror = () => {
        setHint('Erro ao processar a imagem.');
        setBusy(false);
      };
      img.src = imageSrc;
    });
  };

  if (!open) return null;

  const pctLeft = nat.w ? (cropN.x / nat.w) * 100 : 0;
  const pctTop = nat.h ? (cropN.y / nat.h) * 100 : 0;
  const pctW = nat.w ? (cropN.w / nat.w) * 100 : 100;
  const pctH = nat.h ? (cropN.h / nat.h) * 100 : 100;
  const cantApply = busy || !nat.w || cropN.w < 2 || cropN.h < 2;

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal-panel vc-modal-scroll" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: 560 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--hairline)',
          flexShrink: 0,
          background: 'var(--bg-sidebar)',
        }}>
          <div style={{ fontSize: 17, fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: '-0.022em', color: 'var(--text-primary)' }}>
            Recortar imagem do card
          </div>
          <button type="button" onClick={() => !busy && onClose()} aria-label="Fechar" disabled={busy} className="vc-icon-btn" style={{ cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.4 : 1 }}>
            <X size={16}/>
          </button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{
            margin: 0, fontSize: 13, lineHeight: 1.47, letterSpacing: '-0.011em', fontWeight: 400,
            color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
          }}>
            Arraste a moldura para posicionar; puxe o canto inferior direito para redimensionar. Opção «4:5» alinha ao feed (1080×1350).
          </p>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            letterSpacing: '-0.011em', fontFamily: 'var(--font-ui)', color: 'var(--text-secondary)', userSelect: 'none',
          }}>
            <input type="checkbox" checked={lockStory} disabled={busy} onChange={(ev) => setLockStory(ev.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: busy ? 'not-allowed' : 'pointer' }}/>
            Travar proporção 4:5 (feed Instagram)
          </label>
          {hint ? (
            <div style={{
              fontSize: 11, lineHeight: 1.47, fontFamily: 'var(--font-ui)', letterSpacing: '-0.011em',
              color: '#c5251c', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.18)',
              borderRadius: 11, padding: '8px 10px',
            }}>{hint}</div>
          ) : null}
          <div style={{
            position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#000', borderRadius: 11, overflow: 'hidden', border: '1px solid var(--hairline)',
            maxHeight: 'min(52vh, 460px)', minHeight: 140,
          }}>
            {!nat.w ? (
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, padding: '24px 12px', fontFamily: 'var(--font-ui)' }}>A carregar…</span>
            ) : (
              <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0, maxHeight: 'min(52vh, 460px)' }}>
                <img
                  src={imageSrc}
                  alt=""
                  draggable={false}
                  crossOrigin={String(imageSrc).startsWith('data:') ? undefined : 'anonymous'}
                  style={{
                    display: 'block', maxWidth: '100%', width: 'auto', height: 'auto',
                    maxHeight: 'min(52vh, 460px)', objectFit: 'contain',
                  }}
                />
                <div
                  style={{
                    position: 'absolute', left: `${pctLeft}%`, top: `${pctTop}%`, width: `${pctW}%`, height: `${pctH}%`,
                    boxSizing: 'border-box', border: '2px solid #fff', boxShadow: '0 0 0 4096px rgba(0,0,0,0.5)',
                    cursor: 'grab', touchAction: 'none',
                  }}
                  onPointerDown={startMove}
                >
                  <div
                    data-crop-handle="se"
                    title="Redimensionar"
                    onPointerDown={startResizeSe}
                    style={{
                      position: 'absolute', right: -8, bottom: -8, width: 22, height: 22, borderRadius: 4,
                      background: 'var(--accent)', border: '2px solid #fff', cursor: 'nwse-resize', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => !busy && onClose()} disabled={busy} className="vc-btn vc-btn-ghost" style={{ height: 40, padding: '0 16px' }}>Cancelar</button>
            <button type="button" disabled={cantApply} onClick={handleApply} className="vc-btn vc-btn-primary" style={{ height: 40, padding: '0 22px', borderRadius: 9999, opacity: cantApply ? 0.42 : 1 }}>
              {busy ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }}/> : 'Aplicar recorte'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
