import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Download, Trash2, Copy, Plus, Gauge, X, ChevronRight, ArrowLeft, FolderOpen, Layers, User, Image as ImageIcon } from 'lucide-react';
import AccountProfile from './AccountProfile.jsx';
import AccountUsage from './AccountUsage.jsx';
import ImagesLibraryPanel from './panels/ImagesLibraryPanel.jsx';
import BrandLogo from './BrandLogo.jsx';
import CloudPhotoProgress from './CloudPhotoProgress.jsx';
import { resolveSlideBrandBg } from '../utils/brand-helpers.js';
import { STATUS_DEFS, fmtDate } from '../utils/library-helpers.js';
import { DEFAULT_AI_SETTINGS } from '../config/ai-providers.js';
import { moontNarrative } from '../config/moont-brand.js';
import '../styles/project-entry.css';

const projectKindOf = (entry) => (
  entry?.doc?.productKind === 'apresentacao'
    || entry?.doc?.fmt === 'apresentacao'
    || entry?.doc?.creativePreset === 'apresentacao'
    ? 'apresentacao'
    : 'carrossel'
);

const projectKindCopy = (entry) => {
  const kind = projectKindOf(entry);
  const narrative = moontNarrative(kind);
  return kind === 'apresentacao'
    ? { ...narrative, kind, singular: 'Apresentação', unit: 'slide', plural: 'slides' }
    : { ...narrative, kind, singular: 'Carrossel', unit: 'card', plural: 'cards' };
};

