import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import GoogleSignInButton from './GoogleSignInButton.jsx';

/**
 * Login para quem já assina — só Google.
 * E-mail sozinho NÃO autentica (qualquer pessoa com o e-mail entrava).
 */
export default function LoginModal({
  open,
  onClose,
  initialEmail = '',
  hint = '',
}) {
  const [error, setError] = useState(hint || '');

  useEffect(() => {
    if (!open) return;
    setError(hint || '');
  }, [open, hint, initialEmail]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="presentation"
      style={{ zIndex: 12000 }}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onClick={(event) => event.stopPropagation()}
        style={{
          maxWidth: 420,
          width: 'min(420px, calc(100vw - 24px))',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <header style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          padding: '20px 20px 0',
        }}>
          <div>
            <p className="vc-eyebrow" style={{ margin: '0 0 6px' }}>Já tem conta</p>
            <h2 id="login-title" style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '-0.022em',
              lineHeight: 1.2,
            }}>
              Entrar no studio
            </h2>
            <p style={{
              margin: '8px 0 0',
              fontSize: 13,
              lineHeight: 1.45,
              color: 'var(--text-muted)',
            }}>
              Entre com o Google do mesmo e-mail da assinatura. Não usamos senha —
              o Google confirma que a conta é sua.
            </p>
          </div>
          <button type="button" onClick={onClose} className="vc-icon-btn" aria-label="Fechar">
            <X size={17} />
          </button>
        </header>

        <div style={{ padding: 20, display: 'grid', gap: 16 }}>
          {error && (
            <p style={{ margin: 0, fontSize: 12, color: '#ff6b8a', lineHeight: 1.4 }}>{error}</p>
          )}

          <GoogleSignInButton fullWidth label="Entrar com Google" />

          <p style={{
            margin: 0,
            fontSize: 11,
            lineHeight: 1.45,
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}>
            Novo por aqui? Feche e use <strong style={{ color: 'var(--text-secondary)' }}>Começar agora</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
