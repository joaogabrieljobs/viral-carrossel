import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, KeyRound, Link2, Trash2 } from 'lucide-react';
import './AgentAccessPanel.css';

const MCP_URL = 'https://moont.ai/mcp';

async function agentRequest(method, body) {
  const response = await fetch('/api/agent-access', {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível acessar as integrações.');
  return data;
}

const buttonStyle = {
  minHeight: 38,
  borderRadius: 9999,
  padding: '0 15px',
  border: '1px solid var(--border)',
  background: 'var(--bg-pearl)',
  color: 'var(--text-primary)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
};

export default function AgentAccessPanel() {
  const [credentials, setCredentials] = useState([]);
  const [oneTimeToken, setOneTimeToken] = useState('');
  const [label, setLabel] = useState('Assistente de IA');
  const [confirmId, setConfirmId] = useState('');
  const [copied, setCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    agentRequest('GET')
      .then(({ credentials: items }) => {
        if (active) setCredentials(Array.isArray(items) ? items : []);
      })
      .catch((cause) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  async function create() {
    setBusy('create');
    setError('');
    setOneTimeToken('');
    setCopied(false);
    try {
      const result = await agentRequest('POST', {
        label: label.trim() || 'Assistente de IA',
        scopes: ['projects:read', 'projects:write'],
      });
      setOneTimeToken(result.token);
      setCredentials((current) => [result.credential, ...current]);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(''); }
  }

  async function copy(value) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione a chave para copiar.');
    }
  }

  async function revoke(id) {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setBusy(id);
    setError('');
    try {
      await agentRequest('DELETE', { id });
      setCredentials((current) => current.map((item) => (
        item.id === id ? { ...item, revokedAt: new Date().toISOString() } : item
      )));
      setOneTimeToken('');
      setConfirmId('');
    } catch (cause) { setError(cause.message); }
    finally { setBusy(''); }
  }

  const visibleTokens = credentials.filter((item) => !item.revokedAt && !item.invalidated);

  function expiryNote(iso) {
    const ms = Date.parse(iso) - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) {
      return 'Vencida. Crie outra chave aqui e cole no plugin.';
    }
    const days = Math.ceil(ms / 86_400_000);
    if (days <= 7) return `Vence em ${days} dia(s). Crie uma nova chave antes que a atual pare de funcionar.`;
    return `Vence em ${new Date(iso).toLocaleDateString('pt-BR')}`;
  }

  return (
    <section className="moont-integrations">
      <div className="moont-integrations__hero">
        <div className="moont-integrations__head">
          <div>
            <div className="moont-integrations__eyebrow">Integrações de IA</div>
            <h3>Leve o Moont para o seu assistente</h3>
          </div>
          <KeyRound size={20} color="rgba(255,255,255,.7)" aria-hidden />
        </div>
        <p className="moont-integrations__lead">
          Conecte sua conta para criar, revisar e organizar projetos sem sair do Claude, ChatGPT ou Codex. Você controla as permissões e pode encerrar cada acesso quando quiser.
        </p>
        <div className="moont-integrations__providers" aria-label="Assistentes compatíveis">
          {[
            { mark: 'C', name: 'Claude', note: 'OAuth · conexão recomendada' },
            { mark: '✦', name: 'ChatGPT', note: 'OAuth · conector MCP' },
            { mark: '⌘', name: 'Codex', note: 'OAuth ou chave manual' },
          ].map((provider) => (
            <div key={provider.name} className="moont-integrations__provider">
              <div className="moont-integrations__provider-top"><span className="moont-integrations__provider-mark">{provider.mark}</span><strong>{provider.name}</strong></div>
              <span>{provider.note}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="moont-integrations__card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <strong style={{ fontSize: 13 }}>Endereço do MCP</strong>
            <div style={{ marginTop: 3, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{MCP_URL}</div>
          </div>
          <button type="button" style={buttonStyle} onClick={() => navigator.clipboard.writeText(MCP_URL).then(() => setUrlCopied(true)).catch(() => setError('Não foi possível copiar o endereço.'))}>
            {urlCopied ? <Check size={14} aria-hidden /> : <Link2 size={14} aria-hidden />}
            {urlCopied ? 'Copiado' : 'Copiar endereço'}
          </button>
        </div>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.45 }}>
          Use este mesmo endereço no Claude, ChatGPT ou outro cliente MCP. Escolha OAuth quando essa opção aparecer: o login, as permissões e a renovação da conexão acontecem com segurança no Moont.
        </p>
      </div>

      <div className="moont-integrations__card moont-integrations__card--accent">
        <div>
          <strong style={{ fontSize: 13 }}>Conectar no Claude</strong>
          <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
            No Claude, abra Configurações → Conectores → Adicionar conector personalizado. Dê o nome “Moont”, cole o endereço acima e clique em Conectar. O Claude abrirá o Moont para você entrar e autorizar a conta.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="https://claude.ai/settings/connectors" target="_blank" rel="noopener noreferrer" style={{ ...buttonStyle, textDecoration: 'none', background: 'var(--text-primary)', color: 'var(--bg-base)', borderColor: 'transparent' }}>
            <ExternalLink size={14} aria-hidden /> Abrir conectores do Claude
          </a>
          <button type="button" style={buttonStyle} onClick={() => navigator.clipboard.writeText(MCP_URL).then(() => setUrlCopied(true)).catch(() => setError('Não foi possível copiar o endereço.'))}>
            {urlCopied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            {urlCopied ? 'Endereço copiado' : 'Copiar para o Claude'}
          </button>
        </div>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.45 }}>
          Disponível no Claude e Claude Desktop para contas Pro, Max, Team e Enterprise. Em contas Team ou Enterprise, um administrador precisa liberar o conector da organização.
        </p>
      </div>

      <div className="vc-eyebrow">Opção avançada · chave manual</div>
      <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 600 }}>
        Nome da conexão
        <input
          aria-label="Nome da chave de integração"
          value={label}
          onChange={(event) => setLabel(event.target.value.slice(0, 40))}
          style={{ minHeight: 38, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 480 }}
        />
      </label>
      <div>
        <button type="button" style={{ ...buttonStyle, background: 'var(--text-primary)', color: 'var(--bg-base)', borderColor: 'transparent' }} disabled={!!busy} onClick={create}>
          <KeyRound size={14} aria-hidden /> {busy === 'create' ? 'Criando…' : 'Criar chave Bearer'}
        </button>
      </div>

      {oneTimeToken && (
        <div style={{ display: 'grid', gap: 9, padding: 14, border: '1px solid var(--accent)', borderRadius: 12, background: 'var(--accent-surface)' }}>
          <strong style={{ fontSize: 13 }}>Copie esta chave agora</strong>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
            Por segurança, ela só aparece uma vez. Use como Bearer token na configuração privada do cliente MCP e não cole a chave em conversas. No plugin local do Codex, você também pode usar o instalador do Moont. Ela vence em 90 dias.
          </p>
          <input
            aria-label="Chave de integração Moont, exibida uma única vez"
            value={oneTimeToken}
            readOnly
            onFocus={(event) => event.target.select()}
            autoComplete="off"
            spellCheck={false}
            style={{ minWidth: 0, width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={buttonStyle} onClick={() => copy(oneTimeToken)}>
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              {copied ? 'Chave copiada' : 'Copiar chave'}
            </button>
            <button type="button" style={buttonStyle} onClick={() => setOneTimeToken('')}>Já guardei</button>
          </div>
        </div>
      )}

      {error && <p role="alert" style={{ margin: 0, color: 'var(--danger, #e34a42)', fontSize: 12 }}>{error}</p>}

      {loaded && visibleTokens.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="vc-eyebrow">Chaves</div>
          {visibleTokens.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-pearl)' }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 13 }}>{item.label || 'Assistente de IA'}</strong>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{expiryNote(item.expiresAt)}</div>
              </div>
              <button type="button" onClick={() => revoke(item.id)} disabled={!!busy} aria-label={confirmId === item.id ? `Confirmar revogação da chave ${item.label}` : `Revogar chave ${item.label}`} style={{ ...buttonStyle, minHeight: 34, padding: '0 10px', color: 'var(--danger, #e34a42)' }}>
                <Trash2 size={13} aria-hidden /> {busy === item.id ? 'Revogando…' : confirmId === item.id ? 'Confirmar' : 'Revogar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
