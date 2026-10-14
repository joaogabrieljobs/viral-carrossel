import React from 'react';
import { AlignLeft, AlignCenter, AlignRight, Trash2, Type } from 'lucide-react';
import { normalizeOverlays, updateOverlayOnSlide } from '../../utils/card-overlays.js';

/** Criação e edição de textos livres, independentes do título e do subtítulo. */
export function TextAreaPanel({
  slide = null,
  selectedOverlayId = null,
  onCreate = null,
  onUpdate = () => {},
  onRemove = () => {},
}) {
  const selected = normalizeOverlays(slide?.overlays).find((overlay) => (
    overlay.id === selectedOverlayId && overlay.type === 'text'
  ));

  return (
    <section aria-label="Áreas de texto" style={{ display: 'grid', gap: 12 }}>
      <button
        type="button"
        className="vc-btn"
        disabled={!slide || !onCreate}
        onClick={() => onCreate?.()}
        style={{
          width: '100%', minHeight: 44, borderRadius: 9999, border: 'none',
          background: 'var(--accent)', color: 'var(--accent-on-dark, #fff)',
          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: !slide || !onCreate ? 0.5 : 1,
        }}
      >
        <Type size={15} aria-hidden /> Criar texto
      </button>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Control + clique no card para criar texto naquele ponto.
      </p>
      {selected ? (
        <TextOverlayEditor
          overlay={selected}
          onChange={(patch) => onUpdate(updateOverlayOnSlide(slide, selected.id, patch).overlays)}
          onRemove={() => onRemove(selected.id)}
        />
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Selecione uma área de texto no card para editar.
        </p>
      )}
    </section>
  );
}

export function TextOverlayEditor({ overlay, onChange, onRemove }) {
  return (
    <div style={{
      display: 'grid', gap: 12, padding: 12, borderRadius: 12,
      border: '1px solid var(--accent)', background: 'var(--accent-surface)',
    }}>
      <label style={fieldLabel}>
        Texto da área
        <textarea
          className="vc-input vc-textarea"
          value={overlay.text ?? ''}
          onChange={(event) => onChange({ text: event.target.value })}
          rows={4}
          placeholder="Digite seu texto"
          style={{ minHeight: 96, fontSize: 13, lineHeight: 1.5, resize: 'vertical' }}
        />
      </label>
      <label style={fieldLabel}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Tamanho
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Number(overlay.size).toLocaleString('pt-BR')}</span>
        </span>
        <input
          type="range"
          min={1.5}
          max={8}
          step={0.1}
          value={overlay.size}
          aria-label="Tamanho do texto"
          onChange={(event) => onChange({ size: Number(event.target.value) })}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </label>
      <label style={fieldLabel}>
        Cor do texto
        <input
          type="color"
          value={colorInputValue(overlay.color)}
          onChange={(event) => onChange({ color: event.target.value })}
          style={{
            width: '100%', height: 36, padding: 2, borderRadius: 8,
            border: '1px solid var(--hairline)', background: 'var(--bg-card)', cursor: 'pointer',
          }}
        />
      </label>
      <div role="group" aria-label="Alinhamento do texto" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {[
          { value: 'left', label: 'Alinhar à esquerda', Icon: AlignLeft },
          { value: 'center', label: 'Centralizar texto', Icon: AlignCenter },
          { value: 'right', label: 'Alinhar à direita', Icon: AlignRight },
        ].map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={overlay.align === value}
            onClick={() => onChange({ align: value })}
            style={{
              minHeight: 36, borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${overlay.align === value ? 'var(--accent)' : 'var(--border)'}`,
              background: overlay.align === value ? 'var(--accent)' : 'var(--bg-card)',
              color: overlay.align === value ? 'var(--accent-on-dark, #fff)' : 'var(--text-primary)',
            }}
          >
            <Icon size={15} aria-hidden />
          </button>
        ))}
      </div>
      <button type="button" className="vc-btn vc-btn-ghost" onClick={onRemove} style={{ minHeight: 36, fontSize: 12, color: '#f87171' }}>
        <Trash2 size={12} aria-hidden /> Remover texto
      </button>
    </div>
  );
}

const fieldLabel = {
  display: 'grid', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
};

function colorInputValue(value) {
  const color = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return '#3A322C';
}
