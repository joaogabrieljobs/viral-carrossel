/**
 * TemplatesModal — catálogo de arcos prontos.
 *
 * São 16 templates: uma grade plana viraria paredão, então há duas famílias.
 * ÂNGULO é a forma de contar (manifesto, lista, antes×depois); NICHO é para
 * quem se fala (marketing, mentor, e-commerce). A mesma tese cabe em vários
 * ângulos — por isso as duas dimensões existem separadas.
 *
 * O preview desenha a assinatura real do template (paleta + fonte do pairing +
 * barra editorial + selo). A versão anterior mostrava o título numa fonte lida
 * de um índice que o `applyTemplate` ignorava: o card prometia uma fonte e o
 * clique entregava outra.
 */
import React from 'react';
import { Layout, X } from 'lucide-react';
import { PALETTES, TEMPLATES } from '../utils/design-data.js';
import { FONT_PAIRINGS } from '../utils/slide-design-system.js';
import { resolvePresetText } from '../utils/preset-tokens.js';
import { useModalDialog } from '../hooks/useModalDialog.js';

const FAMILIAS = [
  { id: 'todos', label: 'Todos' },
  { id: 'nicho', label: 'Por nicho' },
  { id: 'angulo', label: 'Por ângulo' },
];

export function templateImageCreditCount(template) {
  return Array.isArray(template?.slides)
    ? template.slides.filter(slide => String(slide?.q || '').trim()).length
    : 0;
}

