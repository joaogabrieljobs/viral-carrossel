import React from 'react';
import { X } from 'lucide-react';

export default function HelpModal({ open, onClose, onShowLanding, onStartTour }) {
  if (!open) return null;
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const Mod = isMac ? '⌘' : 'Ctrl';
  const rows = [
    { keys:[Mod,'Z'],          label:'Desfazer última ação' },
    { keys:[Mod,'⇧','Z'],      label:'Refazer' },
    { keys:[Mod,'D'],          label:'Duplicar slide atual' },
    { keys:[Mod,'E'],          label:'Exportar slide atual (PNG)' },
    { keys:[Mod,'S'],          label:'Exportar todos (PNG)' },
    { keys:['←','→'],          label:'Navegar entre slides' },
    { keys:['F'],              label:'Tela cheia (apresentação)' },
    { keys:['Esc'],            label:'Sair da tela cheia' },
    { keys:['N'],              label:'Novo slide' },
    { keys:['Del'],            label:'Apagar slide atual' },
    { keys:['?'],              label:'Abrir esta ajuda' },
  ];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e=>e.stopPropagation()} style={{ maxWidth:440 }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
        }}>
          <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>Atalhos de teclado</div>
          <button onClick={onClose} aria-label="Fechar" className="vc-icon-btn">
            <X size={16}/>
          </button>
        </div>
        <div style={{ padding:'14px 20px 20px', display:'flex', flexDirection:'column', gap:6 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 4px' }}>
              <span style={{ fontSize:13, color:'var(--text-secondary)', fontFamily:'var(--font-ui)' }}>{r.label}</span>
              <div style={{ display:'flex', gap:4 }}>
                {r.keys.map((k, j) => <span key={j} className="kbd">{k}</span>)}
              </div>
            </div>
          ))}
          {typeof onShowLanding === 'function' && (
            <button
              type="button"
              className="vc-btn vc-btn-ghost"
              style={{ width: '100%', height: 40, marginTop: 10, fontSize: 14, border: '1px solid var(--hairline)' }}
              onClick={() => onShowLanding()}
            >
              Ver página de introdução
            </button>
          )}
          {typeof onStartTour === 'function' && (
            <button
              type="button"
              className="vc-btn vc-btn-ghost"
              style={{ width: '100%', height: 40, marginTop: 8, fontSize: 14, border: '1px solid var(--hairline)' }}
              onClick={() => onStartTour()}
            >
              Ver tour guiado
            </button>
          )}
          <div style={{ marginTop:12, fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-ui)', lineHeight:1.5, paddingTop:12, borderTop:'1px solid var(--border)' }}>
            Dica: arraste as miniaturas dos slides na barra superior para reordená-los.
            <br/>Seu trabalho é salvo automaticamente no navegador.
          </div>
        </div>
      </div>
    </div>
  );
}
