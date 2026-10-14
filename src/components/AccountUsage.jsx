import React, { useRef, useState } from 'react';
import { ArrowUpRight, CalendarDays, Check, Image as ImageIcon, Info, KeyRound, RefreshCw } from 'lucide-react';
import { normalizeAccountUsage } from '../utils/account-usage.js';

const panelStyle = {
  border: '1px solid var(--border)',
  borderRadius: 18,
  background: 'var(--bg-card)',
  minWidth: 0,
};

const buttonStyle = {
  minHeight: 40,
  padding: '10px 15px',
  borderRadius: 9999,
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const formatCount = (value) => (value === null ? '—' : value.toLocaleString('pt-BR'));
const formatDate = (value) => new Date(value).toLocaleDateString('pt-BR', {
  day: 'numeric', month: 'short', year: 'numeric',
});

function UsageMetric({ label, value, description, prominent = false, isMobile }) {
  return (
    <div style={{ minWidth: 0, padding: isMobile ? '14px 16px' : '20px 22px', background: prominent ? 'var(--accent-surface)' : 'var(--bg-pearl)', borderRadius: 12 }}>
      <dt style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</dt>
      <dd style={{ margin: '10px 0 0' }}>
        <span style={{ display: 'block', marginBottom: 5, fontSize: isMobile ? 34 : 44, fontWeight: 600, letterSpacing: '-0.045em', fontFamily: 'var(--font-display)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: prominent ? 'var(--accent)' : 'var(--text-primary)' }}>
          {value === null ? <abbr title="Indisponível" style={{ textDecoration: 'none' }}>—</abbr> : formatCount(value)}
        </span>
        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{description}</span>
      </dd>
    </div>
  );
}

export default function AccountUsage({
  imageQuota = null,
  planTier = null,
  currentPeriodStart = null,
  currentPeriodEnd = null,
  useOwnImageKey = false,
  isMobile = false,
  onRefresh,
  onOpenSettings,
  onManageBilling,
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const refreshInFlight = useRef(false);
  const usage = normalizeAccountUsage({ imageQuota, planTier, currentPeriodStart, currentPeriodEnd });
  // Ciclos que atravessam a correção podem ter contadores legados incompletos.
  const hasLegacyCycle = usage.limit > 0 && usage.periodStart?.slice(0, 10) <= '2026-10-14';
  const padding = isMobile ? 18 : 26;
  const quotaState = usage.noIncludedImages
    ? 'Sem imagens inclusas'
    : !usage.hasUsage
      ? 'Uso indisponível'
      : usage.exhausted ? 'Limite do ciclo atingido' : 'Ciclo em andamento';

  const refresh = async () => {
    if (refreshInFlight.current || typeof onRefresh !== 'function') return;
    refreshInFlight.current = true;
    setRefreshing(true);
    setRefreshMessage('');
    try {
      const result = await onRefresh();
      if (result === null || result === false || result?.status === 'unavailable' || result?.available === false || result?.imageQuota?.status === 'unavailable') {
        setRefreshMessage('O uso está indisponível no momento. Tente atualizar novamente.');
      } else {
        setRefreshMessage('Uso atualizado.');
      }
    } catch {
      setRefreshMessage('Não foi possível atualizar o uso. Tente novamente.');
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: isMobile ? 16 : 22, fontFamily: 'var(--font-ui)', color: 'var(--text-primary)', minWidth: 0 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p className="vc-eyebrow" style={{ margin: '0 0 8px' }}>Uso da conta</p>
          <h2 style={{ margin: 0, fontSize: isMobile ? 26 : 32, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15 }}>Uso de imagens</h2>
          <p style={{ margin: '9px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>Acompanhe as imagens geradas com seu plano no ciclo atual.</p>
        </div>
        <button type="button" onClick={refresh} disabled={refreshing || typeof onRefresh !== 'function'} aria-busy={refreshing} style={{ ...buttonStyle, cursor: refreshing ? 'wait' : typeof onRefresh === 'function' ? 'pointer' : 'default', opacity: typeof onRefresh === 'function' ? 1 : 0.6 }}>
          <RefreshCw size={14} aria-hidden="true" />
          {refreshing ? 'Atualizando…' : 'Atualizar uso'}
        </button>
      </header>

      <div role="status" aria-live="polite" aria-atomic="true" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, ...(refreshMessage ? {} : { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }) }}>
        {refreshMessage}
      </div>

      <section aria-label="Consumo de imagens do plano" style={{ ...panelStyle, padding, display: 'grid', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: 'var(--accent-surface)', color: 'var(--accent)' }}><ImageIcon size={18} aria-hidden="true" /></span>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Imagens do plano</h3>
          </div>
          <span style={{ padding: '6px 11px', border: '1px solid var(--border)', borderRadius: 9999, color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>
            {usage.planName ? `Plano ${usage.planName}` : 'Plano não informado'}
          </span>
        </div>

        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <UsageMetric label="Geradas neste ciclo" value={usage.used} description="Com as imagens inclusas no plano" prominent isMobile={isMobile} />
          <UsageMetric label="Disponíveis" value={usage.remaining} description="Para gerar até o fim deste ciclo" isMobile={isMobile} />
          <UsageMetric label="Total do plano" value={usage.limit} description="Imagens inclusas por ciclo" isMobile={isMobile} />
        </dl>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
            <span style={{ fontWeight: 600 }}>{quotaState}</span>
            {usage.percentage !== null && <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{Math.floor(usage.percentage)}% utilizado</span>}
          </div>
          {usage.percentage !== null ? (
            <div role="progressbar" aria-label="Imagens do plano utilizadas neste ciclo" aria-valuemin={0} aria-valuemax={usage.limit} aria-valuenow={Math.min(usage.used, usage.limit)} aria-valuetext={`${formatCount(usage.used)} de ${formatCount(usage.limit)} imagens utilizadas`} style={{ height: 8, borderRadius: 9999, background: 'var(--bg-pearl)', overflow: 'hidden' }}>
              <div style={{ width: `${usage.percentage}%`, height: '100%', borderRadius: 9999, background: usage.exhausted ? 'var(--text-secondary)' : 'var(--accent)' }} />
            </div>
          ) : null}
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {usage.noIncludedImages
              ? 'Este plano não inclui geração de imagens com IA. Você pode importar suas imagens ou escolher um plano com imagens inclusas.'
              : !usage.hasUsage
                ? 'Não foi possível consultar o consumo deste ciclo. Atualize o uso para tentar novamente.'
                : usage.exhausted
                  ? 'Você utilizou todas as imagens disponíveis neste ciclo. Aguarde a renovação ou consulte as opções do seu plano.'
                  : 'O saldo considera apenas as imagens geradas com o plano e é renovado a cada ciclo.'}
          </p>
          {hasLegacyCycle && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>Neste ciclo, gerações anteriores à correção do contador em 14/10/2026 podem não estar incluídas.</p>}
          {(usage.noIncludedImages || usage.exhausted) && onManageBilling && (
            <div><button type="button" onClick={onManageBilling} style={{ ...buttonStyle, marginTop: 4, background: 'var(--text-primary)', color: 'var(--bg-base)', borderColor: 'transparent' }}>Ver opções do plano <ArrowUpRight size={14} aria-hidden="true" /></button></div>
          )}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: isMobile ? 16 : 18 }}>
        <section style={{ ...panelStyle, padding, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><CalendarDays size={17} aria-hidden="true" style={{ color: 'var(--text-muted)' }} /><h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Período e renovação</h3></div>
          <dl style={{ margin: 0, display: 'grid', gap: 17 }}>
            <div>
              <dt style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Ciclo atual</dt>
              <dd style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
                {usage.periodStart && usage.periodEnd ? <><time dateTime={usage.periodStart}>{formatDate(usage.periodStart)}</time>{' — '}<time dateTime={usage.periodEnd}>{formatDate(usage.periodEnd)}</time></> : usage.periodStart ? <>Desde <time dateTime={usage.periodStart}>{formatDate(usage.periodStart)}</time></> : usage.periodEnd ? <>Até <time dateTime={usage.periodEnd}>{formatDate(usage.periodEnd)}</time></> : 'Período não informado'}
              </dd>
            </div>
            <div>
              <dt style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Renovação do ciclo</dt>
              <dd style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{usage.periodEnd ? <time dateTime={usage.periodEnd}>{formatDate(usage.periodEnd)}</time> : 'Data indisponível'}</dd>
            </div>
          </dl>
          {onManageBilling && <div style={{ marginTop: 'auto', paddingTop: 2 }}><button type="button" onClick={onManageBilling} style={buttonStyle}>Gerenciar assinatura <ArrowUpRight size={13} aria-hidden="true" /></button></div>}
        </section>

        <section style={{ ...panelStyle, padding, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><KeyRound size={17} aria-hidden="true" style={{ color: 'var(--text-muted)' }} /><h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Sua chave de imagem</h3></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: useOwnImageKey ? 'var(--accent)' : 'var(--text-secondary)' }}>
            {useOwnImageKey && <Check size={14} aria-hidden="true" />}
            {useOwnImageKey ? 'Uso com chave própria selecionado' : 'Uso das imagens do plano selecionado'}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>As gerações com sua própria chave não consomem as imagens do plano. O consumo e a cobrança ficam no provedor da chave e não aparecem neste contador.</p>
          {onOpenSettings && <div style={{ marginTop: 'auto', paddingTop: 2 }}><button type="button" onClick={onOpenSettings} style={buttonStyle}>{useOwnImageKey ? 'Gerenciar chave de imagem' : 'Configurar chave própria'} <ArrowUpRight size={13} aria-hidden="true" /></button></div>}
        </section>
      </div>

      <p style={{ margin: 0, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '0 2px', color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.6 }}><Info size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />Este resumo mostra apenas o ciclo atual. O histórico de ciclos anteriores não está disponível.</p>
    </div>
  );
}
