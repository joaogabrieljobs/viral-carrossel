/**
 * Console admin do Moont (docs/product/console-admin.md).
 * Seis abas: Início, Contas, Isenções, Moderação, Saúde, Trilha.
 * Número que a fonte não entregou aparece como "—" com o motivo, nunca como 0.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import {
  adminAccount, adminAccounts, adminActions, adminChallenge, adminGrant, adminGrants, adminHealth, adminOverview, adminRevoke,
} from '../lib/admin-client.js';
import { ModerationQueue } from '../components/TemplateGalleryModal.jsx';

const TABS = [
  ['home', 'Início'], ['accounts', 'Contas'], ['grants', 'Isenções'], ['moderation', 'Moderação'], ['health', 'Saúde'], ['audit', 'Trilha'],
];
const TIER_LABEL = { essential: 'Essencial', creator: 'Criador', pro: 'Pro', max: 'Max', free: 'Grátis' };
const ACTION_LABEL = { view_account: 'Abriu a ficha', grant_exemption: 'Concedeu isenção', revoke_exemption: 'Revogou isenção' };

const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, minWidth: 0 };
const muted = { color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 };
const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));

function useWide() {
  const query = '(min-width: 900px)';
  const [wide, setWide] = useState(() => (typeof window === 'undefined' ? true : window.matchMedia(query).matches));
  useEffect(() => {
    const media = window.matchMedia(query);
    const on = () => setWide(media.matches);
    media.addEventListener('change', on);
    return () => media.removeEventListener('change', on);
  }, []);
  return wide;
}

function useLoad(loader, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try { setState({ loading: false, data: await loader(), error: '' }); }
    catch (error) { setState({ loading: false, data: null, error: error.message }); }
  }, deps);
  useEffect(() => { load(); }, [load]);
  return [state, load];
}

function Loading({ state, children }) {
  if (state.loading && !state.data) return <p role="status" style={muted}>Carregando…</p>;
  if (state.error) return <p role="alert" style={{ margin: 0 }}>{state.error}</p>;
  return children(state.data);
}

/** Um número com a fonte. `metric` é { value, source, reason? }. */
function Metric({ label, metric, pick, hint }) {
  const value = metric?.value == null ? null : pick(metric.value);
  return (
    <div style={card}>
      <div style={{ ...muted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 650, letterSpacing: '-0.03em', margin: '6px 0 4px', fontVariantNumeric: 'tabular-nums' }}>
        {value == null ? <abbr title={metric?.reason || 'Indisponível'} style={{ textDecoration: 'none' }}>—</abbr> : value}
      </div>
      <div style={muted}>{value == null && metric?.reason ? `${metric.reason} ` : ''}{hint ? `${hint} · ` : ''}Fonte: {metric?.source || '—'}</div>
    </div>
  );
}

function Home() {
  const [state, reload] = useLoad(adminOverview);
  return (
    <Section title="Início" onReload={reload} loading={state.loading}>
      <Loading state={state}>{(d) => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Metric label="Contas" metric={d.accounts} pick={(v) => fmt(v.total)} hint={d.accounts?.value ? `${fmt(d.accounts.value.last7)} em 7 dias, ${fmt(d.accounts.value.last30)} em 30` : ''} />
          <Metric label="Assinaturas ativas" metric={d.subscriptions} pick={(v) => fmt(v.total)}
            hint={d.subscriptions?.value ? Object.entries(d.subscriptions.value.byTier).map(([t, n]) => `${TIER_LABEL[t] || t} ${n}`).join(', ') : ''} />
          <Metric label="Isenções ativas" metric={d.exempt} pick={(v) => fmt(v.active)} hint={d.exempt?.value ? `${fmt(d.exempt.value.unlimited)} sem limite` : ''} />
          <Metric label="Imagens geradas (30 dias)" metric={d.images} pick={(v) => fmt(v.last30)} hint={d.images?.value ? `${fmt(d.images.value.last7)} em 7 dias` : ''} />
          <Metric label="Gerações devolvidas (7 dias)" metric={d.failures} pick={(v) => fmt(v.refunded7)} hint="Crédito devolvido por falha" />
          <Metric label="Modelos para moderar" metric={d.templates} pick={(v) => fmt(v.pendingModeration)} hint={d.templates?.value ? `${fmt(d.templates.value.published)} na galeria` : ''} />
        </div>
      )}</Loading>
    </Section>
  );
}

