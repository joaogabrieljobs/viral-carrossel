import React from 'react';
import { X, RotateCcw, Move, FlipHorizontal2 } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock.js';
import { FORMATS } from '../utils/formats.js';

/**
 * PhotoPositionModal — reposicionar/zoomar a foto dentro do card sem CROP destrutivo.
 * Edita slide.bgX / slide.bgY (0..100, % do objectPosition) + slide.bgZoom (50..300%).
 * Drag direto no preview = atualiza bgX/bgY em tempo real. Espelhamento e reset rápidos.
 */
export default function PhotoPositionModal({ open, slide, fmt, onClose, onChange }) {
  useScrollLock(open);
  const dragRef = React.useRef(null);
  const previewRef = React.useRef(null);
  const f = FORMATS[fmt] || FORMATS.carrossel;
  const aspect = f.w / f.h;
  if (!open || !slide?.bgImage) return null;
  const bgX = slide.bgX ?? 50;
  const bgY = slide.bgY ?? 50;
  const bgZoom = slide.bgZoom ?? 100;
  const bgMirror = !!slide.bgMirror;
  const onPointerDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    const el = previewRef.current;
    if (!el) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBgX: bgX,
      startBgY: bgY,
      rect: el.getBoundingClientRect(),
    };
  };
  const onPointerMove = (e) => {
    const st = dragRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    const dxPx = e.clientX - st.startClientX;
    const dyPx = e.clientY - st.startClientY;
    // Mover a foto pra direita visualmente = bgX diminui (objectPosition mostra o lado esquerdo da foto)
    // Inversão dx/dy x sinal pra UX intuitiva (arrasta foto = foto vai junto):
    const factor = 100 / Math.max(1, bgZoom / 100);
    let nextX = st.startBgX - (dxPx / st.rect.width) * 100 * factor;
    let nextY = st.startBgY - (dyPx / st.rect.height) * 100 * factor;
    nextX = Math.max(0, Math.min(100, nextX));
    nextY = Math.max(0, Math.min(100, nextY));
    onChange({ bgX: Math.round(nextX), bgY: Math.round(nextY) });
  };
  const onPointerUp = (e) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  };
  const previewW = Math.min(520, typeof window !== 'undefined' ? window.innerWidth - 48 : 520);
  const previewH = Math.round(previewW / aspect);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: previewW + 48 }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--bg-sidebar)', zIndex:1,
        }}>
          <div>
            <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>Posicionar foto</div>
            <div className="vc-eyebrow">Arraste a foto para mover · use o zoom abaixo</div>
          </div>
          <button onClick={onClose} className="vc-icon-btn" aria-label="Fechar">
            <X size={16}/>
          </button>
        </div>
        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
          <div
            ref={previewRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              width: previewW, height: previewH,
              borderRadius: 10, overflow:'hidden', position:'relative',
              background:'#0a0a0c',
              cursor: dragRef.current ? 'grabbing' : 'grab',
              touchAction: 'none',
              boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
              margin: '0 auto',
            }}
          >
            <img
              src={slide.bgImage}
              alt=""
              draggable={false}
              style={{
                position:'absolute', inset:0, width:'100%', height:'100%',
                objectFit:'cover',
                objectPosition:`${bgX}% ${bgY}%`,
                transform: `${bgMirror ? 'scaleX(-1) ' : ''}${bgZoom !== 100 ? `scale(${bgZoom/100})` : ''}`.trim() || undefined,
                transformOrigin: `${bgX}% ${bgY}%`,
                pointerEvents:'none', userSelect:'none',
              }}
            />
            {/* Grade rule-of-thirds + crosshair central pra ajudar centralização */}
            <svg
              width={previewW} height={previewH}
              style={{ position:'absolute', inset:0, pointerEvents:'none', opacity:0.42 }}
            >
              <line x1={previewW/3} y1={0} x2={previewW/3} y2={previewH} stroke="#fff" strokeWidth="1" strokeDasharray="4 4"/>
              <line x1={2*previewW/3} y1={0} x2={2*previewW/3} y2={previewH} stroke="#fff" strokeWidth="1" strokeDasharray="4 4"/>
              <line x1={0} y1={previewH/3} x2={previewW} y2={previewH/3} stroke="#fff" strokeWidth="1" strokeDasharray="4 4"/>
              <line x1={0} y1={2*previewH/3} x2={previewW} y2={2*previewH/3} stroke="#fff" strokeWidth="1" strokeDasharray="4 4"/>
              <circle cx={previewW/2} cy={previewH/2} r="6" fill="none" stroke="#fff" strokeWidth="1.5"/>
              <line x1={previewW/2-12} y1={previewH/2} x2={previewW/2+12} y2={previewH/2} stroke="#fff" strokeWidth="1.5"/>
              <line x1={previewW/2} y1={previewH/2-12} x2={previewW/2} y2={previewH/2+12} stroke="#fff" strokeWidth="1.5"/>
            </svg>
            <div style={{
              position:'absolute', top:8, left:8,
              background:'rgba(0,0,0,0.5)', color:'#fff', backdropFilter:'blur(6px)',
              fontSize:10, fontFamily:'var(--font-mono)', padding:'4px 8px', borderRadius:6,
              letterSpacing:'0.04em',
            }}>
              X:{bgX}% · Y:{bgY}% · {bgZoom}%
            </div>
          </div>

          <div>
            <label className="vc-label-sm" style={{ display:'flex', justifyContent:'space-between' }}>
              <span>Zoom</span>
              <span style={{ color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>{bgZoom}%</span>
            </label>
            <input
              type="range"
              min={50}
              max={300}
              value={bgZoom}
              onChange={(e) => onChange({ bgZoom: Number(e.target.value) })}
              style={{ width:'100%', accentColor:'var(--accent)' }}
            />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
            <button
              type="button"
              onClick={() => onChange({ bgX: 50, bgY: 50, bgZoom: 100, bgMirror: false })}
              className="vc-btn vc-btn-ghost"
              style={{ height: 36, fontSize: 12, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}
              title="Resetar pra valores neutros"
            >
              <RotateCcw size={12} aria-hidden/> Reset
            </button>
            <button
              type="button"
              onClick={() => onChange({ bgX: 50, bgY: 50 })}
              className="vc-btn vc-btn-ghost"
              style={{ height: 36, fontSize: 12, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}
              title="Apenas centralizar (mantém zoom e espelho)"
            >
              <Move size={12} aria-hidden/> Centralizar
            </button>
            <button
              type="button"
              onClick={() => onChange({ bgMirror: !bgMirror })}
              className="vc-btn vc-btn-ghost"
              style={{
                height: 36, fontSize: 12,
                background: bgMirror ? 'var(--success-surface)' : undefined,
                borderColor: bgMirror ? 'var(--accent)' : undefined,
                display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
              }}
              title="Espelhar horizontalmente"
            >
              <FlipHorizontal2 size={12} aria-hidden/> Espelhar
            </button>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:4 }}>
            <button type="button" onClick={onClose} className="vc-btn vc-btn-primary" style={{ height:40, padding:'0 22px', borderRadius:9999 }}>
              Pronto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
