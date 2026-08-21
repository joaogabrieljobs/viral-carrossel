import { Layout, X } from 'lucide-react';
import { PALETTES, TEMPLATES } from '../utils/design-data.js';
import { FONT_PAIRINGS, COMPOSITIONS } from '../utils/slide-design-system.js';

/**
 * Mini-card do template: desenha a assinatura real (barra editorial, contador,
 * selo, tipografia do pairing) em vez de um retângulo com texto — o mesmo
 * princípio do renderPresetPreview dos padrões visuais. O que o usuário vê no
 * modal é o que o template aplica.
 */
function TemplatePreviewCard({ tpl, palette, pairing }) {
  const sig = tpl.signature || {};
  const hook = tpl.slides[0];
  const resolve = (txt) => String(txt || '')
    .replace(/\{marca\}/gi, 'SUA MARCA')
    .replace(/\{handle\}/gi, '@seuperfil')
    .replace(/\{ano\}/gi, String(new Date().getFullYear()));
  const temHeader = !!(sig.cultureHeaderLeft || sig.cultureHeaderCenter || sig.cultureHeaderYear);
  const mutedInk = palette.text;
  return (
    <div style={{
      aspectRatio: '4 / 5',
      background: palette.bg, position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      borderBottom: '1px solid var(--border)',
    }}>
      {temHeader && (
        <div style={{
          position: 'absolute', top: 8, left: 10, right: sig.showPageBadge ? 34 : 10,
          display: 'flex', justifyContent: 'space-between', gap: 6,
          fontSize: 6.5, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: mutedInk, fontFamily: pairing.bodyFont, opacity: 0.85,
          whiteSpace: 'nowrap', overflow: 'hidden',
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{resolve(sig.cultureHeaderLeft)}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{resolve(sig.cultureHeaderCenter)}</span>
          <span>{resolve(sig.cultureHeaderYear)}</span>
        </div>
      )}
      {sig.showPageBadge && (
        <div style={{
          position: 'absolute', top: 6, right: 8,
          fontSize: 6.5, padding: '2px 6px', borderRadius: 999,
          background: 'rgba(127,127,127,0.28)', color: palette.title,
          fontFamily: pairing.bodyFont, fontVariantNumeric: 'tabular-nums',
        }}>1/{tpl.slides.length}</div>
      )}
      <div style={{ padding: '0 14px 14px' }}>
        <div style={{
          color: palette.title, fontFamily: pairing.titleFont,
          fontWeight: pairing.textTitleWeight ?? 700,
          fontSize: 16, lineHeight: 1.08, letterSpacing: '-0.02em',
        }}>
          {hook.title}
        </div>
        <div style={{
          color: palette.subtitle, fontFamily: pairing.bodyFont,
          fontSize: 8, lineHeight: 1.35, marginTop: 6, opacity: 0.92,
        }}>
          {hook.subtitle}
        </div>
        <div style={{ width: 18, height: 3, background: palette.accent, borderRadius: 99, marginTop: 8 }}/>
      </div>
      {sig.footerPillText && (
        <div style={{
          position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
          fontSize: 6, fontWeight: 700, letterSpacing: '0.04em',
          padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap',
          background: sig.footerPillBg || palette.accent,
          color: sig.footerPillFg || palette.bg,
          fontFamily: pairing.bodyFont,
        }}>{resolve(sig.footerPillText)}</div>
      )}
    </div>
  );
}

/** Tira do arco: um traço por slide, mais alto quando o beat é forte (hook/stat/cta). */
function ArcStrip({ tpl, palette }) {
  const alturaPorRole = { hook: 12, stat: 12, cta: 12, sandwich: 9, quote: 9 };
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 12 }} aria-hidden>
      {tpl.slides.map((s, i) => {
        const role = COMPOSITIONS[s.composition]?.role || 'miolo';
        const forte = role in alturaPorRole;
        return (
          <span key={i} style={{
            width: 5, height: alturaPorRole[role] || 6, borderRadius: 2,
            background: forte ? palette.accent : 'var(--border)',
            opacity: forte ? 0.9 : 1,
          }}/>
        );
      })}
    </div>
  );
}

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
              <div className="vc-eyebrow">Arco completo · troque os textos pelos seus</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="vc-icon-btn">
            <X size={16}/>
          </button>
        </div>
        <div style={{ padding:20, display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {TEMPLATES.map(t => {
            const palette = PALETTES[t.palette] || PALETTES[0];
            const pairing = FONT_PAIRINGS.find((p) => p.id === t.pairingId) || FONT_PAIRINGS[0];
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
                <TemplatePreviewCard tpl={t} palette={palette} pairing={pairing}/>
                <div style={{ padding:'10px 12px 12px' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>{t.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', marginTop:2, lineHeight:1.4 }}>{t.desc}</div>
                  <div style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    marginTop:8, gap:8,
                  }}>
                    <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>
                      {t.slides.length} slides · {pairing.name}
                    </span>
                    <ArcStrip tpl={t} palette={palette}/>
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
