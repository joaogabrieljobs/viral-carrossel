import React from 'react';

/**
 * Label de secção — hierarquia UX:
 * - kicker: passo / domínio (ex. "1 · Abrir")
 * - title: o que fazer aqui
 * - hint: uma frase de apoio (opcional)
 */
export function SectionLabel({ title, children, className = '', hint, kicker }) {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
