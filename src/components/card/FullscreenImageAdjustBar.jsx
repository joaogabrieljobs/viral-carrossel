// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React from 'react';
import { Plus, Minus } from 'lucide-react';

function formatPresentationAdjDisp(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '0';
  if (v === 0) return '0';
  return v > 0 ? `+${v}` : String(v);
}

const FULLSCREEN_IMG_ADJ_ROWS = [
  { key: 'exposure', label: 'Exposição', step: 5, min: -50, max: 50 },
  { key: 'brightness', label: 'Brilho', step: 5, min: -50, max: 50 },
  { key: 'contrast', label: 'Contraste', step: 5, min: -50, max: 50 },
  { key: 'color', label: 'Cor', step: 5, min: -50, max: 50, hint: 'Saturação da imagem.' },
  { key: 'blacks', label: 'Pretos', step: 5, min: -50, max: 50, hint: 'Levanta ou reforça áreas escuras (simulado).' },
  { key: 'tonalidade', label: 'Tonalidade', step: 3, min: -45, max: 45, hint: 'Matiz (desloca tons quentes/frios).' },
];

function FullscreenImageAdjustBar({
  disabled,
  adj,
  onBump,
  onSetKey,
  onResetSlide,
  onSave,
  anyDirty,
  hasPendingPersist,
  onClose,
}) {
  const btnBase = {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.07)',
    color: 'var(--accent-on-dark)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    opacity: disabled ? 0.35 : 1,
    transition: 'background 0.15s, transform 0.1s',
  };
  return (
    <div
      style={{
        pointerEvents: 'auto',
        maxWidth: 560,
        width: 'calc(100% - 40px)',
        margin: '0 auto',
        padding: '11px 12px 10px',
        borderRadius: 14,
        background: 'rgba(12,12,14,0.78)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxSizing: 'border-box',
      }}
      role="region"
      aria-label="Ajustes de imagem na apresentação"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.92)',
            fontFamily: 'var(--font-ui)',
            letterSpacing: '-0.022em',
            lineHeight: 1.2,
          }}
        >
          Ajustes da foto
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {typeof onClose === 'function' && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar painel de ajustes da foto"
              style={{
                height: 30,
                padding: '0 12px',
                borderRadius: 9999,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.88)',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'var(--font-ui)',
                letterSpacing: '-0.011em',
                cursor: 'pointer',
                transition: 'background 0.15s, transform 0.1s',
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.95)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Fechar
            </button>
          )}
          <button
            type="button"
            disabled={disabled || !hasPendingPersist}
            onClick={onSave}
            aria-label="Salvar ajustes da foto neste projeto"
            style={{
              height: 30,
              padding: '0 14px',
              borderRadius: 9999,
              border: `1px solid ${hasPendingPersist && !disabled ? 'transparent' : 'rgba(255,255,255,0.14)'}`,
              background:
                hasPendingPersist && !disabled ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: hasPendingPersist && !disabled ? '#fff' : 'rgba(255,255,255,0.45)',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--font-ui)',
              letterSpacing: '-0.011em',
              cursor: disabled || !hasPendingPersist ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.45 : 1,
              transition: 'background 0.15s, transform 0.1s',
            }}
            onMouseDown={(e) => {
              if (!disabled && hasPendingPersist) e.currentTarget.style.transform = 'scale(0.95)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Salvar
          </button>
          <button
            type="button"
            disabled={disabled || !anyDirty}
            onClick={onResetSlide}
            aria-label="Redefinir ajustes deste slide"
            style={{
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--font-ui)',
              letterSpacing: '-0.011em',
              color: 'rgba(255,255,255,0.55)',
              background: 'transparent',
              border: 'none',
              cursor: disabled || !anyDirty ? 'not-allowed' : 'pointer',
              padding: '4px 2px',
              opacity: disabled || !anyDirty ? 0.42 : 1,
            }}
          >
            Redefinir este slide
          </button>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(252px, 1fr))',
          columnGap: 14,
          rowGap: 12,
          maxHeight: 'min(42vh, 360px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingBottom: 2,
          WebkitOverflowScrolling: 'touch',
          opacity: disabled ? 0.45 : 1,
          scrollbarWidth: 'thin',
        }}
      >
        {FULLSCREEN_IMG_ADJ_ROWS.map((row) => {
          const val = adj[row.key];
          const atMin = val <= row.min;
          const atMax = val >= row.max;
          const span = row.max - row.min || 1;
          const pct = ((val - row.min) / span) * 100;
          return (
            <div
              key={row.key}
              title={row.hint || undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                paddingBottom: 10,
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 10,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: 'var(--font-ui)',
                    color: 'rgba(255,255,255,0.58)',
                    letterSpacing: '-0.011em',
                    lineHeight: 1.25,
                  }}
                >
                  {row.label}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                    fontFamily: 'var(--font-mono)',
                    color: 'rgba(255,255,255,0.95)',
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                    letterSpacing: '-0.02em',
                  }}
                  aria-live="polite"
                >
                  {formatPresentationAdjDisp(val)}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <button
                  type="button"
                  aria-label={`Diminuir ${row.label}`}
                  disabled={disabled || atMin}
                  style={btnBase}
                  onMouseDown={(e) => {
                    if (!disabled && !atMin) e.currentTarget.style.transform = 'scale(0.95)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onClick={() => onBump(row.key, -row.step)}
                >
                  <Minus size={12} strokeWidth={2.25} />
                </button>
                <input
                  type="range"
                  className="vc-fs-pres-range"
                  aria-label={`${row.label}: deslizar para ajustar`}
                  aria-valuemin={row.min}
                  aria-valuemax={row.max}
                  aria-valuenow={val}
                  disabled={disabled}
                  min={row.min}
                  max={row.max}
                  step={row.step}
                  value={val}
                  onChange={(e) => onSetKey(row.key, Number(e.target.value))}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    margin: '2px 0',
                    '--pct': `${pct}%`,
                    backgroundImage: `linear-gradient(to right, var(--accent-on-dark) 0%, var(--accent-on-dark) ${pct}%, rgba(255,255,255,0.2) ${pct}%, rgba(255,255,255,0.2) 100%)`,
                  }}
                />
                <button
                  type="button"
                  aria-label={`Aumentar ${row.label}`}
                  disabled={disabled || atMax}
                  style={btnBase}
                  onMouseDown={(e) => {
                    if (!disabled && !atMax) e.currentTarget.style.transform = 'scale(0.95)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onClick={() => onBump(row.key, row.step)}
                >
                  <Plus size={12} strokeWidth={2.25} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {!disabled && (
        <div
          style={{
            marginTop: 8,
            fontSize: 10,
            fontWeight: 400,
            lineHeight: 1.45,
            color: 'rgba(255,255,255,0.36)',
            fontFamily: 'var(--font-ui)',
            letterSpacing: '-0.011em',
          }}
        >
          Use «Salvar» para gravar no projeto (persiste ao fechar). Exportação PNG/PDF usa esta foto assim
          quando salvo. Ao fechar sem salvar, as alterações em aberto continuam só na sessão atual.
        </div>
      )}
      {disabled && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.45)',
            fontFamily: 'var(--font-ui)',
            letterSpacing: '-0.011em',
            lineHeight: 1.45,
          }}
        >
          Adicione uma imagem de fundo ao slide para ajustar.
        </div>
      )}
    </div>
  );
}

export {
  formatPresentationAdjDisp,
  FULLSCREEN_IMG_ADJ_ROWS,
  FullscreenImageAdjustBar,
};
