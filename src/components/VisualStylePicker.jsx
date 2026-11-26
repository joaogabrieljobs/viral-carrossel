/**
 * VisualStylePicker — grelha de padrões visuais por produto.
 * O preview respeita a proporção do catálogo (carrossel 4:5 ou deck 16:9).
 */

import React from 'react';
import { Check } from 'lucide-react';
import { renderPresetPreview } from '../styles/visual-presets.jsx';
import { renderPresentationPresetPreview } from '../styles/presentation-presets.jsx';

/**
 * Miniatura do modo livre ("Livre: o Moont decide"): três mini-páginas com
 * composições diferentes (foto ao lado em fundo claro, título grande em fundo
 * escuro, foto inteira com fundo de destaque), na paleta padrão do deck.
 * Só CSS: nenhuma imagem nova.
 */
const FREE_MINI = [
  { id: 'claro-foto', bg: '#F5F2EC', ink: '#15171C', photo: { left: '56%', top: '12%', width: '36%', height: '76%' }, title: { left: '9%', top: '26%', width: '38%' } },
  { id: 'escuro-titulo', bg: '#15171C', ink: '#F5F2EC', photo: null, title: { left: '10%', top: '22%', width: '74%' }, big: true },
  { id: 'destaque-foto', bg: '#C2410C', ink: '#F5F2EC', photo: { left: '0%', top: '0%', width: '46%', height: '100%' }, title: { left: '54%', top: '34%', width: '36%' } },
];
const MINI_PHOTO = 'linear-gradient(160deg, #D9A36A 0%, #9C5B3B 55%, #3E2A24 100%)';

function FreePresetPreview() {
  return (
    <div data-vc-free-preview="" aria-hidden style={{
      width: '100%', height: '100%', background: '#E7E1D6', position: 'relative', overflow: 'hidden',
    }}>
      {FREE_MINI.map((mini, i) => (
        <div key={mini.id} data-vc-free-mini={mini.id} style={{
          position: 'absolute', width: '58%', aspectRatio: '16 / 9',
          left: `${4 + i * 19}%`, top: `${6 + i * 22}%`,
          background: mini.bg, borderRadius: 3, overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        }}>
          {mini.photo ? <div style={{ position: 'absolute', ...mini.photo, background: MINI_PHOTO }} /> : null}
          <div style={{ position: 'absolute', ...mini.title, display: 'flex', flexDirection: 'column', gap: mini.big ? 4 : 3 }}>
            <span style={{ display: 'block', height: mini.big ? 7 : 4, width: '100%', background: mini.ink, borderRadius: 1 }} />
            <span style={{ display: 'block', height: mini.big ? 7 : 4, width: '72%', background: mini.ink, borderRadius: 1 }} />
            <span style={{ display: 'block', height: 2, width: '56%', marginTop: 3, background: mini.ink, opacity: 0.55, borderRadius: 1 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Fundo, título e acento que o estilo aplica; também usado nos Ajustes rápidos (UX-04). */
export function paletteSwatches(preset) {
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
  /** Opções exclusivas do assistente e da geração, sem mudar o editor atual. */
  allowGenerationOnly = false,
}) {
  const catalog = Array.isArray(presets) ? presets : [];
  // Os 12 estilos de carrossel primeiro; as 9 famílias editoriais (biblioteca
  // v4) num grupo próprio logo abaixo.
  // Modo livre ("Livre: o Moont decide") é o primeiro cartão quando a lista o
  // traz; fica fora das outras listas de estilos (oculto no catálogo).
  const free = catalog.filter((preset) => preset?.isFree && (!preset.generationOnly || allowGenerationOnly));
  const visible = catalog.filter((preset) => !preset?.hidden);
  const main = visible.filter((preset) => preset?.presetGroup !== 'familias-editoriais');
  const families = visible.filter((preset) => preset?.presetGroup === 'familias-editoriais');
  const visiblePresets = [
    ...free,
    ...main,
    ...(families.length ? [{ __heading: true, id: '__families_heading' }] : []),
    ...families,
  ];
  // Um projeto antigo pode continuar usando um preset oculto. Ele não volta à
  // grade de escolha, mas a interface ainda identifica claramente o estilo em
  // uso até a pessoa optar por um dos padrões atuais.
  const selected = catalog.find((p) => p.id === value || p.sourceId === value) || null;

  return (
    <div role="group" aria-label={title || 'Padrões visuais'}>
      {title ? (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
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
          // Duas colunas no celular e nos painéis; em tela larga entram mais
          // colunas em vez de esticar a miniatura além do arquivo.
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(180px, calc(50% - 6px)), 1fr))',
          gap: 12,
        }}
      >
        {visiblePresets.map((p) => {
          if (p.__heading) {
            return (
              <div key={p.id} style={{
                gridColumn: '1 / -1', marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
                letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)',
              }}>
                Famílias editoriais
              </div>
            );
          }
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
              aria-label={`${p.label}. ${p.desc}`}
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
                  fontSize: 12,
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
                {/* A caixa tem a proporção do card: a miniatura nunca é cortada,
                    seja o cartão estreito (painel) ou largo (celular, criação). */}
                <div style={{
                  width: '100%',
                  aspectRatio: previewAspect,
                  borderRadius: 8,
                  overflow: 'hidden',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                }}>
                  {p.isFree
                    ? <FreePresetPreview />
                    : isPresentationPreview
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
                {p.isFree ? (
                  <div data-vc-free-desc="" style={{
                    fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.35, letterSpacing: '-0.005em',
                  }}>
                    {p.desc}
                  </div>
                ) : null}
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
            {selected.hidden && !selected.isFree ? `Padrão legado em uso · ${selected.label}` : selected.label}
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