/** Mini-card 4:5 com a assinatura do template — mesma linguagem do picker visual. */
function PreviewTemplate({ tpl }) {
  const p = PALETTES[tpl.palette] || PALETTES[0];
  const par = FONT_PAIRINGS.find((f) => f.id === tpl.pairingId);
  const sig = tpl.signature || {};
  const temBarra = !!(sig.cultureHeaderLeft || sig.cultureHeaderCenter || sig.cultureHeaderYear);
  const temSelo = !!sig.footerPillText;
  const temRodape = !!(sig.footerBarLeft || sig.footerBarCenter || sig.footerBarRight);
  const capa = tpl.slides[0];
  // A assinatura guarda tokens ({handle}, {marca}, {ano}) que o card resolve no
  // render. Sem resolver aqui, o catálogo exibia "{handle}{ano}" literal — o
  // mesmo artefato de template que a gente passou a sessão a limpar.
  const txt = (v) => resolvePresetText(String(v || ''), null);
  return (
    <div
      aria-hidden
      style={{
        position: 'relative', width: '100%', aspectRatio: '4 / 5',
        background: p.bg, borderRadius: 8, overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '10px 11px 12px',
      }}
    >
      {/* faixa de foto simulada — o hook do arco é sempre full-bleed */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(180deg, ${p.text}22 0%, ${p.bg} 68%)`,
      }}/>
      {temBarra && (
        <div style={{
          position: 'absolute', top: 8, left: 10, right: sig.showPageBadge ? 26 : 10,
          display: 'flex', justifyContent: 'space-between', gap: 4,
          fontSize: 4.5, letterSpacing: '0.08em', color: p.subtitle,
          fontFamily: 'var(--font-ui)', textTransform: 'uppercase', fontWeight: 600,
        }}>
          <span>{txt(sig.cultureHeaderLeft)}</span>
          <span>{txt(sig.cultureHeaderYear)}</span>
        </div>
      )}
      {sig.showPageBadge && (
        <span style={{
          position: 'absolute', top: 6, right: 7,
          background: `${p.title}22`, color: p.title,
          fontSize: 4.5, padding: '1.5px 4px', borderRadius: 99,
          fontFamily: 'var(--font-mono)',
        }}>1/{tpl.slides.length}</span>
      )}
      <div style={{
        position: 'relative',
        color: p.title,
        fontFamily: par?.titleFont || 'var(--font-display)',
        fontWeight: par?.textTitleWeight ?? 700,
        fontSize: 12, lineHeight: 1.08, letterSpacing: '-0.02em',
        marginBottom: temSelo || temRodape ? 12 : 0,
      }}>
        {capa.title}
      </div>
      {temSelo && (
        <span style={{
          position: 'absolute', bottom: 7, left: '50%', transform: 'translateX(-50%)',
          background: p.accent, color: p.bg,
          fontSize: 4.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
          fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap',
        }}>{txt(sig.footerPillText)}</span>
      )}
      {temRodape && (
        <div style={{
          position: 'absolute', bottom: 6, left: 10, right: 10,
          display: 'flex', justifyContent: 'space-between',
          fontSize: 4, color: p.subtitle, fontFamily: 'var(--font-ui)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          <span>{txt(String(sig.footerBarLeft || '').split('|')[0])}</span>
          <span>{txt(String(sig.footerBarRight || '').split('|')[0])}</span>
        </div>
      )}
    </div>
  );
}

export default function TemplatesModal({ open, onClose, onApply }) {
  const [familia, setFamilia] = React.useState('todos');
  const [pendingTemplate, setPendingTemplate] = React.useState(null);
  const pendingPanelRef = React.useRef(null);
  const { overlayRef, dialogRef, onDialogKeyDown } = useModalDialog({ open, onClose });
  React.useEffect(() => { if (!open) setPendingTemplate(null); }, [open]);
  React.useEffect(() => {
    if (!pendingTemplate) return;
    window.requestAnimationFrame(() => {
      pendingPanelRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    });
  }, [pendingTemplate]);
  if (!open) return null;
  const lista = familia === 'todos' ? TEMPLATES : TEMPLATES.filter((t) => t.categoria === familia);
  const pendingCredits = templateImageCreditCount(pendingTemplate);
  const apply = (generateImages) => {
    if (!pendingTemplate) return;
    onApply(pendingTemplate, { generateImages });
    setPendingTemplate(null);
    onClose();
  };
  return (
    <div ref={overlayRef} className="modal-overlay" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="modal-panel modal-panel-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="templates-modal-title"
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--bg-sidebar)', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Layout size={14} color="#fff"/>
            </div>
            <div>
              <div id="templates-modal-title" style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.022em' }}>
                Templates prontos
              </div>
              <div className="vc-eyebrow">{TEMPLATES.length} arcos · texto, paleta e assinatura em 1 clique</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="vc-icon-btn">
            <X size={16}/>
          </button>
        </div>

        <div role="tablist" aria-label="Famílias de template" style={{
          display: 'flex', gap: 6, padding: '12px 20px 0',
        }}>
          {FAMILIAS.map((f) => {
            const ativo = familia === f.id;
            return (
              <button
                key={f.id}
                role="tab"
                aria-selected={ativo}
                onClick={() => setFamilia(f.id)}
                style={{
                  padding: '7px 14px', borderRadius: 9999, cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)',
                  letterSpacing: '-0.011em',
                  background: ativo ? 'var(--accent-surface)' : 'var(--bg-card)',
                  border: `1px solid ${ativo ? 'var(--accent)' : 'var(--hairline)'}`,
                  color: ativo ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {pendingTemplate && <div ref={pendingPanelRef} role="group" aria-label={`Como aplicar ${pendingTemplate.name}`} style={{
          margin:'14px 20px 0', padding:14, border:'1px solid var(--accent)', borderRadius:10,
          background:'var(--accent-surface)', display:'grid', gap:10,
        }}>
          <strong style={{ color:'var(--text-primary)' }}>Aplicar “{pendingTemplate.name}”</strong>
          <span style={{ color:'var(--text-secondary)', fontSize:12, lineHeight:1.45 }}>
            O layout e o texto não consomem créditos. Gerar as imagens usa {pendingCredits} crédito{pendingCredits === 1 ? '' : 's'} do plano.
          </span>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            <button type="button" className="vc-btn vc-btn-ghost" onClick={() => apply(false)}>Aplicar só layout</button>
            {pendingCredits > 0 && <button type="button" className="vc-btn vc-btn-primary" onClick={() => apply(true)}>Aplicar e gerar {pendingCredits} imagens</button>}
            <button type="button" className="vc-btn vc-btn-ghost" onClick={() => setPendingTemplate(null)}>Voltar</button>
          </div>
        </div>}

        <div style={{ padding: 20, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          {lista.map((t) => {
            const palette = PALETTES[t.palette] || PALETTES[0];
            return (
              <button
                key={t.id}
                onClick={() => setPendingTemplate(t)}
                aria-pressed={pendingTemplate?.id === t.id}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: 8, cursor: 'pointer', textAlign: 'left',
                  transition: 'border-color 0.15s, transform 0.15s',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <PreviewTemplate tpl={t}/>
                <div style={{ padding: '0 2px 2px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', letterSpacing: '-0.011em' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', marginTop: 2, lineHeight: 1.4 }}>{t.desc}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '-0.011em', marginTop: 7 }}>
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
