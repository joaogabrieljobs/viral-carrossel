import React, { useEffect, useState } from 'react';
import { X, Loader2, Mail } from 'lucide-react';
import GoogleSignInButton from './GoogleSignInButton.jsx';
import { startCheckout } from '../lib/billing.js';

/**
 * Login para quem já assina — Google (preferido) ou e-mail da assinatura Stripe.
 */
export default function LoginModal({
  open,
  onClose,
  onAlreadyActive,
  initialEmail = '',
  hint = '',
}) {
  const [email, setEmail] = useState(initialEmail || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(hint || '');

  useEffect(() => {
    if (!open) return;
    setEmail(initialEmail || '');
    setError(hint || '');
  }, [open, initialEmail, hint]);

  if (!open) return null;

  const submitEmail = async (event) => {
    event?.preventDefault?.();
    setError('');
    setLoading(true);
    try {
      const data = await startCheckout(email);
      if (data.alreadyActive) {
        onAlreadyActive?.();
        return;
      }
      if (data.url) {
        // Sem assinatura ativa → manda ao checkout Stripe
        window.location.href = data.url;
        return;
      }
      setError('Não encontramos uma assinatura ativa neste e-mail.');
    } catch (err) {
      setError(err?.message || 'Não foi possível entrar');
    } finally {
      setLoading(false);
    }
  };

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
              Use o Google do mesmo e-mail da assinatura.
            </p>
          </div>
          <button type="button" onClick={onClose} className="vc-icon-btn" aria-label="Fechar">
            <X size={17} />
          </button>
        </header>

        <div style={{ padding: 20, display: 'grid', gap: 16 }}>
          <GoogleSignInButton fullWidth label="Entrar com Google" />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'var(--text-muted)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
          }}>
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            ou e-mail
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <form onSubmit={submitEmail} style={{ display: 'grid', gap: 10 }}>
            <label htmlFor="login-email" style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}>
              E-mail da assinatura
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@email.com"
              className="vc-input"
              style={{ width: '100%', height: 48 }}
            />
            {error && (
              <p style={{ margin: 0, fontSize: 12, color: '#ff6b8a', lineHeight: 1.4 }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="vc-btn"
              style={{
                height: 48,
                borderRadius: 9999,
                border: 'none',
                background: 'var(--text-primary)',
                color: 'var(--bg-base)',
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.75 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? <Loader2 size={16} className="vc-spin" /> : <Mail size={16} />}
              Continuar com e-mail
            </button>
          </form>

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
