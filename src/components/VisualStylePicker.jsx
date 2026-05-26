/**
 * VisualStylePicker — grid 3×4 com 12 padrões visuais pra carrossel.
 *
 * Cada card mostra mini-preview SVG do padrão + nome + descrição curta.
 * Selecionado fica com borda accent + check no canto.
 *
 * Props:
 *   - value: id do preset ativo (string) ou null pra "nenhum/padrão"
 *   - onChange: (id) => void
 *   - presets: array de presets (VISUAL_PRESETS de visual-presets.js)
 *   - title: string opcional (default: 'Escolha o Padrão Visual do seu Carrossel')
 */

import React from 'react';
import { Check } from 'lucide-react';

export default function VisualStylePicker({
  value,
  onChange,
  presets,
  title = 'Escolha o Padrão Visual do seu Carrossel',
}) {
  return (
    <div role="group" aria-label={title}>
      {title && (
        <label className="vc-label" style={{ marginBottom: 10 }}>
          {title}
        </label>
      )}
      {/* Grid responsivo: 3 cols no desktop, 2 no mobile estreito */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
          gap: 10,
        }}
      >
        {presets.map((p) => {
          const isActive = value === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              aria-pressed={isActive}
              title={`${p.label} — ${p.desc}`}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: 8,
                borderRadius: 11,
                cursor: 'pointer',
                background: isActive ? 'var(--accent-surface)' : 'var(--bg-card)',
                border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--hairline)'}`,
                transition: 'background-color 0.15s var(--ease-smooth), border-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
                textAlign: 'center',
                fontFamily: 'var(--font-ui)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.borderColor = 'var(--text-muted)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.borderColor = 'var(--hairline)';
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {/* Check no canto quando selecionado */}
              {isActive && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--accent)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  }}
                >
                  <Check size={11} strokeWidth={3} />
                </span>
              )}
              {/* Mini-preview SVG */}
              <div style={{ width: 60, height: 75, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.1)', borderRadius: 6 }}>
                {p.preview()}
              </div>
              {/* Nome do preset */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  letterSpacing: '-0.005em',
                  lineHeight: 1.2,
                  minHeight: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                }}
              >
                {p.label}
              </div>
            </button>
          );
        })}
      </div>
      {/* Descrição do selecionado */}
      {value && (
        <div
          aria-live="polite"
          style={{
            marginTop: 10,
            fontSize: 11,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-ui)',
            lineHeight: 1.5,
            letterSpacing: '-0.005em',
          }}
        >
          {presets.find((p) => p.id === value)?.desc}
        </div>
      )}
    </div>
  );
}
