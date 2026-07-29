import React, { useEffect, useRef, useState } from 'react';
import {
  Camera, CreditCard, Instagram, MapPin, Pencil, Settings, User, X,
} from 'lucide-react';
import {
  DEFAULT_USER_PROFILE,
  loadUserProfile,
  normalizeUserProfile,
  profileDisplayName,
  profileInitials,
  saveUserProfile,
} from '../utils/user-profile.js';
import { TEXT_PROVIDERS, IMAGE_PROVIDERS } from '../config/ai-providers.js';

const SOCIAL_FIELDS = [
  { id: 'instagram', prefix: 'instagram.com/', placeholder: 'seuhandle' },
  { id: 'x', prefix: 'x.com/', placeholder: 'seuhandle' },
  { id: 'youtube', prefix: 'youtube.com/@', placeholder: 'canal' },
  { id: 'tiktok', prefix: 'tiktok.com/@', placeholder: 'seuhandle' },
];

function Avatar({ profile, name, size = 72 }) {
  const initials = profileInitials(name);
  if (profile.avatarDataUrl) {
    return (
      <img
        src={profile.avatarDataUrl}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1px solid var(--border)',
          background: 'var(--bg-pearl)',
        }}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '1px solid var(--border)',
        background: 'var(--accent-surface)',
        color: 'var(--text-primary)',
        display: 'grid',
        placeItems: 'center',
        fontSize: size > 56 ? 22 : 14,
        fontWeight: 600,
        fontFamily: 'var(--font-display)',
      }}
    >
      {initials}
    </div>
  );
}

