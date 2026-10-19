import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Label de secção — hierarquia UX:
 * - kicker: passo / domínio (ex. "1 · Abrir")
 * - title: o que fazer aqui
 * - hint: uma frase de apoio (opcional)
 * - fold: a secção nasce fechada; o título vira o resumo
 */
export function SectionLabel({ title, children, className = '', hint, kicker, sectionId, fold = false }) {
  if (fold) {
    return (
      <details
        className={`vc-fold ${className}`.trim()}
        data-vc-editor-section={sectionId || undefined}
      >
        <summary>
          <span className="vc-fold-copy">
            {kicker ? <span className="vc-fold-kicker">{kicker}</span> : null}
            <span className="section-label">{title}</span>
            {hint ? <span className="vc-fold-hint">{hint}</span> : null}
          </span>
          <ChevronDown size={16} className="vc-fold-chevron" aria-hidden />
        </summary>
        <div className="vc-fold-body">{children}</div>
      </details>
    );
  }

  return (
    <div className={className} data-vc-editor-section={sectionId || undefined} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {kicker ? (
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
          lineHeight: 1.2,
        }}>
          {kicker}
        </div>
      ) : null}
      <div className="section-label" style={kicker ? { marginTop: -2 } : undefined}>{title}</div>
      {hint ? (
        <div style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-ui)',
          lineHeight: 1.45,
          letterSpacing: '-0.011em',
          marginTop: -4,
          marginBottom: 2,
        }}>
          {hint}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** Intro de página — uma frase, um propósito. Evita dashboard visual. */
export function PageIntro({ title, children }) {
  return (
    <div
      role="note"
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        border: '1px solid var(--glass-border)',
        background: 'rgba(255, 255, 255, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--text-primary)',
        letterSpacing: '-0.014em',
        fontFamily: 'var(--font-ui)',
        lineHeight: 1.3,
      }}>
        {title}
      </div>
      {children ? (
        <div style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          lineHeight: 1.45,
          letterSpacing: '-0.011em',
          fontFamily: 'var(--font-ui)',
        }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default SectionLabel;
