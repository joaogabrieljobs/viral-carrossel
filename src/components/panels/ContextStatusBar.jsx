import React from 'react';
import { buildIdentityChecklist } from '../../utils/context-status.js';

/**
 * Barra compacta de qualidade de contexto (Controle profissional — Fatia 3).
 * Informa — não bloqueia geração.
 * Ex.: MUSA · Contexto completo · Brief ✓ · Tom ✓ · Logo ✓ · Estilo ✓ · 3 referências
 */
export function ContextStatusBar({
  brand,
  styleKit,
  material,
  projectName = '',
}) {
  const { status, items } = buildIdentityChecklist({ brand, styleKit, material });
  const nome = (projectName || '').trim() || 'Projeto';
  const readyCount = items.filter((i) => i.ready).length;
  const summary = items
    .filter((i) => i.id !== 'material' || i.ready)
    .map((item) => (item.ready ? `${item.label} ✓` : item.label))
    .join(' · ');

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 12px',
        borderRadius: 12,
        border: '1px solid var(--glass-border-strong)',
        background: 'var(--bg-card)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.011em' }}>
          {nome} · {status.label}
        </div>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          {readyCount}/{items.length}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        {summary}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map((item) => (
          <span
            key={item.id}
            title={item.hint}
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.02em',
              padding: '4px 8px',
              borderRadius: 9999,
              border: `1px solid ${item.ready ? 'rgba(30, 166, 74, 0.35)' : 'var(--hairline)'}`,
              background: item.ready ? 'rgba(30, 166, 74, 0.08)' : 'transparent',
              color: item.ready ? 'var(--success)' : 'var(--text-muted)',
            }}
          >
            {item.ready ? '✓ ' : ''}{item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