function EditProfileModal({ open, draft, onChange, onClose, onSave, email }) {
  const fileRef = useRef(null);
  if (!open) return null;

  const setField = (key, value) => onChange({ ...draft, [key]: value });
  const setSocial = (key, value) => onChange({
    ...draft,
    socials: { ...draft.socials, [key]: value },
  });

  const onPickAvatar = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2.5 * 1024 * 1024) {
      window.alert('Use uma imagem até 2,5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ ...draft, avatarDataUrl: String(reader.result || '') });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 12000 }}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 520,
          width: 'min(520px, calc(100vw - 24px))',
          maxHeight: 'min(860px, calc(100vh - 24px))',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '16px 18px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          background: 'var(--bg-sidebar)',
          zIndex: 2,
        }}>
          <h2 id="edit-profile-title" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
            Editar perfil
          </h2>
          <button type="button" className="vc-icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={17} />
          </button>
        </header>

        <div style={{ padding: 18, overflowY: 'auto', display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar profile={draft} name={profileDisplayName(draft, email)} size={72} />
            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 9999,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-pearl)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <Camera size={14} /> Upload
              </button>
              {draft.avatarDataUrl && (
                <button
                  type="button"
                  onClick={() => setField('avatarDataUrl', '')}
                  style={{
                    marginLeft: 8,
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 9999,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Remover
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickAvatar} />
            </div>
          </div>

          <Field label="Nome">
            <input
              className="vc-input"
              value={draft.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Seu nome"
              maxLength={80}
            />
          </Field>

          <Field label="Headline">
            <input
              className="vc-input"
              value={draft.headline}
              onChange={(e) => setField('headline', e.target.value)}
              placeholder="Ex: Criadora de conteúdo · marca pessoal"
              maxLength={120}
            />
          </Field>

          <Field label={`Bio (${draft.bio.length}/300)`}>
            <textarea
              className="vc-input"
              value={draft.bio}
              onChange={(e) => setField('bio', e.target.value.slice(0, 300))}
              placeholder="Conte quem você é e o que publica…"
              rows={4}
              style={{ resize: 'vertical', minHeight: 96, paddingTop: 12, paddingBottom: 12 }}
            />
          </Field>

          <Field label="Localização">
            <input
              className="vc-input"
              value={draft.location}
              onChange={(e) => setField('location', e.target.value)}
              placeholder="Onde você está?"
              maxLength={80}
            />
          </Field>

          <div>
            <div className="vc-label" style={{ marginBottom: 8 }}>Redes</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {SOCIAL_FIELDS.map((social) => (
                <div
                  key={social.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: 'var(--bg-pearl)',
                  }}
                >
                  <span style={{
                    padding: '0 10px',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap',
                  }}>
                    {social.prefix}
                  </span>
                  <input
                    value={draft.socials[social.id] || ''}
                    onChange={(e) => setSocial(social.id, e.target.value.replace(/^@/, ''))}
                    placeholder={social.placeholder}
                    style={{
                      flex: 1,
                      height: 42,
                      border: 'none',
                      outline: 'none',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      padding: '0 12px',
                      fontSize: 13,
                      fontFamily: 'var(--font-ui)',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {email && (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
              E-mail da conta: <strong style={{ color: 'var(--text-secondary)' }}>{email}</strong> (vindo da assinatura)
            </p>
          )}
        </div>

        <footer style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '14px 18px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-sidebar)',
        }}>
          <button type="button" className="vc-btn vc-btn-ghost" onClick={onClose} style={{ height: 40, padding: '0 16px' }}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            style={{
              height: 40,
              padding: '0 18px',
              borderRadius: 9999,
              border: 'none',
              background: 'var(--text-primary)',
              color: 'var(--bg-base)',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            Salvar
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span className="vc-label">{label}</span>
      {children}
    </label>
  );
}

export default function AccountProfile({
  email,
  libraryCount = 0,
  brandCount = 0,
  totalCards = 0,
  aiSettings,
  hasTextAI,
  hasImageAI,
  isMobile,
  onOpenSettings,
  onManageBilling,
  onOpenBrands,
  currentPeriodEnd,
}) {
  const [profile, setProfile] = useState(() => loadUserProfile());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_USER_PROFILE);

  useEffect(() => {
    setProfile(loadUserProfile());
  }, []);

  const name = profileDisplayName(profile, email);
  const textProvider = TEXT_PROVIDERS[aiSettings?.textProvider] || TEXT_PROVIDERS.openai;
  const imageProvider = IMAGE_PROVIDERS[aiSettings?.imageProvider] || IMAGE_PROVIDERS.openai;
  const aiReady = hasTextAI && hasImageAI;

  const openEdit = () => {
    setDraft(normalizeUserProfile(profile));
    setEditing(true);
  };

  const saveEdit = () => {
    const next = saveUserProfile(draft);
    setProfile(next);
    setEditing(false);
  };

  const socialLinks = SOCIAL_FIELDS
    .map((s) => {
      const handle = profile.socials?.[s.id]?.trim();
      if (!handle) return null;
      return { ...s, handle, href: `https://${s.prefix}${handle}` };
    })
    .filter(Boolean);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: isMobile ? 16 : 20,
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <Avatar profile={profile} name={name} size={isMobile ? 64 : 80} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{
                margin: 0,
                fontSize: isMobile ? 22 : 26,
                fontWeight: 600,
                letterSpacing: '-0.024em',
                fontFamily: 'var(--font-display)',
              }}>
                {name}
              </h2>
              <button
                type="button"
                onClick={openEdit}
                aria-label="Editar perfil"
                style={{
                  height: 30,
                  padding: '0 10px',
                  borderRadius: 9999,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-pearl)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                <Pencil size={12} /> Editar
              </button>
            </div>
            {email && (
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{email}</p>
            )}
            {profile.headline && (
              <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {profile.headline}
              </p>
            )}
            {profile.location && (
              <p style={{
                margin: '8px 0 0',
                fontSize: 12,
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}>
                <MapPin size={12} /> {profile.location}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={openEdit}
          style={{
            height: 40,
            padding: '0 16px',
            borderRadius: 9999,
            border: 'none',
            background: 'var(--text-primary)',
            color: 'var(--bg-base)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <User size={14} /> Editar perfil
        </button>
      </header>

      {profile.bio && (
        <section style={{
          padding: 18,
          borderRadius: 16,
          border: '1px solid var(--border)',
          background: 'var(--bg-pearl)',
        }}>
          <div className="vc-eyebrow" style={{ marginBottom: 8 }}>Bio</div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
            {profile.bio}
          </p>
        </section>
      )}

      <section style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.1fr 1fr',
        gap: 12,
      }}>
        <div style={{
          padding: 18,
          borderRadius: 16,
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          display: 'grid',
          gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="vc-eyebrow" style={{ marginBottom: 4 }}>Assinatura</div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Studio Viral.</h3>
            </div>
            <CreditCard size={18} color="var(--text-muted)" />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45 }}>
            Plano individual ativo
            {currentPeriodEnd
              ? ` · renova ${new Date(currentPeriodEnd).toLocaleDateString('pt-BR')}`
              : ''}
          </p>
          {onManageBilling && (
            <button
              type="button"
              onClick={onManageBilling}
              style={{
                height: 40,
                borderRadius: 9999,
                border: '1px solid var(--border)',
                background: 'var(--bg-pearl)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Gerir plano
            </button>
          )}
        </div>

        <div style={{
          padding: 18,
          borderRadius: 16,
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          display: 'grid',
          gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="vc-eyebrow" style={{ marginBottom: 4 }}>IA</div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                {aiReady ? 'Pronta para gerar' : 'Configure as chaves'}
              </h3>
            </div>
            <Settings size={18} color="var(--text-muted)" />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45 }}>
            Texto: {textProvider.name} · Imagens: {imageProvider.name}
          </p>
          <button
            type="button"
            onClick={onOpenSettings}
            style={{
              height: 40,
              borderRadius: 9999,
              border: 'none',
              background: aiReady ? 'var(--bg-pearl)' : 'var(--accent)',
              color: aiReady ? 'var(--text-primary)' : '#fff',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {aiReady ? 'Ajustar IA' : 'Configurar IA'}
          </button>
        </div>
      </section>

      <section style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        gap: 10,
      }}>
        {[
          { label: 'Projetos', value: libraryCount },
          { label: 'Marcas', value: brandCount, action: onOpenBrands },
          { label: 'Cards', value: totalCards },
        ].map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={stat.action}
            disabled={!stat.action}
            style={{
              textAlign: 'left',
              padding: '14px 16px',
              borderRadius: 12,
              border: '1px solid var(--hairline)',
              background: 'var(--bg-pearl)',
              cursor: stat.action ? 'pointer' : 'default',
              color: 'var(--text-primary)',
            }}
          >
            <div style={{
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              marginBottom: 6,
            }}>
              {stat.label}
            </div>
            <div style={{
              fontSize: 26,
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.028em',
            }}>
              {stat.value}
            </div>
          </button>
        ))}
      </section>

      <section style={{
        padding: 18,
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
      }}>
        <div className="vc-eyebrow" style={{ marginBottom: 10 }}>Redes</div>
        {socialLinks.length === 0 ? (
          <div style={{
            padding: '28px 16px',
            textAlign: 'center',
            border: '1px dashed var(--hairline)',
            borderRadius: 12,
            color: 'var(--text-muted)',
          }}>
            <Instagram size={22} style={{ marginBottom: 8, opacity: 0.7 }} />
            <p style={{ margin: '0 0 12px', fontSize: 13 }}>Ainda sem redes no perfil.</p>
            <button
              type="button"
              onClick={openEdit}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 9999,
                border: '1px solid var(--border)',
                background: 'var(--bg-pearl)',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              Adicionar redes
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {socialLinks.map((s) => (
              <a
                key={s.id}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  height: 36,
                  padding: '0 12px',
                  borderRadius: 9999,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-pearl)',
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                @{s.handle}
              </a>
            ))}
          </div>
        )}
      </section>

      <EditProfileModal
        open={editing}
        draft={draft}
        onChange={setDraft}
        onClose={() => setEditing(false)}
        onSave={saveEdit}
        email={email}
      />
    </div>
  );
}
