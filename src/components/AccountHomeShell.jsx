// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useState, useMemo } from 'react';
import { Sparkles, Download, Trash2, Copy, Plus, Layout, TrendingUp, X, Flame, ChevronRight, Settings, Layers, User } from 'lucide-react';
import AccountProfile from './AccountProfile.jsx';
import { resolveSlideBrandBg } from '../utils/brand-helpers.js';
import { STATUS_DEFS, fmtDate } from '../utils/library-helpers.js';
import { DEFAULT_AI_SETTINGS, IMAGE_PROVIDERS, TEXT_PROVIDERS } from '../config/ai-providers.js';

// ─── ACCOUNT HOME — visão da conta + lista de projetos (antes do editor) ─────
function AccountHomeShell({
  library,
  activeDocId,
  activeEntryName,
  brandCount,
  aiSettings = DEFAULT_AI_SETTINGS,
  hasTextAI,
  hasImageAI,
  isMobile,
  onGenerate,
  onOpenLibrary,
  onOpenTemplates,
  onOpenResearch,
  onOpenHelp,
  onOpenSettings,
  onContinueEditor,
  openDoc,
  newDoc,
  renameDoc,
  duplicateDoc,
  deleteDoc,
  setDocStatus,
  exportDoc,
  askPrompt,
  onManageBilling,
  onLogout,
  onOpenBrands,
  accessEmail,
  currentPeriodEnd,
  accountTab = 'projects',
  setAccountTab,
}) {
  const totalCards = useMemo(
    () => library.reduce((n, e) => n + (Array.isArray(e.doc?.slides) ? e.doc.slides.length : 0), 0),
    [library],
  );

  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const navBtn = (id, label, Icon) => {
    const active = accountTab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setAccountTab?.(id)}
        style={{
          height: isMobile ? 36 : 36,
          padding: '0 12px',
          borderRadius: 9999,
          border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
          background: active ? 'var(--accent-surface)' : 'var(--bg-card)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'var(--font-ui)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
        }}
      >
        <Icon size={13} color={active ? 'var(--accent)' : 'var(--text-muted)'} />
        {label}
      </button>
    );
  };

  const generateBtn = (fullWidth = false) => (
    <button
      type="button"
      data-vc-tour="generate"
      onClick={() => onGenerate()}
      style={{
        width: fullWidth ? '100%' : 'auto',
        height: fullWidth ? 48 : 40,
        minHeight: fullWidth ? 48 : 40,
        padding: '0 22px',
        borderRadius: 9999,
        border: 'none',
        cursor: 'pointer',
        background: 'var(--accent)',
        color: '#fff',
        fontSize: fullWidth ? 15 : 13,
        fontWeight: 600,
        letterSpacing: '-0.016em',
        fontFamily: 'var(--font-ui)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        boxShadow: '0 0 0 1px rgba(255,45,141,0.25)',
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <Sparkles size={fullWidth ? 15 : 14} /> Gerar com IA
    </button>
  );

  const items = useMemo(() => (
    [...library]
      .filter(e => !search.trim() || (e.name || '').toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  ), [library, search]);

  const textProvider = TEXT_PROVIDERS[aiSettings.textProvider] || TEXT_PROVIDERS.openai;
  const imageProvider = IMAGE_PROVIDERS[aiSettings.imageProvider] || IMAGE_PROVIDERS.openai;
  const textModelName = textProvider.models.find((m) => m.id === aiSettings.textModels?.[aiSettings.textProvider])?.name
    || aiSettings.textModels?.[aiSettings.textProvider]
    || 'Modelo';
  const imageModelName = imageProvider.models.find((m) => m.id === aiSettings.imageModels?.[aiSettings.imageProvider])?.name
    || aiSettings.imageModels?.[aiSettings.imageProvider]
    || 'Modelo';
  const aiReady = hasTextAI && hasImageAI;
  const projectName = activeEntryName || 'Sem título';

  const headerBtn = {
    height: isMobile ? 40 : 36,
    padding: '0 12px',
    borderRadius: 9999,
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  };

  return (
    <div
      data-vc-tour="account-home"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-base)',
        minHeight: 0,
        minWidth: 0,
        width: '100%',
      }}
    >
      <header style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-sidebar)',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) auto minmax(0, 1fr)',
        alignItems: 'center',
        gap: isMobile ? 12 : 16,
        padding: isMobile
          ? `calc(10px + env(safe-area-inset-top, 0)) max(12px, env(safe-area-inset-left, 0px)) 12px max(12px, env(safe-area-inset-right, 0px))`
          : `calc(10px + env(safe-area-inset-top, 0)) 16px 10px`,
        flexShrink: 0,
      }}>
        {/* Esquerda — marca + Projetos */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
          justifyContent: 'flex-start',
        }}>
          <button
            type="button"
            onClick={() => setAccountTab?.('projects')}
            aria-label="Projetos" title="Projetos"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minWidth: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              color: 'inherit',
              textAlign: 'left',
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 10, background: 'var(--logo-mark-bg)',
              display: 'grid', placeItems: 'center', flexShrink: 0,
              border: '1px solid var(--border)',
            }}>
              <Flame size={16} color="var(--logo-mark-fg)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 17, fontWeight: 600, letterSpacing: '-0.022em',
                fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1.2,
              }}>
                Viral<span style={{ color: 'var(--accent)' }}>.</span>
              </div>
              <div style={{
                marginTop: 2, fontSize: 11, color: 'var(--text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: isMobile ? 140 : 180,
              }}>
                {accessEmail || 'Studio · dados neste aparelho'}
              </div>
            </div>
          </button>
          {!isMobile && navBtn('projects', 'Projetos', Layers)}
        </div>

        {/* Centro — Gerar com IA */}
        {!isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {generateBtn(false)}
          </div>
        )}

        {/* Direita — ferramentas + Perfil (extremo direito; Assinatura fica dentro do Perfil) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          minWidth: 0,
          flexWrap: 'wrap',
        }}>
          {isMobile ? (
            <>
              <button
                type="button"
                onClick={() => onOpenSettings()}
                aria-label="Configurar IA"
                style={{
                  ...headerBtn,
                  border: `1px solid ${aiReady ? 'var(--success-border)' : 'var(--border)'}`,
                  background: aiReady ? 'var(--success-surface)' : 'var(--bg-pearl)',
                  color: aiReady ? 'var(--success-text)' : 'var(--text-secondary)',
                }}
              >
                <Settings size={13} /> IA
              </button>
              {navBtn('profile', 'Perfil', User)}
            </>
          ) : (
            <>
              <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }} aria-label="Ferramentas">
                <button type="button" onClick={() => onOpenTemplates()} style={headerBtn}>
                  <Layout size={13} /> Templates
                </button>
                <button type="button" onClick={() => onOpenResearch()} style={headerBtn}>
                  <TrendingUp size={13} /> Pesquisa
                </button>
                <button type="button" onClick={() => onOpenHelp()} style={headerBtn} aria-label="Ajuda">?</button>
                <button
                  type="button"
                  onClick={() => onOpenSettings()}
                  style={{
                    ...headerBtn,
                    border: `1px solid ${aiReady ? 'var(--success-border)' : 'var(--border)'}`,
                    background: aiReady ? 'var(--success-surface)' : 'var(--bg-pearl)',
                    color: aiReady ? 'var(--success-text)' : 'var(--text-secondary)',
                  }}
                >
                  <Settings size={13} /> Configurar IA
                </button>
              </nav>
              <nav aria-label="Conta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {navBtn('profile', 'Perfil', User)}
              </nav>
            </>
          )}
        </div>

        {isMobile && (
          <div style={{ gridColumn: '1 / -1' }}>
            {generateBtn(true)}
          </div>
        )}
      </header>

      <div style={{
        flex: 1, minHeight: 0, minWidth: 0, width: '100%',
        overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{
          boxSizing: 'border-box', width: '100%', maxWidth: accountTab === 'profile' ? 820 : 720,
          marginLeft: 'auto', marginRight: 'auto',
          padding: isMobile ? '24px 16px 40px' : '40px 24px 72px',
          display: 'grid', gap: 28,
        }}>
          {accountTab === 'profile' && (
            <>
              <header>
                <p className="vc-eyebrow" style={{ margin: '0 0 8px' }}>Conta</p>
                <h2 style={{
                  margin: 0, fontSize: isMobile ? 24 : 28, fontWeight: 600,
                  letterSpacing: '-0.024em', fontFamily: 'var(--font-display)',
                  color: 'var(--text-primary)', lineHeight: 1.15,
                }}>
                  Perfil pessoal
                </h2>
                <p style={{
                  margin: '8px 0 0', fontSize: 15, lineHeight: 1.45,
                  color: 'var(--text-muted)', maxWidth: '52ch',
                }}>
                  Seu nome, bio, redes e assinatura.
                </p>
              </header>
              <AccountProfile
                email={accessEmail}
                libraryCount={library.length}
                brandCount={brandCount}
                totalCards={totalCards}
                aiSettings={aiSettings}
                hasTextAI={hasTextAI}
                hasImageAI={hasImageAI}
                isMobile={isMobile}
                onOpenSettings={onOpenSettings}
                onManageBilling={onManageBilling}
                onLogout={onLogout}
                onOpenBrands={onOpenBrands}
                currentPeriodEnd={currentPeriodEnd}
              />
            </>
          )}

          {accountTab === 'projects' && (
          <>
          <header>
            <p className="vc-eyebrow" style={{ margin: '0 0 8px' }}>Início</p>
            <h2 style={{
              margin: 0, fontSize: isMobile ? 24 : 28, fontWeight: 600,
              letterSpacing: '-0.024em', fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)', lineHeight: 1.15,
            }}>
              Seus projetos
            </h2>
            <p style={{
              margin: '8px 0 0', fontSize: 15, lineHeight: 1.45,
              color: 'var(--text-muted)', maxWidth: '52ch',
            }}>
              Continue o carrossel em edição ou comece um novo.
            </p>
          </header>

          <section
            aria-label="Projeto atual"
            style={{
              border: '1.5px solid var(--accent)',
              background: 'var(--accent-surface)',
              borderRadius: 16,
              padding: isMobile ? 16 : 20,
              display: 'grid',
              gap: 14,
            }}
          >
            <div>
              <div className="vc-eyebrow" style={{ marginBottom: 6 }}>Em edição</div>
              <h3 style={{
                margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.022em',
                color: 'var(--text-primary)',
              }}>
                {projectName}
              </h3>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                No editor: Marca → Conteúdo → Cards → IA
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                onClick={onContinueEditor}
                style={{
                  height: 40, padding: '0 18px', borderRadius: 9999, border: 'none',
                  background: 'var(--accent)', color: '#fff', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-ui)',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                Continuar no editor <ChevronRight size={15} />
              </button>
              <button
                type="button"
                onClick={() => newDoc()}
                style={{
                  height: 40, padding: '0 16px', borderRadius: 9999,
                  border: '1px solid var(--border)', background: 'var(--bg-base)',
                  color: 'var(--text-primary)', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-ui)',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <Plus size={14} /> Novo projeto
              </button>
            </div>
          </section>

          <section aria-label="Resumo">
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: 10,
            }}>
              {[
                { label: 'Projetos', value: library.length },
                { label: 'Marcas', value: brandCount },
                { label: 'Cards', value: totalCards },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    background: 'var(--bg-pearl)',
                    borderRadius: 12,
                    border: '1px solid var(--hairline)',
                    padding: '14px 16px',
                  }}
                >
                  <div style={{
                    fontSize: 10, letterSpacing: '0.08em', fontWeight: 600,
                    textTransform: 'uppercase', color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)', marginBottom: 6,
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontSize: 26, fontWeight: 600, letterSpacing: '-0.028em',
                    fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1,
                  }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section
            aria-label="Estado da IA"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              borderRadius: 16,
              padding: 18,
              display: 'grid',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div className="vc-eyebrow" style={{ marginBottom: 6 }}>IA</div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {aiReady ? 'Pronta para gerar' : 'Configure para gerar'}
                </h3>
                <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Escolha quem escreve e quem gera as imagens
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenSettings()}
                style={{
                  height: 36, padding: '0 14px', borderRadius: 9999, flexShrink: 0,
                  border: aiReady ? '1px solid var(--border)' : 'none',
                  background: aiReady ? 'var(--bg-pearl)' : 'var(--accent)',
                  color: aiReady ? 'var(--text-primary)' : '#fff',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)',
                }}
              >
                {aiReady ? 'Ajustar' : 'Configurar IA'}
              </button>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 8,
            }}>
              {[
                { label: 'Texto', name: textProvider.name, model: textModelName, ok: hasTextAI },
                { label: 'Imagens', name: imageProvider.name, model: imageModelName, ok: hasImageAI },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    background: 'var(--bg-pearl)',
                    display: 'grid',
                    gap: 4,
                  }}
                >
                  <span style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--text-muted)',
                  }}>
                    {row.label}
                  </span>
                  <strong style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {row.name}
                  </strong>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.model}</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4,
                    fontSize: 10, fontFamily: 'var(--font-mono)',
                    color: row.ok ? 'var(--success)' : 'var(--text-muted)',
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: row.ok ? 'var(--success)' : 'var(--hairline)',
                    }} />
                    {row.ok ? 'Conectado' : 'Falta chave'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Lista de projetos" style={{ display: 'grid', gap: 14 }}>
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center',
              justifyContent: 'space-between', gap: 10,
            }}>
              <div>
                <div className="vc-eyebrow" style={{ marginBottom: 4 }}>Biblioteca</div>
                <h3 style={{
                  margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.022em',
                  fontFamily: 'var(--font-display)', color: 'var(--text-primary)',
                }}>
                  Todos os projetos
                </h3>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => onOpenLibrary()}
                  data-vc-tour="library"
                  style={{
                    height: 36, padding: '0 14px', borderRadius: 9999,
                    border: '1px solid var(--border)', background: 'var(--bg-base)',
                    cursor: 'pointer', color: 'var(--text-secondary)',
                    fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)',
                  }}
                >
                  Abrir biblioteca
                </button>
                <button
                  type="button"
                  onClick={() => newDoc()}
                  style={{
                    height: 36, padding: '0 14px', borderRadius: 9999, border: 'none',
                    cursor: 'pointer', background: 'var(--accent)', color: '#fff',
                    fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Plus size={13} /> Novo
                </button>
              </div>
            </div>

            <input
              type="search"
              placeholder="Buscar projeto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="vc-input"
              aria-label="Buscar projetos"
              style={{ width: '100%' }}
            />


        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.length === 0 && (
            <div style={{
              padding: 36,
              textAlign: 'center',
              color: 'var(--text-muted)',
              border: '1px dashed var(--hairline)',
              borderRadius: 16,
              fontSize: 14,
              lineHeight: 1.45,
            }}>
              {search.trim()
                ? 'Nenhum projeto com esse nome.'
                : 'Ainda sem projetos. Crie um novo ou gere com IA.'}
            </div>
          )}
          {items.map(entry => {
            const isActive = entry.id === activeDocId;
            const slides = entry.doc?.slides || [];
            const firstSlide = slides[0];
            const bg = resolveSlideBrandBg(entry.doc?.brand || {}, 0, firstSlide || {});
            return (
              <div
                key={entry.id}
                style={{
                  background: isActive ? 'var(--accent-surface)' : 'var(--bg-pearl)',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--hairline)'}`,
                  borderRadius: 14,
                  padding: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'border-color 0.15s var(--ease-smooth)',
                }}
              >
                <button
                  type="button"
                  onClick={() => openDoc(entry.id)}
                  aria-label={`Abrir ${entry.name}`}
                  style={{
                    width: 56,
                    height: 70,
                    borderRadius: 11,
                    flexShrink: 0,
                    cursor: 'pointer',
                    border: '1px solid var(--hairline)',
                    background: bg,
                    backgroundImage: firstSlide?.bgImage ? `url(${firstSlide.bgImage})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {firstSlide?.bgImage && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.28)',
                    }} />
                  )}
                  <span style={{
                    position: 'absolute',
                    bottom: 5,
                    left: 6,
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    opacity: 0.85,
                  }}>{slides.length}</span>
                </button>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => openDoc(entry.id)}
                      title="Abrir projeto no editor"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: 16,
                        fontWeight: 600,
                        letterSpacing: '-0.022em',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                        fontFamily: 'var(--font-ui)',
                      }}
                    >
                      {entry.name || 'Sem título'}
                      {isActive && (
                        <span style={{
                          marginLeft: 8,
                          fontSize: 10,
                          fontWeight: 600,
                          color: 'var(--accent)',
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                        }}>
                          atual
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const next = await askPrompt({
                          title: 'Renomear projeto',
                          label: 'Nome',
                          defaultValue: entry.name || '',
                          placeholder: 'Ex: Lançamento de produto',
                          cta: 'Guardar',
                        });
                        if (next?.trim()) renameDoc(entry.id, next.trim());
                      }}
                      style={{
                        padding: '2px 6px',
                        fontSize: 11,
                        color: 'var(--accent)',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                        background: 'transparent',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Renomear
                    </button>
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {slides.length} card{slides.length !== 1 ? 's' : ''}
                    {entry.updatedAt ? ` · ${fmtDate(entry.updatedAt)}` : ''}
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  alignItems: 'stretch',
                  flexShrink: 0,
                }}>
                  <select
                    aria-label={`Estado para ${entry.name}`}
                    value={entry.status}
                    onChange={e => setDocStatus(entry.id, e.target.value)}
                    style={{
                      fontSize: 11,
                      padding: '4px 6px',
                      borderRadius: 8,
                      background: 'var(--bg-card)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      minWidth: 100,
                      fontFamily: 'var(--font-ui)',
                    }}
                  >
                    {STATUS_DEFS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" onClick={() => duplicateDoc(entry.id)} title="Duplicar"
                      aria-label={`Duplicar ${entry.name}`}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: 'var(--bg-base)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                      }}
                    ><Copy size={13} /></button>
                    <button type="button" onClick={() => exportDoc(entry.id)} title="Exportar JSON"
                      aria-label={`Exportar ${entry.name}`}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: 'var(--bg-base)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                      }}
                    ><Download size={13} /></button>
                    {confirmDeleteId === entry.id ? (
                      <>
                        <button type="button" onClick={() => { deleteDoc(entry.id); setConfirmDeleteId(null); }}
                          style={{
                            padding: '0 10px',
                            height: 32,
                            borderRadius: 8,
                            border: '1px solid rgba(255,59,48,0.35)',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#ff3b30',
                            background: 'rgba(255,59,48,0.08)',
                          }}
                        >
                          Confirmar eliminação
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} aria-label="Cancelar eliminação" style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          background: 'var(--bg-base)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        ><X size={13} /></button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmDeleteId(entry.id)}
                        aria-label={`Apagar ${entry.name}`}
                        style={{
                          width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
                          cursor: 'pointer',
                          background: 'var(--bg-base)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff3b30',
                        }}
                      ><Trash2 size={13} /></button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

          <p style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.45,
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}>
            Atalhos: Templates e Pesquisa no topo · chaves de IA em Configurar IA
          </p>
          </section>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

export {
  AccountHomeShell,
};
