import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { startCheckout } from '../lib/billing.js';
import GoogleSignInButton from './GoogleSignInButton.jsx';
import BrandLogo from './BrandLogo.jsx';

const PRICE_LABEL = 'R$ 97';
const PRICE_PERIOD = '/mês';

/**
 * Paywall de assinatura individual (Stripe Checkout).
 * BYOK: a geração usa a chave do utilizador; aqui só se paga o acesso ao studio.
 */
export default function Paywall({
  isMobile,
  onBack,
  onAlreadyActive,
  initialEmail = '',
  loginHint = '',
}) {
  const [email, setEmail] = useState(initialEmail || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(loginHint || '');

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (loginHint) setError(loginHint);
  }, [loginHint]);

  const submit = async (e) => {
    e?.preventDefault?.();
    setError('');
    setLoading(true);
    try {
      const data = await startCheckout(email);
      if (data.alreadyActive) {
        onAlreadyActive?.();
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError('Resposta inválida do checkout');
    } catch (err) {
      setError(err?.message || 'Erro ao iniciar assinatura');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '24px 16px' : '48px 24px',
        background: 'var(--bg-primary, #0e0c14)',
        color: 'var(--text-primary, #fff)',
        fontFamily: 'var(--font-ui, Inter, system-ui, sans-serif)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          padding: isMobile ? 28 : 36,
          borderRadius: 'var(--radius-xl, 24px)',
          border: '1px solid rgba(255, 45, 141, 0.28)',
          background: 'linear-gradient(165deg, rgba(255,45,141,0.08) 0%, rgba(14,12,20,0.95) 40%)',
          boxShadow: '0 8px 32px rgba(255, 45, 141, 0.12)',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <BrandLogo height={isMobile ? 26 : 30} />
        </div>
        <p style={{
          margin: '0 0 8px',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--accent, #ff2d8d)',
          fontWeight: 600,
        }}>
          Assinatura individual
        </p>
        <h1 style={{
          margin: '0 0 12px',
          fontSize: isMobile ? 26 : 32,
          fontWeight: 600,
          letterSpacing: '-0.028em',
          fontFamily: 'var(--font-display, Inter, sans-serif)',
          lineHeight: 1.15,
        }}>
          Acesso ao studio completo
        </h1>
        <p style={{
          margin: '0 0 24px',
          fontSize: 15,
          lineHeight: 1.5,
          color: 'var(--text-secondary, #b8b4c2)',
        }}>
          Um plano. Todos os modos (Criador, Diretor, Studio).
          Sem limite de carrosséis — a geração usa a chave do provedor que você escolher.
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginBottom: 24,
        }}>
          <span style={{
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            color: 'var(--text-primary, #fff)',
          }}>{PRICE_LABEL}</span>
          <span style={{
            fontSize: 15,
            color: 'var(--text-muted, #8a8696)',
          }}>{PRICE_PERIOD}</span>
        </div>

        <ul style={{
          margin: '0 0 28px',
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {[
            'Studio completo · modos livres',
            'Marca, narrativa, legenda e export',
            'BYOK — você controla o gasto na LLM',
            'Cancele quando quiser no portal do cliente',
          ].map((line) => (
            <li key={line} style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              fontSize: 14,
              color: 'var(--text-secondary, #b8b4c2)',
              lineHeight: 1.4,
            }}>
              <ShieldCheck size={16} color="var(--accent, #ff2d8d)" style={{ flexShrink: 0, marginTop: 2 }} />
              {line}
            </li>
          ))}
        </ul>

        <div style={{ marginBottom: 18 }}>
          <p style={{
            margin: '0 0 10px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-muted, #8a8696)',
          }}>
            Já assina? Entre com Google
          </p>
          <GoogleSignInButton fullWidth label="Entrar com Google" />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 16,
            color: 'var(--text-muted, #8a8696)',
            fontSize: 11,
            fontFamily: 'var(--font-mono, monospace)',
          }}>
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
            ou assine com e-mail
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
          </div>
        </div>

        <form onSubmit={submit}>
          <label style={{
            display: 'block',
            fontSize: 12,
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-muted, #8a8696)',
            marginBottom: 8,
            fontWeight: 600,
          }}>
            E-mail da assinatura
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder="voce@email.com"
            style={{
              width: '100%',
              height: 48,
              padding: '0 16px',
              borderRadius: 12,
              border: '1px solid var(--hairline, #2a2733)',
              background: 'var(--bg-secondary, #15131c)',
              color: 'var(--text-primary, #fff)',
              fontSize: 16,
              marginBottom: 12,
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
          {error && (
            <p style={{
              margin: '0 0 12px',
              fontSize: 13,
              color: '#ff6b8a',
              lineHeight: 1.4,
            }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="vc-landing-cta"
            style={{
              width: '100%',
              height: 52,
              borderRadius: 9999,
              border: 'none',
              background: 'var(--accent, #ff2d8d)',
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              fontFamily: 'inherit',
              opacity: loading ? 0.75 : 1,
            }}
          >
            {loading ? (
              <Loader2 size={18} className="vc-spin" style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Sparkles size={18} />
            )}
            Assinar e entrar
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{
              marginTop: 16,
              width: '100%',
              height: 40,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted, #8a8696)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Voltar à página inicial
          </button>
        )}

        <p style={{
          margin: '20px 0 0',
          fontSize: 11,
          lineHeight: 1.45,
          color: 'var(--text-muted, #8a8696)',
          fontFamily: 'var(--font-mono, monospace)',
          letterSpacing: '0.02em',
          textAlign: 'center',
        }}>
          Pagamento seguro · Assinatura mensal
        </p>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
