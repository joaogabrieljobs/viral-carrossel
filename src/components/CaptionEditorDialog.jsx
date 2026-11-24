import React, { useRef } from 'react';
import { Copy, X } from 'lucide-react';
import { useModalDialog } from '../hooks/useModalDialog.js';

/**
 * Diálogo "Legenda da publicação" (ou "Notas do slide", em apresentação).
 * Segue o contrato dos modais do editor: Esc fecha, o Tab fica dentro, o fundo
 * não recebe foco nem clique e o foco volta ao botão que abriu.
 */
export default function CaptionEditorDialog({ open, onClose, isPresentation = false, slideNumber = 1, value = '', onChange, onCopy }) {
  const fieldRef = useRef(null);
  const { overlayRef, dialogRef, onDialogKeyDown } = useModalDialog({ open, onClose, initialFocusRef: fieldRef });
  if (!open) return null;
  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      role="presentation"
      onClick={onClose}
      style={{ zIndex: 1200 }}
    >
      <div
        ref={dialogRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={isPresentation ? `Notas do slide ${slideNumber}` : "Legenda da publicação"}
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480, width: 'min(480px, calc(100% - 32px))', padding: 0 }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>
              {isPresentation ? `Notas · slide ${slideNumber}` : 'Legenda da publicação'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Não aparece no visual do card — só para publicar / copiar.
            </div>
          </div>
          <button
            type="button"
            className="vc-icon-btn"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 16, display: 'grid', gap: 10 }}>
          <textarea
            ref={fieldRef}
            className="vc-input vc-textarea"
            rows={7}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={isPresentation ? "Notas deste slide…" : "Escreva a legenda da publicação…"}
            style={{ fontSize: 13, lineHeight: 1.5, resize: 'vertical', minHeight: 140 }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="vc-btn vc-btn-ghost"
              style={{ minHeight: 36, fontSize: 12 }}
              onClick={onCopy}
            >
              <Copy size={13} /> Copiar
            </button>
            <button
              type="button"
              className="vc-btn"
              style={{
                minHeight: 36, fontSize: 12, borderRadius: 9999, border: 'none',
                background: 'var(--accent)', color: '#fff', fontWeight: 600, padding: '0 16px',
              }}
              onClick={onClose}
            >
              Feito
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
