import React, { useMemo, useState } from 'react';
import { FileText, Loader2, X } from 'lucide-react';
import {
  IMPORT_TEXT_TEMPLATE,
  parseImportedText,
} from '../../utils/import-text.js';

/**
 * Modal: colar ou carregar texto estruturado (1 página = 1 card).
 */
export function ImportTextModal({
  open,
  onClose,
  onApply,
  busy = false,
  itemLabel = 'card',
}) {
  const [raw, setRaw] = useState(IMPORT_TEXT_TEMPLATE);
  const preview = useMemo(() => parseImportedText(raw), [raw]);

  if (!open) return null;

  const apply = () => {
    if (!preview.cards.length) return;
    onApply?.(preview);
  };

  const loadFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    setRaw(text);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Importar texto"
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}
    >
      <div style={{
        width: 'min(720px, 100%)', maxHeight: '90vh', overflow: 'auto',
        background: 'var(--bg-base)', borderRadius: 16,
        border: '1px solid var(--border)', padding: 18,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
              letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)',
            }}>
              Importar texto
            </div>
            <h2 style={{
              margin: '4px 0 0', fontSize: 18, fontWeight: 600,
              fontFamily: 'var(--font-display)', letterSpacing: '-0.022em',
            }}>
              1 página → 1 {itemLabel}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Separe páginas com <code>---</code> ou <code>=== Card N ===</code>.
              Use rótulos <strong>Título</strong>, <strong>Headline</strong>, <strong>Subtítulo</strong>, <strong>CTA</strong> e <strong>LEGENDA</strong> (fora dos cards).
            </p>
          </div>
          <button
            type="button"
            className="vc-btn vc-btn-ghost"
            aria-label="Fechar"
            disabled={busy}
            onClick={onClose}
            style={{ width: 40, minWidth: 40, height: 40, padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <label className="vc-btn vc-btn-ghost" style={{ minHeight: 40, cursor: 'pointer' }}>
            <FileText size={14} /> Carregar .txt / .md
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              hidden
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                void loadFile(file);
              }}
            />
          </label>
          <button
            type="button"
            className="vc-btn vc-btn-ghost"
            disabled={busy}
            onClick={() => setRaw(IMPORT_TEXT_TEMPLATE)}
            style={{ minHeight: 40 }}
          >
            Usar modelo
          </button>
        </div>

        <textarea
          className="vc-input vc-textarea"
          aria-label="Texto a importar"
          rows={14}
          value={raw}
          disabled={busy}
          onChange={(e) => setRaw(e.target.value)}
          style={{ minHeight: 220, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.45 }}
        />

        <div style={{
          padding: 10, borderRadius: 10, border: '1px solid var(--hairline)',
          background: 'var(--bg-pearl)', fontSize: 12, color: 'var(--text-secondary)',
        }}>
          Prévia: <strong>{preview.cards.length}</strong> {itemLabel}{preview.cards.length === 1 ? '' : 's'}
          {preview.cards.filter((c) => c.caption).length
            ? ` · ${preview.cards.filter((c) => c.caption).length} legenda${preview.cards.filter((c) => c.caption).length === 1 ? '' : 's'} nos cards`
            : ''}
          {preview.caption ? ' · legenda global do post' : ''}
          {preview.cards[0]?.title ? (
            <div style={{ marginTop: 6, color: 'var(--text-muted)' }}>
              1º {itemLabel}: «{preview.cards[0].title.slice(0, 80)}»
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="vc-btn vc-btn-ghost" disabled={busy} onClick={onClose} style={{ minHeight: 44 }}>
            Cancelar
          </button>
          <button
            type="button"
            className="vc-btn"
            disabled={busy || !preview.cards.length}
            onClick={apply}
            style={{
              minHeight: 44, padding: '0 18px', borderRadius: 9999, border: 'none',
              background: busy || !preview.cards.length ? 'var(--bg-pearl)' : 'var(--accent)',
              color: busy || !preview.cards.length ? 'var(--text-muted)' : '#fff',
              fontWeight: 600,
            }}
          >
            {busy ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
            Aplicar aos {itemLabel}s
          </button>
        </div>
      </div>
    </div>
  );
}
