import React from 'react';
import { Trash2 } from 'lucide-react';
import { Slider } from '../ui/primitives.jsx';
import { TextOverlayEditor } from './TextAreaPanel.jsx';
import { FontFamilySelect } from '../ui/font-pickers.jsx';
import {
  ELEMENT_CATALOG,
  normalizeOverlays,
  updateOverlayOnSlide,
} from '../../utils/card-overlays.js';

/**
 * Painel estilo Canva — grelha de elementos para inserir no card activo.
 */
export function ElementsPanel({
  slide = null,
  brand = {},
  selectedOverlayId = null,
  onInsert = () => {},
  onRemove = () => {},
  onUpdate = () => {},
  onSelect = () => {},
  toast,
}) {
  const overlays = normalizeOverlays(slide?.overlays);
  const selected = overlays.find((o) => o.id === selectedOverlayId) || null;
  const groups = React.useMemo(() => {
    const map = new Map();
    for (const item of ELEMENT_CATALOG) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group).push(item);
    }
    return [...map.entries()];
  }, []);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        Clique para inserir. No card: arraste, Delete remove. Abaixo edita texto e cores do seleccionado.
      </p>

      {groups.map(([group, items]) => (
        <div key={group} style={{ display: 'grid', gap: 8 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)',
          }}>
            {group}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 8,
          }}>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onInsert(item.factory());
                  toast?.(`${item.label} inserido no card.`, 'success', 2500);
                }}
                title={item.hint}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 8,
                  padding: 10,
                  minHeight: 96,
                  borderRadius: 12,
                  border: '1px solid var(--hairline)',
                  background: 'var(--bg-card)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.12s, transform 0.1s',
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              >
                <ElementPreview kind={item.preview} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                  {item.label}
                </span>
                <span style={{
                  fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.03em', textTransform: 'uppercase',
                }}>
                  {item.hint}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {selected ? (
        <OverlayEditor
          overlay={selected}
          brand={brand}
          onChange={(patch) => {
            const next = updateOverlayOnSlide(slide, selected.id, patch);
            onUpdate(next.overlays);
          }}
          onRemove={() => onRemove(selected.id)}
        />
      ) : null}

      {overlays.length ? (
        <div style={{
          marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--hairline)',
          display: 'grid', gap: 6,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)',
          }}>
            Neste card · {overlays.length}
          </div>
          {overlays.map((ov, idx) => (
            <div
              key={ov.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 10,
                border: `1px solid ${ov.id === selectedOverlayId ? 'var(--accent)' : 'var(--hairline)'}`,
                background: ov.id === selectedOverlayId ? 'var(--accent-surface)' : 'var(--bg-pearl)',
              }}
            >
              <button
                type="button"
                onClick={() => onSelect(ov.id)}
                style={{
                  flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8,
                  background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
                  textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                }}
              >
                {ov.type === 'rule' ? (
                  <span
                    aria-hidden
                    style={{
                      width: 22,
                      height: Math.max(2, Math.min(10, Number(ov.thickness) || 2)),
                      background: ov.color,
                      borderRadius: 99,
                      flexShrink: 0,
                    }}
                  />
                ) : null}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ov.type === 'cta' ? (ov.text || 'CTA') : ov.type === 'rule' ? 'Traço' : (ov.text || 'Texto').split('\n')[0]}
                </span>
              </button>
              <span style={{
                fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
              }}>
                #{idx + 1}
              </span>
              <button
                type="button"
                aria-label="Remover elemento"
                onClick={() => onRemove(ov.id)}
                style={{
                  width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
                  background: 'var(--bg-card)', color: '#f87171', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function OverlayEditor({ overlay, onChange, onRemove, brand }) {
  if (overlay.type === 'text') {
    return (
      <div data-vc-overlay-editor="">
        <TextOverlayEditor overlay={overlay} brand={brand} onChange={onChange} onRemove={onRemove} />
      </div>
    );
  }
  if (overlay.type === 'rule') {
    return (
      <div data-vc-overlay-editor="" style={editorBox}>
        <div style={editorTitle}>Editar traço</div>
        <Slider
          label="Espessura"
          value={Math.max(1, Math.min(48, Math.round(Number(overlay.thickness) || 2)))}
          min={1}
          max={48}
          onChange={(thickness) => onChange({ thickness })}
        />
        <Slider
          label="Comprimento"
          value={Math.max(8, Math.min(90, Math.round(Number(overlay.w) || 28)))}
          min={8}
          max={90}
          onChange={(w) => onChange({ w })}
        />
        <label style={fieldLabel}>
          Cor
          <input
            type="color"
            aria-label="Cor do traço"
            value={toColorInput(overlay.color)}
            onChange={(e) => onChange({ color: e.target.value })}
            style={colorInput}
          />
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ruleSwatches(brand).map((hex) => {
            const active = toColorInput(overlay.color).toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={hex}
                type="button"
                aria-label={`Cor ${hex}`}
                title={hex}
                onClick={() => onChange({ color: hex })}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: hex,
                  border: active ? '2px solid var(--accent)' : '1px solid var(--hairline)',
                  boxShadow: active ? 'inset 0 0 0 2px #fff' : 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            );
          })}
        </div>
        <button type="button" className="vc-btn vc-btn-ghost" onClick={onRemove} style={{ minHeight: 36, fontSize: 12, color: '#f87171' }}>
          <Trash2 size={12} /> Remover
        </button>
      </div>
    );
  }
  if (overlay.type !== 'cta') return null;
  return (
    <div data-vc-overlay-editor="" style={editorBox}>
      <div style={editorTitle}>Editar CTA</div>
      <FontFamilySelect label="Fonte da chamada" value={overlay.fontFamily || ''} brand={brand} onChange={fontFamily => onChange({ fontFamily })} />
      <Slider
        label="Tamanho"
        value={Number(overlay.size) || 100}
        min={50}
        max={240}
        onChange={(size) => onChange({ size })}
      />
      <label style={fieldLabel}>
        Texto
        <input
          className="vc-input"
          value={overlay.text || ''}
          maxLength={80}
          onChange={(e) => onChange({ text: e.target.value })}
          style={{ minHeight: 40, fontSize: 13 }}
        />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <label style={fieldLabel}>
          Fundo
          <input type="color" value={toColorInput(overlay.bg)} onChange={(e) => onChange({ bg: e.target.value, variant: 'filled' })} style={colorInput} />
        </label>
        <label style={fieldLabel}>
          Texto
          <input type="color" value={toColorInput(overlay.fg)} onChange={(e) => onChange({ fg: e.target.value })} style={colorInput} />
        </label>
        <label style={fieldLabel}>
          Borda
          <input type="color" value={toColorInput(overlay.border)} onChange={(e) => onChange({ border: e.target.value })} style={colorInput} />
        </label>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600 }}>
        <input
          type="checkbox"
          checked={overlay.arrow !== false}
          onChange={(e) => onChange({ arrow: e.target.checked })}
        />
        Seta
      </label>
      <button type="button" className="vc-btn vc-btn-ghost" onClick={onRemove} style={{ minHeight: 36, fontSize: 12, color: '#f87171' }}>
        <Trash2 size={12} /> Remover
      </button>
    </div>
  );
}

