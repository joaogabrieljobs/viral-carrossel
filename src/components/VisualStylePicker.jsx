/**
 * VisualStylePicker — grelha de padrões visuais por produto.
 * O preview respeita a proporção do catálogo (carrossel 4:5 ou deck 16:9).
 */

import React from 'react';
import { Check } from 'lucide-react';
import { renderPresetPreview } from '../styles/visual-presets.jsx';
import { renderPresentationPresetPreview } from '../styles/presentation-presets.jsx';

function paletteSwatches(preset) {
  const b = preset?.brand || {};
  return [b.bg, b.titleColor, b.accent].filter(Boolean).slice(0, 3);
}

export default function VisualStylePicker({
  value,
  onChange,
  presets,
  title = 'Escolha o padrão visual',
  /** id do padrão que combina com o conteúdo atual (ponte template/IA → visual). */
  suggestedId = null,
  /** Permite forçar a proporção; sem valor, cada preset declara seu produto. */
  aspectRatio = null,
}) {
  const catalog = Array.isArray(presets) ? presets : [];
  const visiblePresets = catalog.filter((preset) => !preset?.hidden);
  // Um projeto antigo pode continuar usando um preset oculto. Ele não volta à
  // grade de escolha, mas a interface ainda identifica claramente o estilo em
  // uso até a pessoa optar por um dos padrões atuais.
  const selected = catalog.find((p) => p.id === value || p.sourceId === value) || null;

  return (
    <div role="group" aria-label={title || 'Padrões visuais'}>
      {title ? (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 12,
        }}>
          {title}
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 12,
        }}
      >
        {visiblePresets.map((p) => {
          const isActive = selected?.id === p.id;
          const isSuggested = !isActive && suggestedId === p.id;
          const swatches = paletteSwatches(p);
          const previewAspect = aspectRatio || (p.productKind === 'apresentacao' ? '16 / 9' : '4 / 5');
          const isPresentationPreview = p.productKind === 'apresentacao' || previewAspect === '16 / 9';

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
                alignItems: 'stretch',
                gap: 0,
                padding: 0,
                borderRadius: 12,
                cursor: 'pointer',
                overflow: 'hidden',
                background: 'var(--bg-base)',
                border: `1px solid ${isActive ? 'var(--text-primary)' : isSuggested ? 'var(--text-muted)' : 'var(--hairline)'}`,
                boxShadow: isActive ? 'inset 0 0 0 1px var(--text-primary)' : 'none',
                transition: 'border-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth), box-shadow 0.15s',
                textAlign: 'left',
                fontFamily: 'var(--font-ui)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.borderColor = 'var(--text-muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                if (!isActive) {
                  e.currentTarget.style.borderColor = isSuggested
                    ? 'var(--text-muted)'
                    : 'var(--hairline)';
                }
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {isSuggested && (
                <span style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  zIndex: 2,
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)',
                  padding: '3px 7px',
                  borderRadius: 9999,
                  background: 'var(--text-primary)',
                  color: 'var(--accent-on-dark, #fff)',
                }}>
                  Combina
                </span>
              )}

              {isActive && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 2,
                    width: 22,
                    height: 22,
                    borderRadius: 9999,
                    background: 'var(--text-primary)',
                    color: 'var(--accent-on-dark, #fff)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={12} strokeWidth={2.75} />
                </span>
              )}

              <div style={{
                width: '100%',
                aspectRatio: previewAspect,
                background: 'var(--bg-parchment)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 10,
                boxSizing: 'border-box',
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  maxWidth: isPresentationPreview ? '100%' : 92,
                  borderRadius: 8,
                  overflow: 'hidden',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                }}>
                  {isPresentationPreview
                    ? renderPresentationPresetPreview(p, { width: '100%', height: '100%' })
                    : renderPresetPreview(p, { width: '100%', height: '100%' })}
                </div>
              </div>

              <div style={{
                padding: '10px 10px 12px',
                borderTop: '1px solid var(--hairline)',
                background: isActive ? 'var(--accent-surface)' : 'var(--bg-base)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.011em',
                  lineHeight: 1.25,
                }}>
                  {p.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {swatches.map((c, i) => (
                    <span
                      key={`${p.id}-sw-${i}`}
                      aria-hidden
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 9999,
                        background: c,
                        border: '1px solid rgba(0,0,0,0.12)',
                        flexShrink: 0,
                      }}
                    />
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div
          aria-live="polite"
          style={{
            marginTop: 14,
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid var(--hairline)',
            background: 'var(--bg-parchment)',
          }}
        >
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.011em',
            marginBottom: 4,
            fontFamily: 'var(--font-ui)',
          }}>
            {selected.hidden ? `Padrão legado em uso · ${selected.label}` : selected.label}
          </div>
          <div style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-ui)',
            lineHeight: 1.45,
            letterSpacing: '-0.005em',
          }}>
            {selected.desc}
          </div>
        </div>
      ) : null}
    </div>
  );
}
