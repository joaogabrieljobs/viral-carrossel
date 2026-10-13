import React from 'react';
import { Trash2 } from 'lucide-react';
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
  selectedOverlayId = null,
  onInsert = () => {},
  onRemove = () => {},
  onUpdate = () => {},
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
              <span style={{
                flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {ov.type === 'cta' ? (ov.text || 'CTA') : ov.type === 'rule' ? 'Traço' : (ov.text || 'Texto').split('\n')[0]}
              </span>
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

function OverlayEditor({ overlay, onChange, onRemove }) {
  if (overlay.type === 'rule') {
    return (
      <div style={editorBox}>
        <div style={editorTitle}>Editar traço</div>
        <label style={fieldLabel}>
          Cor
          <input
            type="color"
            value={toColorInput(overlay.color)}
            onChange={(e) => onChange({ color: e.target.value })}
            style={colorInput}
          />
        </label>
        <button type="button" className="vc-btn vc-btn-ghost" onClick={onRemove} style={{ minHeight: 36, fontSize: 12, color: '#f87171' }}>
          <Trash2 size={12} /> Remover
        </button>
      </div>
    );
  }
  if (overlay.type !== 'cta') return null;
  return (
    <div style={editorBox}>
      <div style={editorTitle}>Editar CTA</div>
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
  return '#6B5344';
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
  if (kind === 'rule' || kind === 'rule_light' || kind === 'rule_accent') {
    const color = kind === 'rule_light' ? 'rgba(245,240,232,0.9)' : kind === 'rule_accent' ? '#C4A574' : '#3A322C';
    return (
      <div style={{ ...base, justifyContent: 'flex-start', paddingLeft: 12, background: kind === 'rule_light' ? '#2a2420' : base.background }}>
        <span style={{ width: '38%', height: kind === 'rule_accent' ? 3 : 2, background: color, borderRadius: 2 }} />
      </div>
    );
  }
  return <div style={base} />;
}