const editorBox = {
  display: 'grid',
  gap: 10,
  padding: 12,
  borderRadius: 12,
  border: '1px solid var(--accent)',
  background: 'var(--accent-surface)',
};

const editorTitle = {
  fontSize: 10,
  fontWeight: 600,
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
};

const fieldLabel = {
  display: 'grid',
  gap: 4,
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
};

const colorInput = {
  width: '100%',
  height: 36,
  border: '1px solid var(--hairline)',
  borderRadius: 8,
  padding: 2,
  background: 'var(--bg-card)',
  cursor: 'pointer',
};

function toColorInput(value) {
  const v = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  const rgb = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgb) {
    const hex = (n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0');
    return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`;
  }
  return '#6B5344';
}

function ruleSwatches(brand) {
  const list = [];
  const push = (hex) => {
    if (typeof hex !== 'string' || !hex.trim()) return;
    const color = toColorInput(hex);
    if (!list.some((item) => item.toLowerCase() === color.toLowerCase())) list.push(color);
  };
  push(brand?.accent);
  push(brand?.titleColor);
  ['#1A1410', '#FFFFFF', '#F5F0E8', '#C4A574', '#6B5344'].forEach(push);
  return list.slice(0, 7);
}

function ElementPreview({ kind }) {
  const base = {
    height: 44,
    borderRadius: 8,
    background: 'linear-gradient(135deg, #ebe6df 0%, #d4c4b0 55%, #c4a992 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  };
  const pill = (style, label = 'CTA ›') => (
    <div style={base}>
      <span style={{
        padding: '5px 10px', borderRadius: 9999, fontSize: 7, fontWeight: 600,
        letterSpacing: '0.06em', ...style,
      }}>
        {label}
      </span>
    </div>
  );
  if (kind === 'filled') return pill({ background: '#6B5344', color: '#fff', border: '1px solid rgba(255,255,255,0.7)' });
  if (kind === 'outline') return pill({ background: 'transparent', color: '#5D4B42', border: '1px solid #5D4B42' });
  if (kind === 'glass') {
    return pill({
      background: 'rgba(40,32,28,0.45)', color: '#F5F0E8',
      border: '1px solid rgba(245,240,232,0.7)', backdropFilter: 'blur(4px)',
    });
  }
  if (kind === 'ink') return pill({ background: '#0A0A0A', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }, 'SAIBA ›');
  if (kind === 'cream') return pill({ background: '#F5F0E8', color: '#2C2420', border: '1px solid rgba(44,36,32,0.2)' }, 'MÉTODO ›');
  if (kind === 'gold') return pill({ background: '#4A3A32', color: '#F7F1E6', border: '1px solid #C4A574' });
  if (kind === 'white') return pill({ background: 'rgba(255,255,255,0.94)', color: '#1A1410', border: '1px solid #fff' }, 'COMEÇAR ›');
  if (kind === 'outline_light') return pill({ background: 'transparent', color: '#F5F0E8', border: '1px solid rgba(245,240,232,0.9)' });
  if (kind === 'rule' || kind === 'rule_light' || kind === 'rule_accent' || kind === 'rule_medium' || kind === 'rule_long' || kind === 'rule_bold') {
    const lines = {
      rule: { color: '#3A322C', width: '38%', height: 2 },
      rule_light: { color: 'rgba(245,240,232,0.9)', width: '32%', height: 2, dark: true },
      rule_accent: { color: '#C4A574', width: '28%', height: 3 },
      rule_medium: { color: '#3A322C', width: '55%', height: 6 },
      rule_long: { color: '#3A322C', width: '88%', height: 4 },
      rule_bold: { color: '#1A1410', width: '70%', height: 10 },
    };
    const line = lines[kind];
    return (
      <div style={{ ...base, justifyContent: 'flex-start', paddingLeft: 12, background: line.dark ? '#2a2420' : base.background }}>
        <span style={{ width: line.width, height: line.height, background: line.color, borderRadius: 99 }} />
      </div>
    );
  }
  return <div style={base} />;
}
