/**
 * VisualStylePicker — grelha de padrões visuais por produto.
 * O preview respeita a proporção do catálogo (carrossel 4:5 ou deck 16:9).
 */

import React from 'react';
import { Check } from 'lucide-react';
import { renderPresetPreview } from '../styles/visual-presets.jsx';
import { renderPresentationPresetPreview } from '../styles/presentation-presets.jsx';
import BrandLogo from './BrandLogo.jsx';

/**
 * Miniatura do modo livre ("Livre: o Moont decide"), igual na apresentação e
 * no carrossel: o símbolo do Moont (BrandLogo, as três molduras em sequência)
 * sobre a noite da marca, com o brilho Orbit e uma órbita fina — quem decide
 * a composição de cada página é o Moont. Só SVG e CSS: nenhuma imagem nova.
 */
const FREE_PREVIEW_SWATCHES = ['#F3F0E7', '#5B53E8', '#D7FF5A'];
const FREE_PREVIEW_LABEL = 'Símbolo do Moont: o Moont decide a composição de cada página';

function FreePresetPreview() {
  return (
    <div data-vc-free-preview="" role="img" aria-label={FREE_PREVIEW_LABEL} style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      background: 'radial-gradient(120% 95% at 50% 40%, #2B2785 0%, #16143F 46%, #090A0F 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '7%',
    }}>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <ellipse cx="50" cy="44" rx="40" ry="26" fill="none" stroke="#5B53E8" strokeOpacity="0.55" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* Ponto Aurora sobre a órbita; fora do SVG esticado para continuar redondo. */}
      <span aria-hidden="true" style={{
        position: 'absolute', left: '87.6%', top: '35.1%', width: 6, height: 6, borderRadius: 9999,
        background: '#D7FF5A', transform: 'translate(-50%, -50%)',
      }} />
      <BrandLogo variant="mark" alt="" data-vc-free-mark=""
        style={{ position: 'relative', height: '42%', width: 'auto', aspectRatio: '1 / 1', color: '#F3F0E7' }} />
      <span data-vc-free-caption="" style={{
        position: 'relative', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(243, 240, 231, 0.82)', whiteSpace: 'nowrap',
      }}>
        o Moont decide
      </span>
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
          // Livre: a paleta é decidida na geração; o cartão mostra as cores do Moont.
          const swatches = p.isFree ? FREE_PREVIEW_SWATCHES : paletteSwatches(p);
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
