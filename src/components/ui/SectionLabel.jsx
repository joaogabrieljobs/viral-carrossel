import React from 'react';

/** Label de seção reutilizado nos painéis do editor (usado como `S` no ViralCarrossel.jsx). */
export function SectionLabel({ title, children, className = '', hint }) {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="section-label">{title}</div>
      {hint && (
        <div style={{
          fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
          lineHeight: 1.5, marginTop: -4, marginBottom: 2,
        }}>{hint}</div>
      )}
      {children}
    </div>
  );
}

export default SectionLabel;
