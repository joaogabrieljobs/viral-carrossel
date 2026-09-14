import React, { useEffect, useState } from 'react';
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { startCheckout } from '../lib/billing.js';
import GoogleSignInButton from './GoogleSignInButton.jsx';
import BrandLogo from './BrandLogo.jsx';
import { PLAN_ORDER, PLAN_TIERS } from '../../shared/plans.js';

/**
 * Paywall — 4 planos (Essencial / Criador / Pro / Max).
 * Texto BYOK (padrão Z.ai); imagens inclusas nos planos com quota > 0.
 */
export default function Paywall({
  isMobile,
  onBack,
  onAlreadyActive,
  initialEmail = '',
  loginHint = '',
}) {
  const [email, setEmail] = useState(initialEmail || '');
  const [tier, setTier] = useState('creator');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(loginHint || '');

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (loginHint) setError(loginHint);
  }, [loginHint]);

  const plan = PLAN_TIERS[tier] || PLAN_TIERS.creator;

  const submit = async (e) => {
    e?.preventDefault?.();
    setError('');
    setLoading(true);
    try {
      const data = await startCheckout(email, { tier });
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
          maxWidth: 520,
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
          Escolha o plano
        </p>
        <h1 style={{
          margin: '0 0 12px',
          fontSize: isMobile ? 26 : 32,
          fontWeight: 600,
          letterSpacing: '-0.028em',
          fontFamily: 'var(--font-display, Inter, sans-serif)',
          lineHeight: 1.15,
        }}>
          Studio completo. Imagens inclusas nos planos pagos.
        </h1>
        <p style={{
          margin: '0 0 20px',
          fontSize: 14,
          lineHeight: 1.5,
          color: 'var(--text-secondary, #b8b4c2)',
        }}>
          Texto com a sua chave (recomendamos Z.ai). Imagens já vêm no Criador, Pro e Max — no Essencial usa a sua chave.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 8,
          marginBottom: 20,
        }}>
          {PLAN_ORDER.map((id) => {
            const p = PLAN_TIERS[id];
            const selected = tier === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTier(id)}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: selected ? '1.5px solid var(--accent, #ff2d8d)' : '1px solid rgba(255,255,255,0.12)',
                  background: selected ? 'rgba(255,45,141,0.12)' : 'rgba(255,255,255,0.03)',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <strong style={{ display: 'block', fontSize: 13 }}>{p.name}</strong>
                <span style={{ display: 'block', marginTop: 4, fontSize: 18, fontWeight: 600 }}>{p.priceLabel}<span style={{ fontSize: 12, fontWeight: 500, opacity: 0.7 }}>/mês</span></span>
                <span style={{ display: 'block', marginTop: 6, fontSize: 11, lineHeight: 1.35, opacity: 0.75 }}>
                  {p.imageQuota > 0 ? `${p.imageQuota} imagens/mês` : 'Sem imagens inclusas'}
                </span>
              </button>
            );
          })}
        </div>

        <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-secondary, #b8b4c2)' }}>
          {plan.blurb}
        </p>

        <form onSubmit={submit}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 600 }}>
            E-mail
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            style={{
              width: '100%',
              height: 48,
              borderRadius: 9999,
              border: '1px solid rgba(255,255,255,0.16)',
              background: 'rgba(0,0,0,0.35)',
              color: '#fff',
              padding: '0 18px',
              fontSize: 15,
              marginBottom: 12,
              boxSizing: 'border-box',
            }}
          />
          {error && (
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#ff8fab' }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="vc-btn"
            style={{
              width: '100%',
              height: 48,
              borderRadius: 9999,
              border: 'none',
              background: '#fff',
              color: '#000',
              fontWeight: 600,
              fontSize: 15,
              cursor: loading ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {loading ? <Loader2 size={18} className="spin" /> : <ArrowRight size={18} />}
            Continuar · {plan.priceLabel}/mês
          </button>
        </form>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GoogleSignInButton />
          <p style={{
            margin: 0,
            fontSize: 11,
            lineHeight: 1.45,
            color: 'var(--text-secondary, #b8b4c2)',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
          }}>
            <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            Pagamento seguro via Stripe. Cancele quando quiser no portal do cliente.
          </p>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary, #b8b4c2)',
                cursor: 'pointer',
                fontSize: 13,
                padding: 0,
                alignSelf: 'flex-start',
              }}
            >
              ← Voltar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
