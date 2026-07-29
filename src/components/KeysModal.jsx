import { useEffect, useMemo, useState } from 'react';
import {
  Check, ChevronRight, ExternalLink, Image, KeyRound, Lock,
  Settings, Sparkles, Type, X,
} from 'lucide-react';
import {
  DEFAULT_AI_SETTINGS,
  IMAGE_PROVIDERS,
  normalizeAISettings,
  TEXT_PROVIDERS,
} from '../config/ai-providers.js';

const PRESETS = [
  {
    id: 'economy',
    name: 'Economizar',
    note: 'Texto grátis + imagem barata',
    textProvider: 'zai',
    textModel: 'glm-4.7-flash',
    imageProvider: 'zai',
    imageModel: 'cogview-4-250304',
  },
  {
    id: 'balanced',
    name: 'Equilíbrio',
    note: 'Boa qualidade com custo menor',
    textProvider: 'openai',
    textModel: 'gpt-5.6-terra',
    imageProvider: 'zai',
    imageModel: 'glm-image',
  },
  {
    id: 'quality',
    name: 'Qualidade',
    note: 'Melhor copy + melhor imagem',
    textProvider: 'anthropic',
    textModel: 'claude-sonnet-5',
    imageProvider: 'openai',
    imageModel: 'gpt-image-2',
  },
];

const TABS = [
  { id: 'setup', label: 'Configuração', icon: Sparkles },
  { id: 'keys', label: 'Chaves', icon: KeyRound },
];

function ProviderCard({ provider, selected, configured, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        minHeight: 82,
        padding: '14px 14px 12px',
        borderRadius: 12,
        border: selected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
        background: selected ? 'var(--accent-surface)' : 'var(--bg-card)',
        color: 'var(--text-primary)',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        position: 'relative',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 14, fontWeight: 600 }}>{provider.name}</strong>
        {selected && <Check size={15} strokeWidth={2.5} />}
      </span>
      <span style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--text-muted)' }}>
        {provider.short}
      </span>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        marginTop: 'auto',
        fontSize: 10,
        color: configured ? 'var(--success)' : 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: configured ? 'var(--success)' : 'var(--hairline)',
        }} />
        {configured ? 'Conectado' : 'Falta chave'}
      </span>
    </button>
  );
}

