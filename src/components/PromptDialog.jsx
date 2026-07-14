import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

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