function Section({ title, children, onReload, loading, actions }) {
  return (
    <section aria-label={title} style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 650 }}>{title}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {actions}
          {onReload && (
            <button type="button" className="vc-btn vc-btn-ghost" onClick={onReload} disabled={loading} style={{ minHeight: 40 }}>
              <RefreshCw size={14} aria-hidden="true" /> Atualizar
            </button>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Tabela no computador, cards empilhados no celular. */
function Rows({ wide, columns, rows, label, onOpen }) {
  if (!rows.length) return <p style={muted}>Nada por aqui.</p>;
  if (wide) {
    return (
      <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
        <table aria-label={label} style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>{columns.map(([key, title]) => <th key={key} scope="col" style={{ textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid var(--border)', ...muted, fontWeight: 600 }}>{title}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.key || i}>
                {columns.map(([key], c) => (
                  <td key={key} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                    {c === 0 && onOpen ? <button type="button" onClick={() => onOpen(row)} style={{ background: 'none', border: 0, padding: 0, color: 'var(--accent)', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>{row[key]}</button> : row[key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <ul aria-label={label} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
      {rows.map((row, i) => (
        <li key={row.key || i} style={{ ...card, display: 'grid', gap: 4 }}>
          {onOpen
            ? <button type="button" onClick={() => onOpen(row)} style={{ background: 'none', border: 0, padding: 0, color: 'var(--accent)', cursor: 'pointer', font: 'inherit', textAlign: 'left', fontWeight: 600, minHeight: 32 }}>{row[columns[0][0]]}</button>
            : <strong>{row[columns[0][0]]}</strong>}
          {columns.slice(1).map(([key, title]) => <div key={key} style={{ fontSize: 13 }}><span style={muted}>{title}: </span>{row[key]}</div>)}
        </li>
      ))}
    </ul>
  );
}

function Accounts({ wide, openAccount }) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState({ q: '', page: 1 });
  const [state] = useLoad(() => adminAccounts(search.q, search.page), [search.q, search.page]);
  return (
    <Section title="Contas">
      <form role="search" onSubmit={(e) => { e.preventDefault(); setSearch({ q: query.trim(), page: 1 }); }} style={{ display: 'flex', gap: 8 }}>
        <label htmlFor="admin-busca" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>Buscar por e-mail ou cliente Stripe</label>
        <input id="admin-busca" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="E-mail ou cus_…" className="vc-input"
          style={{ flex: 1, minWidth: 0, minHeight: 44, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-pearl)', color: 'var(--text-primary)' }} />
        <button type="submit" className="vc-btn vc-btn-primary" style={{ minHeight: 44 }}><Search size={14} aria-hidden="true" /> Buscar</button>
      </form>
      <Loading state={state}>{(d) => (
        <>
          <Rows wide={wide} label="Contas encontradas" onOpen={(row) => openAccount(row.id)}
            columns={[['email', 'E-mail'], ['created', 'Criada em'], ['access', 'Acesso'], ['providers', 'Entrada']]}
            rows={d.accounts.map((a) => ({ key: a.id, id: a.id, email: a.email || a.customerId || a.id, created: data(a.createdAt),
              access: a.exempt ? 'Isenta' : a.customerId ? 'Cliente Stripe' : 'Sem cliente', providers: a.providers.map((p) => (p === 'google' ? 'Google' : 'Senha')).join(', ') || '—' }))} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {search.page > 1 && <button type="button" className="vc-btn vc-btn-ghost" style={{ minHeight: 40 }} onClick={() => setSearch((s) => ({ ...s, page: s.page - 1 }))}>Anterior</button>}
            {d.hasMore && <button type="button" className="vc-btn vc-btn-ghost" style={{ minHeight: 40 }} onClick={() => setSearch((s) => ({ ...s, page: s.page + 1 }))}>Próxima</button>}
          </div>
        </>
      )}</Loading>
    </Section>
  );
}

function grantLabel(g) {
  return `${TIER_LABEL[g.tier] || g.tier}${g.unlimitedImages ? ' · sem limite de imagens' : ''}`;
}

/** Fluxo em dois passos: pedir código (vai ao seu e-mail) e confirmar com ele. */
function RiskyAction({ intent, payload, label, onDone, disabled }) {
  const [step, setStep] = useState('idle');
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const ask = async () => {
    setError('');
    setStep('sending');
    try { setChallenge(await adminChallenge(intent, payload)); setStep('code'); }
    catch (e) { setError(e.message); setStep('idle'); }
  };
  const confirm = async (e) => {
    e.preventDefault();
    setError('');
    setStep('confirming');
    try {
      const input = { ...payload, challengeId: challenge.challengeId, code: code.trim() };
      await (intent === 'grant' ? adminGrant(input) : adminRevoke(input));
      setStep('idle'); setCode(''); setChallenge(null);
      onDone?.();
    } catch (err) { setError(err.message); setStep('code'); }
  };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {step !== 'code' && step !== 'confirming' && (
        <div><button type="button" className={intent === 'grant' ? 'vc-btn vc-btn-primary' : 'vc-btn vc-btn-ghost'} style={{ minHeight: 44 }} disabled={disabled || step === 'sending'} onClick={ask}>
          {step === 'sending' ? 'Enviando código…' : label}
        </button></div>
      )}
      {(step === 'code' || step === 'confirming') && (
        <form onSubmit={confirm} style={{ display: 'grid', gap: 8 }} aria-label="Confirmar com o código">
          <p role="status" style={{ margin: 0, fontSize: 13 }}>Enviamos um código para {challenge?.sentTo}. Ele vale {challenge?.expiresInMinutes} minutos e só serve para esta ação.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label htmlFor={`codigo-${intent}`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>Código de 6 dígitos</label>
            <input id={`codigo-${intent}`} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000"
              style={{ width: 130, minHeight: 44, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-pearl)', color: 'var(--text-primary)', letterSpacing: '0.2em', fontVariantNumeric: 'tabular-nums' }} />
            <button type="submit" className="vc-btn vc-btn-primary" style={{ minHeight: 44 }} disabled={code.length !== 6 || step === 'confirming'}>{step === 'confirming' ? 'Confirmando…' : 'Confirmar'}</button>
            <button type="button" className="vc-btn vc-btn-ghost" style={{ minHeight: 44 }} onClick={() => { setStep('idle'); setCode(''); setChallenge(null); }}>Cancelar</button>
          </div>
        </form>
      )}
      {error && <p role="alert" style={{ margin: 0, color: 'var(--danger, #d95c5c)', fontSize: 13 }}>{error}</p>}
    </div>
  );
}

function GrantForm({ accountId, onDone }) {
  const [tier, setTier] = useState('max');
  const [unlimited, setUnlimited] = useState(false);
  const [reason, setReason] = useState('');
  const payload = { accountId, tier, unlimitedImages: unlimited, reason: reason.trim() };
  return (
    <fieldset style={{ ...card, display: 'grid', gap: 10, margin: 0 }}>
      <legend style={{ fontWeight: 650, padding: '0 6px' }}>Conceder isenção</legend>
      <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Plano
        <select value={tier} onChange={(e) => setTier(e.target.value)} style={{ minHeight: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-pearl)', color: 'var(--text-primary)', padding: '0 10px' }}>
          {['essential', 'creator', 'pro', 'max'].map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, minHeight: 32 }}>
        <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} /> Sem limite de imagens (o uso continua contado)
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Motivo (fica na trilha)
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
          style={{ minHeight: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-pearl)', color: 'var(--text-primary)', padding: '0 10px' }} />
      </label>
      <RiskyAction intent="grant" payload={payload} label="Pedir código e conceder" disabled={!payload.reason} onDone={onDone} />
    </fieldset>
  );
}

function RevokeForm({ accountId, grant, onDone }) {
  const [reason, setReason] = useState('');
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Motivo para revogar
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
          style={{ minHeight: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-pearl)', color: 'var(--text-primary)', padding: '0 10px' }} />
      </label>
      <RiskyAction intent="revoke" payload={{ accountId, grantId: grant.id, reason: reason.trim() }} label="Pedir código e revogar" disabled={!reason.trim()} onDone={onDone} />
    </div>
  );
}

function AccountDetail({ id, me, back }) {
  const [state, reload] = useLoad(() => adminAccount(id), [id]);
  const isAdmin = me.role === 'admin';
  return (
    <Section title="Ficha da conta" onReload={reload} loading={state.loading}
      actions={<button type="button" className="vc-btn vc-btn-ghost" style={{ minHeight: 40 }} onClick={back}><ArrowLeft size={14} aria-hidden="true" /> Contas</button>}>
      <Loading state={state}>{({ account: a }) => {
        const active = a.grants.find((g) => !g.revokedAt && (!g.expiresAt || new Date(g.expiresAt) > new Date()));
        const sub = a.subscription;
        return (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ ...card, display: 'grid', gap: 6 }}>
              <strong style={{ fontSize: 17, wordBreak: 'break-all' }}>{a.email || '—'}</strong>
              <div style={muted}>Conta {a.id} · criada em {data(a.createdAt)} · {a.customerId || 'sem cliente Stripe'}{a.role ? ` · papel ${a.role}` : ''}</div>
              <div style={{ fontSize: 13 }}>Entrada: {a.identities.map((i) => `${i.provider === 'google' ? 'Google' : 'Senha'} (${i.email || '—'})`).join(', ') || '—'}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div style={card}>
                <div style={{ ...muted, fontWeight: 600 }}>Acesso</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>
                  {active ? `Isenta · ${grantLabel(active)}` : sub.value?.status && sub.value.status !== 'none' ? `Assinatura ${TIER_LABEL[sub.value.tier] || sub.value.tier} (${sub.value.status})` : sub.value?.status === 'none' ? 'Plano grátis' : '—'}
                </div>
                <div style={muted}>{active ? 'Fonte: Banco: isenções' : <>{sub.value?.periodEnd ? `Renova em ${data(sub.value.periodEnd)}${sub.value.cancelAtPeriodEnd ? ' (cancelada no fim do ciclo)' : ''}. ` : ''}{sub.reason ? `${sub.reason} ` : ''}Fonte: {sub.source}</>}</div>
              </div>
              <Metric label="Imagens no ciclo atual" metric={a.quota} pick={(v) => (v[0] ? fmt(v[0].used) : '0')} hint={a.quota.value?.[0] ? `ciclo desde ${data(a.quota.value[0].periodStart)}` : 'sem ciclo registrado'} />
              <Metric label="Projetos na nuvem" metric={a.library} pick={(v) => fmt(v.projectCount)} hint={a.library.value && !a.library.value.updatedAt ? 'nunca sincronizou' : ''} />
              <Metric label="Modelos publicados" metric={a.templates} pick={(v) => fmt(v.active)} hint={a.templates.value ? `${fmt(a.templates.value.removed)} removidos` : ''} />
            </div>
            <div style={{ ...card, display: 'grid', gap: 10 }}>
              <strong>Isenções</strong>
              {a.grants.length ? (
                <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8, fontSize: 13 }}>
                  {a.grants.map((g) => (
                    <li key={g.id}>
                      {grantLabel(g)} · desde {data(g.startsAt)}{g.revokedAt ? ` · revogada em ${data(g.revokedAt)}` : ' · ativa'}
                      <div style={muted}>{g.reason}</div>
                      {isAdmin && g === active && <div style={{ marginTop: 8 }}><RevokeForm accountId={a.id} grant={g} onDone={reload} /></div>}
                    </li>
                  ))}
                </ul>
              ) : <p style={{ ...muted, margin: 0 }}>Nenhuma isenção.</p>}
            </div>
            {isAdmin && !active && a.customerId && <GrantForm accountId={a.id} onDone={reload} />}
            <div style={card}>
              <strong>Últimos avisos do Stripe</strong>
              {a.billingEvents.value == null ? <p style={muted}>— {a.billingEvents.reason}</p> : a.billingEvents.value.length ? (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13 }}>
                  {a.billingEvents.value.map((e, i) => <li key={i}>{dataHora(e.receivedAt)} · {e.type}{e.status ? ` (${e.status})` : ''}</li>)}
                </ul>
              ) : <p style={{ ...muted, margin: '8px 0 0' }}>Nenhum aviso recebido.</p>}
            </div>
            <p style={muted}>Abrir esta ficha ficou registrado na trilha.</p>
          </div>
        );
      }}</Loading>
    </Section>
  );
}

function Grants({ wide, openAccount }) {
  const [all, setAll] = useState(false);
  const [state, reload] = useLoad(() => adminGrants(all).then((r) => r.grants), [all]);
  return (
    <Section title="Isenções" onReload={reload} loading={state.loading}
      actions={<button type="button" className="vc-btn vc-btn-ghost" aria-pressed={all} style={{ minHeight: 40 }} onClick={() => setAll((v) => !v)}>{all ? 'Só ativas' : 'Incluir revogadas'}</button>}>
      <p style={{ ...muted, margin: 0 }}>Para conceder ou revogar, abra a ficha da conta.</p>
      <Loading state={state}>{(grants) => (
        <Rows wide={wide} label="Isenções" onOpen={(row) => openAccount(row.accountId)}
          columns={[['email', 'Conta'], ['plan', 'Plano'], ['since', 'Desde'], ['status', 'Situação'], ['reason', 'Motivo']]}
          rows={grants.map((g) => ({ key: g.id, accountId: g.accountId, email: g.email || g.accountId, plan: grantLabel(g), since: data(g.startsAt),
            status: g.revokedAt ? `Revogada em ${data(g.revokedAt)}` : 'Ativa', reason: g.reason }))} />
      )}</Loading>
    </Section>
  );
}

/** MOO-38: divergência entre o preço da tela e o price do Stripe. */
export function planPriceSummary(v) {
  const divergences = Array.isArray(v?.divergences) ? v.divergences : [];
  const unconfigured = Array.isArray(v?.unconfigured) ? v.unconfigured : [];
  const parts = [
    ...divergences.map((d) => `${d.tier}: ${(d.issues || []).join(' ')}`),
    unconfigured.length ? `sem price: ${unconfigured.join(', ')}` : '',
  ].filter(Boolean);
  return { value: String(divergences.length), hint: parts.length ? parts.join(' · ') : `${v?.checked ?? 0} planos conferidos` };
}

function Health() {
  const [state, reload] = useLoad(adminHealth);
  return (
    <Section title="Saúde" onReload={reload} loading={state.loading}>
      <Loading state={state}>{(d) => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Metric label="Reservas de imagem presas (15 min+)" metric={d.stuckReservations} pick={(v) => fmt(v.count)} hint={d.stuckReservations.value?.oldest ? `mais antiga ${dataHora(d.stuckReservations.value.oldest)}` : ''} />
          <Metric label="Imagens em 24 h" metric={d.images24h} pick={(v) => fmt(v.consumed)} hint={d.images24h.value ? `${fmt(d.images24h.value.refunded)} devolvidas` : ''} />
          <Metric label="Jobs do agente com falha (24 h)" metric={d.agentJobs} pick={(v) => fmt(v.failedByCode.reduce((s, r) => s + r.count, 0))}
            hint={d.agentJobs.value ? [`${fmt(d.agentJobs.value.stuckPending)} pendentes há 15 min+`, ...d.agentJobs.value.failedByCode.map((r) => `${r.code} ${r.count}`)].join(', ') : ''} />
          <Metric label="Avisos do Stripe (24 h)" metric={d.webhooks} pick={(v) => fmt(v.last24h)} hint={d.webhooks.value ? `último ${dataHora(d.webhooks.value.lastReceivedAt)}` : ''} />
          <Metric label="Preço da tela × Stripe (divergências)" metric={d.planPrices} pick={(v) => planPriceSummary(v).value} hint={d.planPrices?.value ? planPriceSummary(d.planPrices.value).hint : ''} />
          <Metric label="Acessos de agente ativos" metric={d.tokens} pick={(v) => fmt(v.agentTokens + v.oauthSessions)} hint={d.tokens.value ? `${fmt(d.tokens.value.agentTokens)} chaves, ${fmt(d.tokens.value.oauthSessions)} conexões MCP` : ''} />
        </div>
      )}</Loading>
    </Section>
  );
}

function Audit({ wide, openAccount }) {
  const [state, reload] = useLoad(() => adminActions().then((r) => r.actions));
  return (
    <Section title="Trilha" onReload={reload} loading={state.loading}>
      <p style={{ ...muted, margin: 0 }}>Últimas 100 ações do console. A trilha não pode ser alterada nem apagada. Decisões de moderação ficam no histórico da moderação.</p>
      <Loading state={state}>{(actions) => (
        <Rows wide={wide} label="Trilha do console"
          columns={[['when', 'Quando'], ['what', 'Ação'], ['who', 'Quem'], ['target', 'Conta'], ['reason', 'Motivo']]}
          rows={actions.map((a) => ({ key: a.id, when: dataHora(a.createdAt), what: ACTION_LABEL[a.action] || a.action, who: `${a.actorId} (${a.actorRole})`,
            target: a.target ? <button type="button" onClick={() => openAccount(a.target)} style={{ background: 'none', border: 0, padding: 0, color: 'var(--accent)', cursor: 'pointer', font: 'inherit' }}>{a.target.slice(0, 8)}…</button> : '—',
            reason: a.reason }))} />
      )}</Loading>
    </Section>
  );
}

export default function AdminConsole({ me }) {
  const wide = useWide();
  const [tab, setTab] = useState('home');
  const [accountId, setAccountId] = useState('');
  const [notice, setNotice] = useState({ text: '', kind: 'success' });
  const toast = useCallback((text, kind = 'success') => setNotice({ text, kind }), []);
  useEffect(() => {
    if (!notice.text) return undefined;
    const timer = setTimeout(() => setNotice({ text: '', kind: 'success' }), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const openAccount = (id) => { setAccountId(id); setTab('accounts'); };
  useEffect(() => { document.title = 'Admin · Moont'; }, []);

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: wide ? '24px 28px 64px' : '14px 16px 48px', display: 'grid', gap: 20 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--accent-surface)', color: 'var(--accent)' }}><ShieldCheck size={18} /></span>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Console admin</h1>
            <div style={muted}>{me.email || 'sem e-mail'} · {me.role === 'admin' ? 'admin' : 'suporte (só consulta)'}</div>
          </div>
        </div>
        <a href="/?app=1" className="vc-btn vc-btn-ghost" style={{ minHeight: 40, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Voltar ao studio</a>
      </header>
      <nav aria-label="Áreas do console" style={{ overflowX: 'auto', margin: wide ? 0 : '0 -16px', padding: wide ? 0 : '0 16px' }}>
        <div role="tablist" aria-label="Áreas do console" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', minWidth: 'max-content' }}>
          {TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); if (id === 'accounts') setAccountId(''); }}
              style={{ minHeight: 44, padding: '0 14px', background: 'none', border: 0, borderBottom: `2px solid ${tab === id ? 'var(--accent)' : 'transparent'}`,
                color: tab === id ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: tab === id ? 650 : 500, cursor: 'pointer', font: 'inherit', fontSize: 14 }}>
              {label}
            </button>
          ))}
        </div>
      </nav>
      <div role="status" aria-live="polite" style={notice.text ? { ...card, padding: '10px 14px', fontSize: 13, color: notice.kind === 'error' ? 'var(--danger, #d95c5c)' : 'var(--text-primary)' } : { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>{notice.text}</div>
      <main role="tabpanel" aria-label={TABS.find(([id]) => id === tab)?.[1]}>
        {tab === 'home' && <Home />}
        {tab === 'accounts' && (accountId ? <AccountDetail id={accountId} me={me} back={() => setAccountId('')} /> : <Accounts wide={wide} openAccount={openAccount} />)}
        {tab === 'grants' && <Grants wide={wide} openAccount={openAccount} />}
        {tab === 'moderation' && <Section title="Moderação de modelos"><ModerationQueue toast={toast} /></Section>}
        {tab === 'health' && <Health />}
        {tab === 'audit' && <Audit wide={wide} openAccount={openAccount} />}
      </main>
    </div>
  );
}
