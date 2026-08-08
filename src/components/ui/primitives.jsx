// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import WcagBadge from '../WcagBadge.jsx';

// Slider with dynamic fill
const Slider = ({ label, value, min, max, onChange }) => {
  const pct = ((value - min) / (max - min)) * 100;
  const apply = (v) => {
    const n = +v;
    if (Number.isNaN(n)) return;
    onChange(Math.min(max, Math.max(min, n)));
  };
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <span style={{ fontSize:13, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', fontWeight:400, letterSpacing:'-0.011em' }}>{label}</span>
        <span style={{ fontSize:13, color:'var(--text-primary)', fontFamily:'var(--font-ui)', fontWeight:600, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.011em' }}>{value}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => apply(e.target.value)}
        onInput={(e) => apply(e.target.value)}
        style={{ '--pct': `${pct}%`, touchAction: 'pan-x', minHeight: 32 }}
      />
    </div>
  );
};

// Toggle switch
const Toggle = ({ label, value, onChange }) => (
  <button
    onClick={()=>onChange(!value)}
    style={{
      width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
      background:'var(--bg-card)', border:'1px solid var(--border)',
      borderRadius:8, padding:'8px 12px', cursor:'pointer', outline:'none',
    }}
  >
    <span style={{ fontSize:12, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', fontWeight:500 }}>{label}</span>
    <div style={{
      width:34, height:18, borderRadius:99, position:'relative',
      background: value ? 'var(--accent)' : 'var(--border)',
      transition:'background 0.2s',
      flexShrink:0,
    }}>
      <div style={{
        width:12, height:12, borderRadius:'50%', background:'#fff',
        position:'absolute', top:3,
        left: value ? 19 : 3,
        transition:'left 0.2s var(--ease-bounce)',
        boxShadow:'0 1px 3px rgba(0,0,0,0.3)',
      }}/>
    </div>
  </button>
);

const ColorRow = ({ label, value, onChange, contrastBg, contrastKind }) => (
  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
    <div style={{ position:'relative', flexShrink:0 }}>
      <div style={{
        width:28, height:28, borderRadius:6, background:value,
        border:'1px solid var(--border)', cursor:'pointer', overflow:'hidden',
      }}>
        <input type="color" value={value} onChange={e=>onChange(e.target.value)}
          style={{ opacity:0, position:'absolute', inset:0, cursor:'pointer', width:'100%', height:'100%' }}
        />
      </div>
    </div>
    <input
      value={value} onChange={e=>onChange(e.target.value)}
      className="vc-input" style={{ fontSize:13, fontFamily:'var(--font-mono)', flex:1 }}
    />
    {contrastBg ? <WcagBadge fg={value} bg={contrastBg} kind={contrastKind || 'body'} /> : null}
    <span style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'var(--font-ui)', flexShrink:0, width:60, textAlign:'right', letterSpacing:'-0.011em', fontWeight:600 }}>
      {label}
    </span>
  </div>
);

// ─── SAVED INDICATOR — mostra "Salvo há Xs" perto do nome do projeto ─────────
// Reduz ansiedade do user ("vou perder?") sem ser intrusivo. Atualiza
// progressivamente: agora → "agora mesmo", < 60s → "Xs", < 1h → "Xmin",
// > 1h → "Xh". Re-renderiza a cada 30s pra refrescar o texto.
function SavedIndicator({ savedAt }) {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    if (!savedAt) return;
    const id = setInterval(force, 30000);
    return () => clearInterval(id);
  }, [savedAt]);
  if (!savedAt) return null;
  const diff = Date.now() - savedAt;
  let label;
  if (diff < 5000) label = 'agora mesmo';
  else if (diff < 60000) label = `há ${Math.round(diff / 1000)}s`;
  else if (diff < 3600000) label = `há ${Math.round(diff / 60000)}min`;
  else label = `há ${Math.round(diff / 3600000)}h`;
  return (
    <span
      title="Auto-save: alterações são gravadas automaticamente. Clique no botão 'Meus projetos' pra gerenciar versões."
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
        letterSpacing: '-0.005em', opacity: 0.7,
        cursor: 'help',
      }}
    >
      <span style={{ color: 'var(--success-text)', fontSize: 9 }}>✓</span>
      Salvo {label}
    </span>
  );
}

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  // Container "polite" não rouba o foco. Item de error usa role="alert" pra anúncio
  // imediato em screen readers (warning também pra não passar despercebido).
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map(t => {
        const isUrgent = t.kind === 'error' || t.kind === 'warning';
        return (
          <div
            key={t.id}
            className={`toast-item toast-${t.kind}`}
            role={isUrgent ? 'alert' : 'status'}
            aria-live={isUrgent ? 'assertive' : 'polite'}
          >
            <span style={{ flex:1 }}>{t.message}</span>
            <button onClick={()=>onDismiss(t.id)} aria-label="Fechar notificação">
              <X size={12}/>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export {
  Slider,
  Toggle,
  ColorRow,
  SavedIndicator,
  ToastStack,
};
