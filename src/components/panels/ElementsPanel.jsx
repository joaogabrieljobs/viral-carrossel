import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ELEMENT_CATALOG, normalizeOverlays } from '../../utils/card-overlays.js';

/**
 * Painel estilo Canva — grelha de elementos para inserir no card activo.
 */
export function ElementsPanel({
  slide = null,
  onInsert = () => {},
  onRemove = () => {},
  toast,
}) {
  const overlays = normalizeOverlays(slide?.overlays);
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
        Clique para inserir no card activo. Arraste no preview para posicionar.
        CTAs e traços seguem o visual premium — sem sombra pesada.
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
                border: '1px solid var(--hairline)', background: 'var(--bg-pearl)',
              }}
            >
              <Plus size={12} color="var(--text-muted)" style={{ flexShrink: 0, opacity: 0.5 }} />
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
  if (kind === 'filled') {
    return (
      <div style={base}>
        <span style={{
          padding: '5px 10px', borderRadius: 9999, background: '#6B5344', color: '#fff',
          fontSize: 7, fontWeight: 600, letterSpacing: '0.08em', border: '1px solid rgba(255,255,255,0.7)',
        }}>
          CTA →
        </span>
      </div>
    );
  }
  if (kind === 'outline') {
    return (
      <div style={base}>
        <span style={{
          padding: '5px 10px', borderRadius: 9999, background: 'transparent', color: '#5D4B42',
          fontSize: 7, fontWeight: 600, letterSpacing: '0.04em', border: '1px solid #5D4B42',
        }}>
          CTA →
        </span>
      </div>
    );
  }
  if (kind === 'glass') {
    return (
      <div style={base}>
        <span style={{
          padding: '5px 10px', borderRadius: 9999,
          background: 'rgba(40,32,28,0.45)', color: '#F5F0E8',
          fontSize: 7, fontWeight: 500, letterSpacing: '0.08em',
          border: '1px solid rgba(245,240,232,0.7)',
          backdropFilter: 'blur(4px)',
        }}>
          CTA →
        </span>
      </div>
    );
  }
  if (kind === 'rule') {
    return (
      <div style={{ ...base, justifyContent: 'flex-start', paddingLeft: 12 }}>
        <span style={{ width: '38%', height: 2, background: '#3A322C', borderRadius: 2 }} />
      </div>
    );
  }
  return (
    <div style={{
      ...base,
      background: '#f4f1ec',
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '8px 10px',
      gap: 5,
    }}>
      <span style={{ width: 22, height: 1.5, background: '#3A322C', display: 'block' }} />
      <span style={{ fontSize: 8, color: '#3A322C', lineHeight: 1.2, fontWeight: 500 }}>
        Você tem o direito…
      </span>
    </div>
  );
}
