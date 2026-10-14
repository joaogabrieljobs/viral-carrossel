import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock.js';
import { FORMATS } from '../utils/formats.js';
import { canvasToPngBlob } from '../utils/image-storage.js';

/**
 * Recorta na resolução dos pixels de origem. PNG preserva alpha e evita uma
 * segunda compressão JPEG. O Blob dispensa a cópia base64 de uma foto grande.
 * Sem recorte, reutiliza os bytes originais (inclusive JPEG/WebP).
 */
export async function prepareImageCrop(image, crop, imageSrc) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) throw new Error('Imagem com dimensão inválida.');
  const sx = Math.max(0, Math.min(Math.floor(crop.x), width - 1));
  const sy = Math.max(0, Math.min(Math.floor(crop.y), height - 1));
  const sw = Math.min(Math.max(1, Math.floor(crop.w)), width - sx);
  const sh = Math.min(Math.max(1, Math.floor(crop.h)), height - sy);
  if (sx === 0 && sy === 0 && sw === width && sh === height && imageSrc) return imageSrc;

  const canvas = document.createElement('canvas');
  try {
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível preparar o recorte.');
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    return await canvasToPngBlob(canvas);
  } finally {
    // Libera logo o buffer RGBA; o Blob concluído mantém apenas o PNG.
    canvas.width = 0;
    canvas.height = 0;
  }
}

export function getImageCropFormat(fmt = 'carrossel') {
  const key = Object.prototype.hasOwnProperty.call(FORMATS, fmt) ? fmt : 'carrossel';
  const format = FORMATS[key];
  return {
    key,
    width: format.w,
    height: format.h,
    aspectRatio: format.w / format.h,
    label: key === 'apresentacao'
      ? `16:9 (apresentação ${format.w}×${format.h})`
      : key === 'quadrado'
        ? `1:1 (${format.w}×${format.h})`
        : key === 'stories'
          ? `9:16 (Stories ${format.w}×${format.h})`
          : `4:5 (feed Instagram ${format.w}×${format.h})`,
    subject: key === 'apresentacao' ? 'slide' : 'card',
  };
}

export default function ImageCropModal({ open, imageSrc, fmt = 'carrossel', onClose, onApply }) {
  useScrollLock(open);
  const cropFormat = getImageCropFormat(fmt);
  const targetAspectRatio = cropFormat.aspectRatio;
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [cropN, setCropN] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [lockFormat, setLockFormat] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const dragRef = useRef(null);
  const natRef = useRef({ w: 0, h: 0 });
  const dispRef = useRef({ w: 0, h: 0 });
  const lockFormatRef = useRef(true);
  lockFormatRef.current = lockFormat;

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
    let iw = Math.min(nw, nh * targetAspectRatio);
    let ih = iw / targetAspectRatio;
    if (ih > nh) {
      ih = nh;
      iw = ih * targetAspectRatio;
    }
    return { x: (nw - iw) / 2, y: (nh - ih) / 2, w: iw, h: ih };
  }, [targetAspectRatio]);

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
      const init = lockFormatRef.current ? centeredLockedCrop(nw, nh) : fullImageCrop(nw, nh);
      setCropN(init);
    };
    img.onerror = () => setHint('Não foi possível carregar esta imagem.');
    if (!String(imageSrc).startsWith('data:')) img.crossOrigin = 'anonymous';
    img.src = imageSrc;
  }, [open, imageSrc, centeredLockedCrop, fullImageCrop]);

  useEffect(() => {
    if (!nat.w || !nat.h) return;
    setCropN(lockFormat ? centeredLockedCrop(nat.w, nat.h) : fullImageCrop(nat.w, nat.h));
  }, [lockFormat, targetAspectRatio]); // eslint-disable-line react-hooks/exhaustive-deps

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
        let nhR = lockFormatRef.current ? nwR / targetAspectRatio : bry - oy;
        if (lockFormatRef.current) {
          const maxW = nw - ox;
          const maxH = nh - oy;
          if (nwR > maxW) {
            nwR = maxW;
            nhR = nwR / targetAspectRatio;
          }
          if (nhR > maxH) {
            nhR = maxH;
            nwR = nhR * targetAspectRatio;
          }
        } else {
          nwR = Math.min(Math.max(nwR, mn), nw - ox);
          nhR = Math.min(Math.max(nhR, mn), nh - oy);
        }
        let minNw = nwR >= mn ? nwR : mn;
        let minNh = lockFormatRef.current ? minNw / targetAspectRatio : (nhR >= mn ? nhR : mn);
        if (lockFormatRef.current && oy + minNh > nh) minNh = nh - oy;
        if (!lockFormatRef.current && oy + minNh > nh) minNh = nh - oy;
        if (ox + minNw > nw) minNw = nw - ox;
        if (lockFormatRef.current) minNh = minNw / targetAspectRatio;
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
  }, [open, targetAspectRatio, dwPx, dhPx]);

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
      img.onload = async () => {
        try {
          const cropped = await prepareImageCrop(img, cropN, imageSrc);
          onApply(cropped);
          onClose();
        } catch {
          setHint(
            'Não foi possível recortar a imagem. Tente uma região menor; para URLs externas, importe o arquivo PNG ou JPEG.',
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
            Recortar imagem do {cropFormat.subject}
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
            Arraste a moldura para posicionar; puxe o canto inferior direito para redimensionar. A proporção acompanha o formato atual.
          </p>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            letterSpacing: '-0.011em', fontFamily: 'var(--font-ui)', color: 'var(--text-secondary)', userSelect: 'none',
          }}>
            <input type="checkbox" checked={lockFormat} disabled={busy} onChange={(ev) => setLockFormat(ev.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: busy ? 'not-allowed' : 'pointer' }}/>
            Travar proporção {cropFormat.label}
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