function ModelSelect({ provider, value, onChange }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {provider.models.map((model) => {
        const selected = value === model.id;
        return (
          <button
            key={model.id}
            type="button"
            onClick={() => onChange(model.id)}
            aria-pressed={selected}
            style={{
              width: '100%',
              minHeight: 52,
              padding: '10px 12px',
              borderRadius: 10,
              border: selected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: selected ? 'var(--accent-surface)' : 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              textAlign: 'left',
              fontFamily: 'var(--font-ui)',
            }}
          >
            <span>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{model.name}</span>
              <span style={{ display: 'block', marginTop: 2, fontSize: 10, color: 'var(--text-muted)' }}>
                {model.id}
              </span>
            </span>
            <span style={{
              flexShrink: 0,
              padding: '4px 7px',
              borderRadius: 9999,
              background: model.tier === 'free' ? 'var(--success-surface)' : 'var(--bg-pearl)',
              color: model.tier === 'free' ? 'var(--success)' : 'var(--text-muted)',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
            }}>
              {model.note}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function KeysModal({
  open,
  onClose,
  aiSettings = DEFAULT_AI_SETTINGS,
  onSaveSettings,
}) {
  const [draft, setDraft] = useState(() => normalizeAISettings(aiSettings));
  const [tab, setTab] = useState('setup');
  const [section, setSection] = useState('text');

  useEffect(() => {
    if (!open) return;
    setDraft(normalizeAISettings(aiSettings));
    setTab('setup');
  }, [open, aiSettings]);

  const requiredKeys = useMemo(
    () => new Set([draft.textProvider, IMAGE_PROVIDERS[draft.imageProvider]?.keyProvider]),
    [draft.textProvider, draft.imageProvider],
  );

  if (!open) return null;

  const setTextProvider = (id) => setDraft((current) => ({ ...current, textProvider: id }));
  const setImageProvider = (id) => setDraft((current) => ({ ...current, imageProvider: id }));
  const setTextModel = (id) => setDraft((current) => ({
    ...current,
    textModels: { ...current.textModels, [current.textProvider]: id },
  }));
  const setImageModel = (id) => setDraft((current) => ({
    ...current,
    imageModels: { ...current.imageModels, [current.imageProvider]: id },
  }));
  const applyPreset = (preset) => setDraft((current) => ({
    ...current,
    textProvider: preset.textProvider,
    imageProvider: preset.imageProvider,
    textModels: { ...current.textModels, [preset.textProvider]: preset.textModel },
    imageModels: { ...current.imageModels, [preset.imageProvider]: preset.imageModel },
  }));
  const save = () => {
    onSaveSettings?.(normalizeAISettings(draft));
    onClose();
  };

  const textProvider = TEXT_PROVIDERS[draft.textProvider];
  const imageProvider = IMAGE_PROVIDERS[draft.imageProvider];
  const ready = [...requiredKeys].every((providerId) => draft.keys[providerId]?.trim());

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-settings-title"
        style={{ maxWidth: 680, width: 'min(680px, calc(100vw - 24px))', maxHeight: 'min(780px, calc(100vh - 24px))' }}
      >
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '18px 20px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 3,
          background: 'var(--bg-sidebar)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              display: 'grid',
              placeItems: 'center',
              border: '1px solid var(--border)',
              background: 'var(--bg-pearl)',
            }}>
              <Settings size={16} />
            </span>
            <div>
              <h2 id="ai-settings-title" style={{
                margin: 0,
                fontSize: 18,
                lineHeight: 1.2,
                fontWeight: 600,
                letterSpacing: '-0.022em',
              }}>
                Configurar IA
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                Escolha quem escreve e quem gera as imagens
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="vc-icon-btn" aria-label="Fechar">
            <X size={17} />
          </button>
        </header>

        <nav style={{
          display: 'flex',
          gap: 4,
          padding: '10px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-sidebar)',
          position: 'sticky',
          top: 73,
          zIndex: 2,
        }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                height: 34,
                padding: '0 12px',
                border: 'none',
                borderRadius: 9999,
                background: tab === id ? 'var(--text-primary)' : 'transparent',
                color: tab === id ? 'var(--bg-base)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontFamily: 'var(--font-ui)',
              }}
            >
              <Icon size={13} />
              {label}
              {id === 'keys' && (
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: ready ? 'var(--success)' : '#d97706',
                }} />
              )}
            </button>
          ))}
        </nav>

        <div style={{ padding: 20, overflowY: 'auto' }}>
          {tab === 'setup' ? (
            <div style={{ display: 'grid', gap: 24 }}>
              <section>
                <div style={{ marginBottom: 10 }}>
                  <div className="vc-eyebrow">Comece por aqui</div>
                  <h3 style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600 }}>
                    Escolha o que você prioriza
                  </h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                  {PRESETS.map((preset) => {
                    const selected =
                      draft.textProvider === preset.textProvider &&
                      draft.textModels[preset.textProvider] === preset.textModel &&
                      draft.imageProvider === preset.imageProvider &&
                      draft.imageModels[preset.imageProvider] === preset.imageModel;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        style={{
                          padding: '13px 14px',
                          borderRadius: 12,
                          border: selected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                          background: selected ? 'var(--accent-surface)' : 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'var(--font-ui)',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <strong style={{ fontSize: 13, fontWeight: 600 }}>{preset.name}</strong>
                          {selected && <Check size={14} />}
                        </span>
                        <span style={{ display: 'block', marginTop: 5, fontSize: 10, lineHeight: 1.35, color: 'var(--text-muted)' }}>
                          {preset.note}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <div style={{
                  display: 'flex',
                  gap: 4,
                  padding: 4,
                  borderRadius: 12,
                  background: 'var(--bg-pearl)',
                  marginBottom: 14,
                }}>
                  {[
                    { id: 'text', label: 'Texto', icon: Type },
                    { id: 'image', label: 'Imagens', icon: Image },
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSection(id)}
                      style={{
                        flex: 1,
                        height: 36,
                        border: 'none',
                        borderRadius: 8,
                        background: section === id ? 'var(--bg-card)' : 'transparent',
                        color: 'var(--text-primary)',
                        boxShadow: section === id ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 7,
                        fontFamily: 'var(--font-ui)',
                      }}
                    >
                      <Icon size={14} />
                      {label}
                    </button>
                  ))}
                </div>

                {section === 'text' ? (
                  <div style={{ display: 'grid', gap: 16 }}>
                    <div>
                      <div className="vc-label" style={{ marginBottom: 8 }}>1. Provedor de texto</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                        {Object.values(TEXT_PROVIDERS).map((provider) => (
                          <ProviderCard
                            key={provider.id}
                            provider={provider}
                            selected={provider.id === draft.textProvider}
                            configured={Boolean(draft.keys[provider.id]?.trim())}
                            onClick={() => setTextProvider(provider.id)}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="vc-label" style={{ marginBottom: 8 }}>2. Modelo</div>
                      <ModelSelect
                        provider={textProvider}
                        value={draft.textModels[draft.textProvider]}
                        onChange={setTextModel}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 16 }}>
                    <div>
                      <div className="vc-label" style={{ marginBottom: 8 }}>1. Provedor de imagem</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                        {Object.values(IMAGE_PROVIDERS).map((provider) => (
                          <ProviderCard
                            key={provider.id}
                            provider={provider}
                            selected={provider.id === draft.imageProvider}
                            configured={Boolean(draft.keys[provider.keyProvider]?.trim())}
                            onClick={() => setImageProvider(provider.id)}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="vc-label" style={{ marginBottom: 8 }}>2. Modelo</div>
                      <ModelSelect
                        provider={imageProvider}
                        value={draft.imageModels[draft.imageProvider]}
                        onChange={setImageModel}
                      />
                    </div>
                  </div>
                )}
              </section>

              <button
                type="button"
                onClick={() => setTab('keys')}
                style={{
                  minHeight: 48,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  textAlign: 'left',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <span>
                  <strong style={{ display: 'block', fontSize: 12, fontWeight: 600 }}>
                    {ready ? 'Chaves necessárias conectadas' : 'Agora conecte as chaves'}
                  </strong>
                  <span style={{ display: 'block', marginTop: 2, fontSize: 10, color: 'var(--text-muted)' }}>
                    Só pedimos as chaves usadas na configuração
                  </span>
                </span>
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <div className="vc-eyebrow">Conexões</div>
                <h3 style={{ margin: '4px 0 6px', fontSize: 15, fontWeight: 600 }}>
                  Cole apenas as chaves que vai usar
                </h3>
                <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                  Necessárias agora: {[...requiredKeys].map((id) => TEXT_PROVIDERS[id]?.name).filter(Boolean).join(' + ')}.
                </p>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                {Object.values(TEXT_PROVIDERS).map((provider) => {
                  const required = requiredKeys.has(provider.id);
                  return (
                    <div
                      key={provider.id}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        border: required ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        background: required ? 'var(--accent-surface)' : 'var(--bg-card)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
                        <label htmlFor={`key-${provider.id}`} style={{ fontSize: 13, fontWeight: 600 }}>
                          {provider.name}
                          {required && <span style={{ marginLeft: 7, fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>EM USO</span>}
                        </label>
                        <a
                          href={provider.keyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 10, textDecoration: 'none' }}
                        >
                          Criar chave <ExternalLink size={10} />
                        </a>
                      </div>
                      <input
                        id={`key-${provider.id}`}
                        type="password"
                        value={draft.keys[provider.id] || ''}
                        onChange={(event) => setDraft((current) => ({
                          ...current,
                          keys: { ...current.keys, [provider.id]: event.target.value },
                        }))}
                        placeholder={provider.placeholder}
                        className="vc-input"
                        autoComplete="off"
                      />
                    </div>
                  );
                })}
              </div>

              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--bg-pearl)',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={draft.persistKeys}
                  onChange={(event) => setDraft((current) => ({ ...current, persistKeys: event.target.checked }))}
                  style={{ marginTop: 2, accentColor: 'var(--accent)' }}
                />
                <span>
                  <strong style={{ display: 'block', fontSize: 12, fontWeight: 600 }}>
                    Manter chaves neste navegador
                  </strong>
                  <span style={{ display: 'block', marginTop: 3, fontSize: 10, lineHeight: 1.45, color: 'var(--text-muted)' }}>
                    Desmarcado: somem ao fechar a aba. Marcado: ficam no armazenamento local deste navegador.
                  </span>
                </span>
              </label>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: 'var(--text-muted)', fontSize: 10, lineHeight: 1.5 }}>
                <Lock size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>As chaves não entram na nossa base de dados. Elas só são enviadas ao provedor escolhido durante a geração.</span>
              </div>
            </div>
          )}
        </div>

        <footer style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-sidebar)',
          position: 'sticky',
          bottom: 0,
          zIndex: 3,
        }}>
          <span style={{ fontSize: 10, color: ready ? 'var(--success)' : 'var(--text-muted)' }}>
            {ready ? 'Tudo pronto para gerar' : 'Configure as chaves marcadas “em uso”'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} className="vc-btn vc-btn-ghost" style={{ height: 40, padding: '0 16px' }}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!ready}
              className="vc-btn"
              style={{
                height: 40,
                padding: '0 20px',
                borderRadius: 9999,
                border: 'none',
                background: 'var(--text-primary)',
                color: 'var(--bg-base)',
                opacity: ready ? 1 : 0.42,
                cursor: ready ? 'pointer' : 'not-allowed',
                fontWeight: 600,
              }}
            >
              Salvar configuração
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
