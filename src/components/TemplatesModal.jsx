import { Layout, X } from 'lucide-react';
import { PALETTES, TITLE_FONTS, TEMPLATES } from '../utils/design-data.js';

export default function TemplatesModal({ open, onClose, onApply }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel-wide" onClick={e=>e.stopPropagation()}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--bg-sidebar)', zIndex:1,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:32, height:32, borderRadius:8,
              background:'linear-gradient(135deg, #6366f1, #4f46e5)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Layout size={14} color="#fff"/>
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>Templates prontos</div>
              <div className="vc-eyebrow">Quick start · comece em 1 clique</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="vc-icon-btn">
            <X size={16}/>
          </button>
        </div>
        <div style={{ padding:20, display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {TEMPLATES.map(t => {
            const palette = PALETTES[t.palette] || PALETTES[0];
            return (
              <button
                key={t.id}
                onClick={()=>{ onApply(t); onClose(); }}
                style={{
                  background:'var(--bg-card)', border:'1px solid var(--border)',
                  borderRadius:10, padding:0, cursor:'pointer', textAlign:'left',
                  overflow:'hidden', transition:'all 0.15s', display:'flex', flexDirection:'column',
                }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.transform='translateY(-2px)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='translateY(0)'; }}
              >
                <div style={{
                  height:90, background:palette.bg, position:'relative',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  borderBottom:'1px solid var(--border)',
                }}>
                  <div style={{
                    color: palette.title,
                    fontFamily: TITLE_FONTS[t.titleFont]?.val || TITLE_FONTS[0].val,
                    fontSize:14, fontWeight:600, letterSpacing:'-0.022em',
                    padding:'0 16px', textAlign:'center', lineHeight:1.2,
                  }}>
                    {t.slides[0].title}
                  </div>
                  <div style={{
                    position:'absolute', bottom:6, right:8,
                    width:14, height:2, background:palette.accent, borderRadius:99,
                  }}/>
                </div>
                <div style={{ padding:'10px 12px 12px' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>{t.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', marginTop:2, lineHeight:1.4 }}>{t.desc}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-ui)', letterSpacing:'-0.011em', marginTop:8 }}>
                    {t.slides.length} slides · {palette.name}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