// The initial account entry offers two paths. Editor project-list links can
// request initialProjectView="library"; creation always enters the guided flow.
function AccountHomeShell({
  library = [],
  activeDocId,
  activeEntryName,
  brandCount,
  aiSettings = DEFAULT_AI_SETTINGS,
  hasTextAI,
  hasImageAI,
  isMobile,
  onGenerate,
  onStartCreation = null,
  initialProjectView = 'welcome',
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
  onSyncCloud = null,
  cloudSyncBusy = false,
  photoLoad = null,
  openingDocId = null,
  onOpenBrands,
  accessEmail,
  currentPeriodEnd,
  currentPeriodStart,
  onRefreshUsage,
  onProfileSaved,
  cloudProfile,
  planTier = null,
  imageQuota = null,
  useOwnImageKey = false,
  accountTab = 'projects',
  setAccountTab,
  appMode = 'criador',
}) {
  const totalItems = useMemo(
    () => library.reduce((n, e) => n + (Array.isArray(e.doc?.slides) ? e.doc.slides.length : 0), 0),
    [library],
  );
  const [projectView, setProjectView] = useState(initialProjectView === 'library' ? 'library' : 'welcome');
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const PAGE_SIZE = 48;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const headingRef = useRef(null);
  const focusHeadingOnChange = useRef(false);

  useEffect(() => {
    setProjectView(initialProjectView === 'library' ? 'library' : 'welcome');
  }, [initialProjectView]);

  useEffect(() => {
    if (accountTab === 'usage') onRefreshUsage?.().catch(() => {});
  }, [accountTab, onRefreshUsage]);

  useEffect(() => {
    if (accountTab === 'projects' && focusHeadingOnChange.current) {
      headingRef.current?.focus();
      focusHeadingOnChange.current = false;
    }
  }, [accountTab, projectView]);

  const showProjectView = (nextView) => {
    focusHeadingOnChange.current = true;
    setProjectView(nextView);
    setAccountTab?.('projects');
  };

  const items = useMemo(() => (
    [...library]
      .filter(e => !search.trim() || (e.name || '').toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  ), [library, search]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, library.length]);
  const visibleItems = items.slice(0, visibleCount);
  const hasMore = items.length > visibleCount;
  const isWelcome = accountTab === 'projects' && projectView === 'welcome';

  const closeAccount = () => {
    if (activeDocId && onContinueEditor) onContinueEditor();
    else showProjectView('welcome');
  };

  const closeButton = (
    <button type="button" onClick={closeAccount} className="project-entry-icon-button vc-pressable" aria-label="Fechar" title="Fechar">
      <X size={18} />
    </button>
  );

  const accountNav = (
    <nav className="project-entry-account-nav" aria-label="Conta">
      {[
        { id: 'projects', label: 'Início', Icon: Layers },
        { id: 'images', label: 'Imagens', Icon: ImageIcon },
        { id: 'usage', label: 'Uso', Icon: Gauge },
        { id: 'profile', label: 'Perfil', Icon: User },
      ].map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className="project-entry-nav-button vc-pressable"
          aria-current={accountTab === id ? 'page' : undefined}
          onClick={() => id === 'projects' ? showProjectView('welcome') : setAccountTab?.(id)}
        >
          <Icon size={16} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <div className={`project-entry-shell${isMobile ? ' project-entry-shell--mobile' : ''}`} data-vc-tour="account-home">
      <header className="project-entry-header">
        <button type="button" onClick={() => showProjectView('welcome')} className="project-entry-brand" aria-label="Moont — início">
          <BrandLogo height={isMobile ? 25 : 29} style={{ maxWidth: 180 }} />
          <span>{accessEmail || 'Seu espaço de criação'}</span>
        </button>
        {!isMobile && accountNav}
        {typeof onOpenHelp === 'function' && (
          <button type="button" className="project-entry-secondary vc-pressable" onClick={onOpenHelp} aria-label="Ajuda">Ajuda</button>
        )}
      </header>

      <main className={`project-entry-scroll${isWelcome ? ' project-entry-scroll--welcome' : ''}`}>
        <div className={`project-entry-content${isWelcome ? ' project-entry-content--welcome' : ''}${['profile', 'usage'].includes(accountTab) ? ' project-entry-content--account' : ''}`}>
          {['images', 'usage'].includes(accountTab) && <div className="project-entry-close">{closeButton}</div>}
          {accountTab === 'usage' && (
            <AccountUsage
              imageQuota={imageQuota} planTier={planTier} currentPeriodStart={currentPeriodStart}
              currentPeriodEnd={currentPeriodEnd} useOwnImageKey={useOwnImageKey} isMobile={isMobile}
              onRefresh={onRefreshUsage} onOpenSettings={onOpenSettings} onManageBilling={onManageBilling}
            />
          )}
          {accountTab === 'images' && (
            <ImagesLibraryPanel
              library={library} imageQuota={imageQuota} planTier={planTier} isMobile={isMobile}
              useOwnImageKey={useOwnImageKey} onOpenUsage={() => setAccountTab?.('usage')}
            />
          )}
          {accountTab === 'profile' && (
            <>
              <header className="project-entry-section-heading">
                <div className="project-entry-close">{closeButton}</div>
                <p className="vc-eyebrow">Conta</p>
                <h1>Perfil pessoal</h1>
                <p>Seu nome, bio, redes e assinatura.</p>
              </header>
              <AccountProfile
                email={accessEmail} libraryCount={library.length} brandCount={brandCount}
                totalCards={totalItems} aiSettings={aiSettings} hasTextAI={hasTextAI} hasImageAI={hasImageAI}
                isMobile={isMobile} onOpenSettings={onOpenSettings} onManageBilling={onManageBilling}
                onLogout={onLogout} onOpenBrands={onOpenBrands} currentPeriodEnd={currentPeriodEnd}
                planTier={planTier} imageQuota={imageQuota} onOpenUsage={() => setAccountTab?.('usage')}
                onProfileSaved={onProfileSaved} cloudProfile={cloudProfile}
              />
            </>
          )}

          {isWelcome && (
            <>
              <header className="project-entry-welcome-heading">
                <p className="vc-eyebrow">Seu próximo projeto começa aqui</p>
                <h1 ref={headingRef} tabIndex={-1}>O que vamos fazer hoje?</h1>
                <p>Continue uma ideia ou comece uma nova. O Moont acompanha você em cada etapa.</p>
              </header>
              <div className="project-entry-choices" aria-label="Como você quer começar?">
                <button type="button" className="project-entry-choice vc-pressable" aria-labelledby="entry-open-project-title" aria-describedby="entry-open-project-description" onClick={() => showProjectView('library')} data-vc-tour="library">
                  <span className="project-entry-choice-icon"><FolderOpen size={25} aria-hidden="true" /></span>
                  <span className="project-entry-choice-title" id="entry-open-project-title">Abrir um projeto</span>
                  <span className="project-entry-choice-description" id="entry-open-project-description">Encontre seus projetos e continue de onde parou, com todas as ferramentas de edição.</span>
                  <span className="project-entry-choice-action">Ver meus projetos <ChevronRight size={17} aria-hidden="true" /></span>
                </button>
                <button type="button" className="project-entry-choice project-entry-choice--create vc-pressable" aria-labelledby="entry-create-project-title" aria-describedby="entry-create-project-description" onClick={() => onStartCreation?.()} data-vc-tour="generate">
                  <span className="project-entry-choice-icon"><Plus size={25} aria-hidden="true" /></span>
                  <span className="project-entry-choice-title" id="entry-create-project-title">Criar um projeto</span>
                  <span className="project-entry-choice-description" id="entry-create-project-description">Escolha o que quer criar. Vamos organizar o conteúdo, o estilo e os detalhes juntos, passo a passo.</span>
                  <span className="project-entry-choice-action">Começar a criação <ChevronRight size={17} aria-hidden="true" /></span>
                </button>
              </div>
              <p className="project-entry-welcome-note">Carrosséis e apresentações, da primeira ideia à versão final.</p>
            </>
          )}

          {accountTab === 'projects' && projectView === 'library' && (
            <>
              <div className="project-entry-library-topline">
                <button type="button" onClick={() => showProjectView('welcome')} className="project-entry-back vc-pressable"><ArrowLeft size={16} aria-hidden="true" /> Início</button>
                <button type="button" onClick={() => onStartCreation?.()} className="project-entry-primary vc-pressable"><Plus size={16} aria-hidden="true" /> Criar um projeto</button>
              </div>
              <header className="project-entry-section-heading">
                <p className="vc-eyebrow">Sua biblioteca</p>
                <h1 ref={headingRef} tabIndex={-1}>Seus projetos</h1>
                <p>Escolha um projeto para abrir no editor.</p>
              </header>
              <section aria-label="Lista de projetos" className="project-entry-library">
                <div className="project-entry-library-controls">
                  <label className="project-entry-search">
                    <span className="project-entry-search-label">Buscar projetos</span>
                    <input type="search" placeholder="Nome do projeto…" value={search} onChange={(e) => setSearch(e.target.value)} className="vc-input" />
                  </label>
                  {typeof onOpenLibrary === 'function' && (
                    <button type="button" onClick={onOpenLibrary} className="project-entry-secondary vc-pressable">
                      Importar ou organizar biblioteca
                    </button>
                  )}
                  {typeof onSyncCloud === 'function' && (
                    <button type="button" onClick={() => onSyncCloud()} disabled={cloudSyncBusy} aria-busy={cloudSyncBusy} className="project-entry-secondary vc-pressable" data-vc-tour="cloud-sync">
                      {cloudSyncBusy ? 'Atualizando…' : 'Atualizar da conta'}
                    </button>
                  )}
                </div>
                <div className="project-entry-results-count" role="status">{cloudSyncBusy ? 'Buscando seus projetos…' : `${items.length} ${items.length === 1 ? 'projeto' : 'projetos'}`}</div>
                <div className="project-entry-projects">
                  {items.length === 0 && (
                    <div className="project-entry-empty">
                      <FolderOpen size={30} aria-hidden="true" />
                      <h2>{search.trim() ? 'Nenhum projeto encontrado' : cloudSyncBusy ? 'Carregando sua biblioteca' : 'Sua próxima ideia pode ser a primeira'}</h2>
                      <p>{search.trim() ? 'Tente outro nome para encontrar seu projeto.' : cloudSyncBusy ? 'Seus projetos vão aparecer aqui.' : 'Crie um projeto com a ajuda do Moont, uma escolha de cada vez.'}</p>
                      {!search.trim() && !cloudSyncBusy && <button type="button" className="project-entry-primary vc-pressable" onClick={() => onStartCreation?.()}><Plus size={16} aria-hidden="true" /> Criar meu primeiro projeto</button>}
                    </div>
                  )}
          {visibleItems.map(entry => {
            const isActive = entry.id === activeDocId;
            const slides = entry.doc?.slides || [];
            const firstSlide = slides[0];
            const bg = resolveSlideBrandBg(entry.doc?.brand || {}, 0, firstSlide || {});
            const product = projectKindCopy(entry);
            const isPresentation = product.kind === 'apresentacao';
            return (
              <div
                key={entry.id}
                style={{
                  background: isActive ? 'var(--accent-surface)' : 'var(--bg-pearl)',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--hairline)'}`,
                  borderRadius: 14,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  transition: 'border-color 0.15s var(--ease-smooth)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => openDoc(entry.id)}
                  aria-busy={openingDocId === entry.id}
                  aria-label={`Abrir ${entry.name}`}
                  style={{
                    width: isPresentation ? 88 : 56,
                    height: isPresentation ? 50 : 70,
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
                      aria-busy={openingDocId === entry.id}
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
                    {product.name} · {product.format} · {product.singular} · {slides.length} {slides.length === 1 ? product.unit : product.plural}
                    {entry.updatedAt ? ` · ${fmtDate(entry.updatedAt)}` : ''}
                  </div>
                  {openingDocId === entry.id && (
                    <span role="status" style={{ fontSize: 11, color: 'var(--accent)' }}>Abrindo projeto…</span>
                  )}
                </div>
                </div>
                {photoLoad?.projectId === entry.id
                  && <CloudPhotoProgress progress={photoLoad} compact announce={false} />}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <select
                    aria-label={`Estado para ${entry.name}`}
                    value={entry.status}
                    onChange={e => setDocStatus(entry.id, e.target.value)}
                    style={{
                      fontSize: 12,
                      padding: '6px 8px',
                      borderRadius: 8,
                      background: 'var(--bg-card)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      minHeight: 44,
                      flex: '1 1 120px',
                      maxWidth: 160,
                      fontFamily: 'var(--font-ui)',
                    }}
                  >
                    {STATUS_DEFS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 'auto' }}>
                    <button type="button" onClick={() => duplicateDoc(entry.id)} title="Duplicar"
                      aria-label={`Duplicar ${entry.name}`}
                      style={{
                        width: 44,
                        height: 44,
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
                        width: 44,
                        height: 44,
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
                        <button type="button" disabled={deletingId === entry.id}
                          aria-busy={deletingId === entry.id}
                          onClick={async () => {
                            setDeletingId(entry.id);
                            try {
                              const deleted = await deleteDoc(entry.id);
                              if (deleted !== false) setConfirmDeleteId(null);
                            } finally { setDeletingId(null); }
                          }}
                          style={{
                            padding: '0 10px',
                            minHeight: 44,
                            borderRadius: 8,
                            border: '1px solid rgba(255,59,48,0.35)',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#ff3b30',
                            background: 'rgba(255,59,48,0.08)',
                          }}
                        >
                          {deletingId === entry.id ? 'Excluindo…' : 'Confirmar eliminação'}
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} aria-label="Cancelar eliminação" style={{
                          width: 44,
                          height: 44,
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
                          width: 44, height: 44, borderRadius: 8, border: '1px solid var(--border)',
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

                  {hasMore && <button type="button" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)} className="project-entry-secondary vc-pressable">Mostrar mais ({items.length - visibleCount} restantes)</button>}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
      {isMobile && <div className="project-entry-mobile-nav">{accountNav}</div>}
    </div>
  );
}

export { AccountHomeShell };
