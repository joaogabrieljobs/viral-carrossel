import React, { useEffect, useState } from 'react';
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { startCheckout } from '../lib/billing.js';
import GoogleSignInButton from './GoogleSignInButton.jsx';
import BrandLogo from './BrandLogo.jsx';
import { FREE_PLAN, PLAN_ORDER, PLAN_TIERS } from '../../shared/plans.js';

/**
 * Planos — 4 pagos (Essencial / Criador / Pro / Max) e o grátis.
 * Sem conta: oferece começar grátis (criar conta) ou assinar.
 * Conta grátis (`freeAccount`): é a página de upgrade; fechar volta ao editor
 * no mesmo ponto, sem perder o projeto aberto.
 */
export default function Paywall({
  isMobile,
  onBack,
  onLogin,
  onRegister,
  onManageBilling,
  initialEmail = '',
  loginHint = '',
  freeAccount = false,
  upgradeReason = '',
  upgradeFeature = '',
  onContinueFree,
  paymentUnconfirmed = false,
}) {
  const [email, setEmail] = useState(initialEmail || '');
  // Quem veio por imagem gerada precisa de um plano com imagens; para texto, o Essencial já resolve.
  const [tier, setTier] = useState(freeAccount && upgradeFeature && upgradeFeature !== 'image' ? 'essential' : 'creator');
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');
  const [error, setError] = useState(loginHint || '');

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (loginHint) setError(loginHint);
  }, [loginHint]);

  const plan = PLAN_TIERS[tier] || PLAN_TIERS.creator;

  const manageBilling = async () => {
    if (!onManageBilling || portalLoading) return;
    setPortalError('');
    setPortalLoading(true);
    try {
      const result = await onManageBilling();
      if (result?.ok === false) setPortalError(result.error || 'Não foi possível abrir o portal do cliente. Tente novamente.');
    } catch (err) {
      setPortalError(err?.message || 'Não foi possível abrir o portal do cliente. Tente novamente.');
    } finally {
      setPortalLoading(false);
    }
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    setError('');
    setLoading(true);
    try {
      const data = await startCheckout(email, { tier });
      if (data.requireLogin || data.alreadyActive) {
        setError(data.message || 'Este e-mail já tem assinatura. Entre com Google para acessar.');
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
        background: 'var(--bg-primary, #090a0f)',
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
          border: '1px solid rgba(91, 83, 232, 0.32)',
          background: 'linear-gradient(165deg, rgba(91,83,232,0.12) 0%, rgba(9,10,15,0.96) 40%)',
          boxShadow: '0 8px 32px rgba(91, 83, 232, 0.16)',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <BrandLogo height={isMobile ? 26 : 30} />
        </div>
        {/* UX-03: voltou do pagamento e a assinatura ainda não foi confirmada. */}
        {paymentUnconfirmed && (
          <section role="alert" data-vc-payment-unconfirmed style={{
            marginBottom: 20, padding: 16, borderRadius: 12, fontSize: 14, lineHeight: 1.5,
            border: '1px solid rgba(255,196,87,0.6)', background: 'rgba(255,196,87,0.1)',
          }}>
            <strong style={{ display: 'block', marginBottom: 6 }}>Não pague de novo.</strong>
            <p style={{ margin: '0 0 12px' }}>
              Seu pagamento pode já ter sido aprovado, mas ainda não conseguimos confirmar a assinatura. Tente confirmar de novo em alguns instantes.
            </p>
            <button type="button" onClick={() => window.location.reload()} className="vc-btn vc-btn-primary" style={{ width: '100%', minHeight: 44 }}>
              Tentar confirmar de novo
            </button>
          </section>
        )}
        <p style={{
          margin: '0 0 8px',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--accent, #5b53e8)',
          fontWeight: 600,
        }}>
          {freeAccount ? 'Você está no plano grátis' : 'Escolha o plano'}
        </p>
        <h1 style={{
          margin: '0 0 12px',
          fontSize: isMobile ? 26 : 32,
          fontWeight: 600,
          letterSpacing: '-0.028em',
          fontFamily: 'var(--font-display, Inter, sans-serif)',
          lineHeight: 1.15,
        }}>
          {freeAccount ? 'Assine para criar com IA.' : 'Studio completo. Imagens inclusas a partir do Plano Criador.'}
        </h1>
        <p style={{
          margin: '0 0 20px',
          fontSize: 14,
          lineHeight: 1.5,
          color: 'var(--text-secondary, #b8b4c2)',
        }}>
          {freeAccount
            ? 'Seu projeto continua aberto. Depois de assinar, você volta ao mesmo card.'
            : 'Texto (Moont AI) incluso em todos os planos. No Essencial, as imagens vêm das suas fotos ou da sua chave em Configurar IA.'}
        </p>

        {freeAccount && upgradeReason && (
          <p role="status" data-vc-upgrade-reason style={{
            margin: '0 0 20px', padding: '12px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.5,
            border: '1px solid rgba(91,83,232,0.45)', background: 'rgba(91,83,232,0.12)',
          }}>
            {upgradeReason}
          </p>
        )}

        {!freeAccount && onRegister && (
          <section aria-label="Plano grátis" style={{
            marginBottom: 20, padding: 16, borderRadius: 12,
            border: '1px solid rgba(215,255,90,0.45)', background: 'rgba(215,255,90,0.06)',
          }}>
            <strong style={{ display: 'block', fontSize: 15 }}>{FREE_PLAN.name} · {FREE_PLAN.priceLabel}</strong>
            <p style={{ margin: '6px 0 12px', fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary, #b8b4c2)' }}>
              Crie seus carrosséis à mão: textos, layout, estilos, suas fotos e exportação. Sem IA e sem imagem gerada. Até {FREE_PLAN.projectLimit} projetos, guardados neste aparelho.
            </p>
            <button type="button" onClick={onRegister} className="vc-btn vc-btn-primary" style={{ width: '100%', minHeight: 48 }}>
              Começar grátis
            </button>
          </section>
        )}

        {onManageBilling && (
          <section aria-label="Assinatura da sua conta" style={{ marginBottom: 20, padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.16)' }}>
            <p role="status" style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5 }}>
              {loginHint || 'Confira sua assinatura e as opções de pagamento no portal do cliente.'}
            </p>
            <button type="button" onClick={manageBilling} disabled={portalLoading} className="vc-btn vc-btn-primary" style={{ width: '100%', minHeight: 44 }}>
              {portalLoading ? 'Abrindo portal…' : 'Abrir portal do cliente'}
            </button>
            {portalError && <p role="alert" style={{ margin: '12px 0 0', fontSize: 13, color: '#ff8fab' }}>{portalError}</p>}
          </section>
        )}

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
                  border: selected ? '1.5px solid var(--accent, #5b53e8)' : '1px solid rgba(255,255,255,0.12)',
                  background: selected ? 'rgba(91,83,232,0.14)' : 'rgba(255,255,255,0.03)',
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
          <label htmlFor="vc-paywall-email" style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 600 }}>
            {freeAccount ? 'E-mail da sua conta' : 'E-mail'}
          </label>
          <input
            id="vc-paywall-email"
            type="email"
            required
            readOnly={freeAccount && !!initialEmail}
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
          {error && !(onManageBilling && error === loginHint) && (
            <p role="alert" style={{ margin: '0 0 12px', fontSize: 13, color: '#ff8fab' }}>{error}</p>
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
            {freeAccount ? 'Assinar' : 'Continuar'} · {plan.priceLabel}/mês
          </button>
        </form>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {freeAccount && onContinueFree && (
            <button type="button" onClick={onContinueFree} className="vc-btn vc-btn-ghost" style={{ minHeight: 48 }}>
              Continuar no plano grátis
            </button>
          )}
          {!freeAccount && <GoogleSignInButton />}
          {onLogin && <button type="button" onClick={onLogin} style={{
            minHeight: 44,
            borderRadius: 9999,
            border: '1px solid rgba(255,255,255,0.22)',
            background: 'transparent',
            color: 'var(--text-primary, #fff)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 13,
          }}>Entrar com senha</button>}
          {onRegister && <button type="button" className="vc-btn vc-btn-ghost" onClick={onRegister}>Criar conta</button>}
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
