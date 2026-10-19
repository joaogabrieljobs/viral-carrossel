import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

export function ConfirmDialog({ open, title, body, confirmLabel = 'Continuar', cancelLabel = 'Cancelar', onConfirm, onCancel }) {
  const confirmRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => confirmRef.current?.focus(), 30);
    const onKey = (event) => {
      if (event.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel} role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vc-confirm-title"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: 440 }}
      >
        <div style={{ padding: '20px 20px 0' }}>
          <div id="vc-confirm-title" style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.022em' }}>{title}</div>
          <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.45, color: 'var(--text-muted)' }}>{body}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: 20 }}>
          <button type="button" onClick={onCancel} className="vc-btn vc-btn-ghost" style={{ height: 38, padding: '0 14px' }}>{cancelLabel}</button>
          <button type="button" ref={confirmRef} onClick={onConfirm} className="vc-btn vc-btn-primary" style={{ height: 38, padding: '0 16px' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function PromptDialog({ open, title, defaultValue = '', placeholder = '', label = '', cta = 'OK', onConfirm, onClose }) {
  const [val, setVal] = useState(defaultValue);
  const inputRef = useRef(null);
  useEffect(() => {
    if (open) {
      setVal(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open, defaultValue]);
  if (!open) return null;
  const submit = () => {
    const v = val.trim();
    if (!v) return;
    onConfirm(v);
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e=>e.stopPropagation()} style={{ maxWidth:420 }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
        }}>
          <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>{title}</div>
          <button onClick={onClose} aria-label="Fechar" className="vc-icon-btn">
            <X size={16}/>
          </button>
        </div>
        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
          {label && (
            <label className="vc-label" style={{ marginBottom:0 }}>
              {label}
            </label>
          )}
          <input
            ref={inputRef}
            value={val}
            onChange={e=>setVal(e.target.value)}
            placeholder={placeholder}
            className="vc-input"
            onKeyDown={e=>{
              if(e.key==='Enter') submit();
              if(e.key==='Escape') onClose();
            }}
          />
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button onClick={onClose} className="vc-btn vc-btn-ghost" style={{ height:38, padding:'0 14px' }}>Cancelar</button>
            <button onClick={submit} disabled={!val.trim()} className="vc-btn vc-btn-primary" style={{ height:38, padding:'0 16px', opacity: val.trim() ? 1 : 0.4 }}>
              {cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
