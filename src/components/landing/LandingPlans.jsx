import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { PLAN_ORDER, PLAN_TIERS } from '../../../shared/plans.js';

export default function LandingPlans({ onEnter, onLogin, isMobile }) {
  return (
    <section id="planos" aria-labelledby="landing-plans-title" style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: isMobile ? '24px 16px 48px' : '32px clamp(24px, 5vw, 48px) 64px' }}>
      <style>{`.vc-landing-plans-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; } @media (max-width: 1050px) { .vc-landing-plans-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } } @media (max-width: 600px) { .vc-landing-plans-grid { grid-template-columns: 1fr; } }`}</style>
      <p style={{ margin: '0 0 8px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Quatro planos. O studio completo.</p>
      <h2 id="landing-plans-title" style={{ margin: '0 0 16px', fontSize: isMobile ? 28 : 36, fontFamily: 'var(--font-display)', letterSpacing: '-0.024em', lineHeight: 1.15 }}>Escolha pelo seu ritmo de criação.</h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '64ch', margin: '0 0 28px', lineHeight: 1.5 }}>Texto com IA incluso em todos os planos. Para gerar imagens sem configurar uma chave própria, escolha Criador, Pro ou Max.</p>
      <div className="vc-landing-plans-grid">
        {PLAN_ORDER.map(id => {
          const plan = PLAN_TIERS[id];
          return <article key={id} aria-label={`Plano ${plan.name}`} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 22, border: `1px solid ${id === 'creator' ? 'var(--accent)' : 'var(--glass-border)'}`, borderRadius: 18, background: id === 'creator' ? 'var(--accent-surface)' : 'var(--bg-secondary)' }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>{plan.name}</h3>
            <p style={{ margin: 0 }}><strong style={{ fontSize: 30, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>{plan.priceLabel}</strong><span style={{ color: 'var(--text-muted)', fontSize: 12 }}> /mês</span></p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, minHeight: 44 }}>{plan.imageQuota ? `${plan.imageQuota} imagens por mês` : 'Sem imagens de IA inclusas'}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
              {['Texto com IA incluso', 'Editor e exportação completos', 'Contexto e logo por projeto', plan.imageQuota ? 'Referências nas imagens do plano' : 'Importação das suas imagens'].map(line => <li key={line} style={{ display: 'flex', gap: 8, lineHeight: 1.45 }}><Check size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 3, color: 'var(--accent)' }} />{line}</li>)}
            </ul>
          </article>;
        })}
      </div>
      <p style={{ margin: '18px 0 24px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>O saldo de imagens renova a cada ciclo mensal da assinatura. A chave própria é opcional; ao usá-la, o provedor cobra as gerações diretamente na sua conta.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <button type="button" className="vc-landing-cta" onClick={onEnter} style={{ minHeight: 48, padding: '12px 24px', display: 'inline-flex', alignItems: 'center', gap: 10, borderRadius: 'var(--radius-pill)', border: 0, background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Escolher meu plano <ArrowRight size={16} aria-hidden="true" /></button>
        {onLogin && <button type="button" onClick={onLogin} style={{ minHeight: 48, padding: '12px 20px', border: '1px solid var(--glass-border-strong)', borderRadius: 'var(--radius-pill)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Já assina? Entrar</button>}
      </div>
    </section>
  );
}
