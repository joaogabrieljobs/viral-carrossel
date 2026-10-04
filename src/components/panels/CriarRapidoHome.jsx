import { OrganizeForPublish } from './OrganizeForPublish.jsx';
import { OBJECTIVE_TEMPLATES, applyObjectiveTemplate } from '../../utils/objective-templates.js';
import { trackEvent } from '../../utils/telemetry.js';
import { BrandTonePanel } from './BrandTonePanel.jsx';
import { buildIdentityChecklist, projectHasCarouselContent } from '../../utils/context-status.js';
import { storeSlideLogo } from '../../utils/slide-logo.js';
import { Check, Download, Image as ImageIcon, Loader2, Sparkles, Type, SlidersHorizontal, Upload, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

const BTN_CAPS = {
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontFamily: 'var(--font-mono)',
  fontWeight: 600,
};

/** Resolve o modo que o Criar rápido enviará ao mesmo motor do editor. */
export function resolveQuickNarrativeMode(objectiveId, fallbackMode = 'none') {
  return OBJECTIVE_TEMPLATES.find((item) => item.id === objectiveId)?.narrativeMode
    || fallbackMode
    || 'none';
}

/**
 * Home no caminho «Criar rápido» — sequência curta e retomável (Fatia 1).
 * Mesmo documento/motor; só reduz decisões expostas.
 */
export function CriarRapidoHome({
  brand,
  setBrand,
  styleKit,
  setStyleKit,
  slides = [],
  quickPrompt = '',
  setQuickPrompt = () => {},
  onQuickGenerate,
  genBusy = false,
  hasOpenAI = false,
  hasTextAI = false,
  onNeedKeys,
  onAnalyzeBrandTone,
  analyzingBrandTone = false,
  narrativeMode = 'none',
  onNarrativeModeChange = () => {},
  toast,
  onExportAll,
  onExportBackup,
  exporting = false,
  onMoreControl,
  onAdjustText,
  onGenerateImages,
  imagesBusy = false,
  quickCardCount = 'auto',
  onQuickCardCountChange = () => {},
  onAutoAdjustAll = null,
  projectId = null,
  folderId = '',
  publicationDate = '',
  folders = [],
  onSetFolder = null,
  onSetPublicationDate = null,
  onCreateFolder = null,
}) {
  const logoRef = useRef(null);
  const promptRef = useRef(null);
  const projectRef = useRef(projectId);
  projectRef.current = projectId;
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [scopeImages, setScopeImages] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState([]);
  const [objectiveId, setObjectiveId] = useState(null);
  const checklist = buildIdentityChecklist({ brand, styleKit });
  const identityItems = checklist.items.filter((item) => ['brief', 'tone', 'logo'].includes(item.id));
  const identityComplete = identityItems.every((item) => item.ready);
  const [editingIdentity, setEditingIdentity] = useState(() => !identityComplete);
  const previousIdentityCompleteRef = useRef(identityComplete);
  const hasResult = projectHasCarouselContent(slides);
  const promptTrim = String(quickPrompt || '').trim();
  const shortBio = String(brand?.bio || '').trim();

  useEffect(() => {
    setUploadingLogo(false);
    setObjectiveId(null);
  }, [projectId]);

  useEffect(() => {
    setShowImagePicker(false);
    setSelectedImageIds([]);
  }, [projectId]);

  useEffect(() => {
    setEditingIdentity(!identityComplete);
    previousIdentityCompleteRef.current = identityComplete;
  // A identidade deve ser reavaliada ao abrir outro projeto. Alterações dentro
  // do projeto atual não fecham o formulário enquanto a pessoa ainda o edita.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  useEffect(() => {
    const wasComplete = previousIdentityCompleteRef.current;
    if (!wasComplete && identityComplete) setEditingIdentity(false);
    if (wasComplete && !identityComplete) setEditingIdentity(true);
    previousIdentityCompleteRef.current = identityComplete;
  }, [identityComplete]);

  const onLogoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const uploadProjectId = projectId;
    setUploadingLogo(true);
    try {
      const stored = await storeSlideLogo(file);
      // O upload pode terminar depois de a pessoa abrir outro projeto. Nesse
      // caso os bytes ficam no armazenamento para limpeza posterior, mas nunca
      // aplicamos a identidade no documento que passou a estar ativo.
      if (projectRef.current !== uploadProjectId) {
        URL.revokeObjectURL(stored.logoImage);
        return;
      }
      setStyleKit?.((prev) => ({
        ...prev,
        logo: { imageId: stored.logoImageId, name: file.name },
        logoOnGenerate: true,
      }));
      setBrand?.((current) => ({
        ...current,
        logo: stored.logoImage,
        logoImageId: stored.logoImageId,
        logoPosition: current?.logoPosition || 'tr',
        logoSize: current?.logoSize ?? 120,
        logoOpacity: current?.logoOpacity ?? 90,
      }));
      toast?.('Logo salva. Novos cards deste projeto já saem com ela.', 'success');
      trackEvent('criar_rapido_logo');
    } catch (err) {
      if (projectRef.current === uploadProjectId) {
        toast?.(err.message || 'Não foi possível salvar a logo.', 'error');
      }
    } finally {
      if (projectRef.current === uploadProjectId) setUploadingLogo(false);
    }
  };

  const handleGenerate = async () => {
    if (!promptTrim || genBusy) return;
    const effectiveNarrativeMode = resolveQuickNarrativeMode(objectiveId, narrativeMode);
    trackEvent('criar_rapido_generate', { with_images: scopeImages ? '1' : '0' });
    await onQuickGenerate?.(promptTrim, {
      withImages: !!(scopeImages && hasOpenAI),
      narrativeMode: effectiveNarrativeMode,
      cardCount: quickCardCount,
    });
  };

  const openImagePicker = () => {
    const pending = slides
      .filter((s) => !(s.bgImage || s.bgImageId) && String(s.imageQuery || '').trim())
      .map((s) => s.id);
    setSelectedImageIds(pending);
    setShowImagePicker(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{
        padding: '10px 12px', borderRadius: 12,
        border: '1px solid var(--glass-border-strong)',
        background: 'var(--bg-card)',
        fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <strong style={{ color: 'var(--text-secondary)' }}>
              {identityComplete
                ? `${styleKit?.name || brand?.name || 'Marca'} — identidade salva automaticamente`
                : checklist.status.label}
            </strong>
            {!identityComplete ? (
              <span>{' '}· Complete brief, tom e logo para manter a identidade nas próximas criações.</span>
            ) : null}
          </div>
          {identityComplete ? (
            <button
              type="button"
              className="vc-btn vc-btn-ghost"
              aria-expanded={editingIdentity}
              onClick={() => setEditingIdentity((open) => !open)}
              style={{ minHeight: 34, padding: '0 12px', flexShrink: 0, fontSize: 11 }}
            >
              {editingIdentity ? 'Fechar' : 'Editar'}
            </button>
          ) : null}
        </div>
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {identityItems.map((item) => (
            <span key={item.id} style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              textTransform: 'uppercase', padding: '3px 8px', borderRadius: 9999,
              border: `1px solid ${item.ready ? 'var(--success)' : 'var(--hairline)'}`,
              color: item.ready ? 'var(--success)' : 'var(--text-muted)',
            }}>
              {item.ready ? '✓' : '·'} {item.label}
            </span>
          ))}
        </div>
      </div>

      {editingIdentity ? <>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="vc-label-sm">Conte sobre sua marca</label>
        <textarea
          className="vc-input vc-textarea"
          rows={3}
          value={shortBio}
          onChange={(e) => {
            const value = e.target.value;
            setBrand?.((current) => ({ ...current, bio: value }));
          }}
          placeholder={'O que você faz?\nPara quem?\nO que torna sua marca diferente?'}
          autoCapitalize="sentences"
          spellCheck
          style={{ minHeight: 112, resize: 'vertical', lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}
        />
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          Pode continuar sem preencher — o resultado será mais genérico.
        </p>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="vc-label-sm">Identidade — logo</label>
        <input ref={logoRef} type="file" accept="image/png" style={{ display: 'none' }} onChange={onLogoFile} />
        <button
          type="button"
          className="vc-btn vc-btn-ghost"
          disabled={uploadingLogo}
          onClick={() => logoRef.current?.click()}
          style={{ width: '100%', minHeight: 44 }}
        >
          <Upload size={14} /> {brand?.logo || styleKit?.logo ? 'Trocar logo PNG' : 'Adicionar logo PNG'}
        </button>
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1.4,
        }}>
          <input
            type="checkbox"
            checked={styleKit?.logoOnGenerate !== false}
            onChange={(e) => setStyleKit?.((prev) => ({ ...prev, logoOnGenerate: e.target.checked }))}
            style={{ marginTop: 2, width: 16, height: 16, accentColor: 'var(--accent)' }}
          />
          <span>Aplicar esta logo a todos os cards que eu gerar neste projeto</span>
        </label>
      </section>

      <BrandTonePanel
        brand={brand}
        setBrand={setBrand}
        onAnalyze={onAnalyzeBrandTone}
        analyzing={analyzingBrandTone}
        hasTextAI={hasTextAI}
        onNeedKeys={onNeedKeys}
        toast={toast}
        projectId={projectId}
      />
      </> : null}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="vc-label-sm">Diga o que quer publicar</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {OBJECTIVE_TEMPLATES.map((t) => {
            const active = objectiveId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className="vc-btn"
                title={`${t.desc} — preenche o pedido se estiver vazio`}
                aria-pressed={active}
                onClick={() => {
                  const applied = applyObjectiveTemplate(t.id, { quickPrompt });
                  if (!applied) return;
                  trackEvent('objective_template', { id: t.id, surface: 'criar_rapido' });
                  setObjectiveId(t.id);
                  onNarrativeModeChange(applied.narrativeMode);
                  if (!String(quickPrompt || '').trim()) {
                    setQuickPrompt(applied.quickPrompt);
                    requestAnimationFrame(() => promptRef.current?.focus?.());
                    toast?.(`Pedido preenchido: ${t.label}`, 'success', 2800);
                  } else {
                    toast?.(`Objetivo «${t.label}» aplicado ao pedido atual.`, 'info', 3500);
                  }
                }}
                style={{
                  minHeight: 32, padding: '0 10px', borderRadius: 9999,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--hairline)'}`,
                  background: active ? 'var(--accent-surface)' : 'var(--bg-card)',
                  fontSize: 12, fontWeight: active ? 600 : 480, cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <textarea
          ref={promptRef}
          data-vc-quick-prompt=""
          className="vc-input vc-textarea"
          aria-label="Pedido para gerar carrossel"
          rows={5}
          value={quickPrompt || ''}
          onChange={(e) => setQuickPrompt(e.target.value)}
          disabled={genBusy}
          placeholder={'Ex.: Explique por que…\nAnuncie o lançamento de…\nConte a história de…\nCrie um passo a passo sobre…'}
          style={{ minHeight: 110, resize: 'vertical', lineHeight: 1.5, fontSize: 14 }}
        />
        <div>
          <div className="vc-label-sm" style={{ marginBottom: 7 }}>Quantidade de cards</div>
          <div className="vc-seg" role="group" aria-label="Quantidade de cards" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
            {['auto', 3, 5, 6, 8, 10].map((value) => {
              const active = quickCardCount === value;
              return (
                <button
                  key={value}
                  type="button"
                  className={`vc-seg-item${active ? ' active' : ''}`}
                  aria-pressed={active}
                  disabled={genBusy}
                  onClick={() => onQuickCardCountChange(value)}
                  style={{ minHeight: 38, padding: '0 4px', fontSize: 11 }}
                >
                  {value === 'auto' ? 'Auto' : value}
                </button>
              );
            })}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Auto respeita uma quantidade escrita no pedido; sem quantidade, escolhe 6 cards.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`vc-seg-item${!scopeImages ? ' active' : ''}`}
            aria-pressed={!scopeImages}
            disabled={genBusy}
            onClick={() => setScopeImages(false)}
            style={{ flex: 1, minHeight: 40, fontSize: 12 }}
          >
            Gerar só o texto
          </button>
          <button
            type="button"
            className={`vc-seg-item${scopeImages ? ' active' : ''}`}
            aria-pressed={scopeImages}
            disabled={genBusy || !hasOpenAI}
            onClick={() => setScopeImages(true)}
            style={{ flex: 1, minHeight: 40, fontSize: 12, opacity: hasOpenAI ? 1 : 0.5 }}
            title={hasOpenAI ? undefined : 'Imagens exigem plano ou chave própria'}
          >
            Texto e imagens
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {scopeImages
            ? 'Texto e imagens — pode consumir saldo de imagens do plano.'
            : 'Gerar só texto não consome o saldo de imagens do plano.'}
          {' '}Você poderá revisar tudo antes de baixar.
        </p>
        <button
          type="button"
          disabled={genBusy || !promptTrim}
          onClick={handleGenerate}
          style={{
            width: '100%', height: 48, borderRadius: 9999, border: 'none',
            cursor: genBusy || !promptTrim ? 'not-allowed' : 'pointer',
            background: genBusy || !promptTrim ? 'var(--bg-pearl)' : 'var(--accent)',
            color: genBusy || !promptTrim ? 'var(--text-muted)' : '#fff',
            fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            ...BTN_CAPS,
          }}
        >
          {genBusy
            ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Criando o texto…</>
            : <><Sparkles size={14} /> Gerar carrossel</>}
        </button>
      </section>

      {hasResult ? (
        <>
          <PostGenerateActions
            onAdjustText={onAdjustText}
            onGenerateImages={openImagePicker}
            onAutoAdjustAll={onAutoAdjustAll}
            onDownload={() => { trackEvent('criar_rapido_export'); onExportAll?.(); }}
            onMoreControl={onMoreControl}
            exporting={exporting}
            imagesBusy={imagesBusy}
            hasOpenAI={hasOpenAI}
          />
          {showImagePicker ? (
            <ImageBatchPicker
              slides={slides}
              selectedIds={selectedImageIds}
              setSelectedIds={setSelectedImageIds}
              busy={imagesBusy}
              onClose={() => setShowImagePicker(false)}
              onGenerate={async () => {
                if (!selectedImageIds.length) return;
                await onGenerateImages?.(selectedImageIds);
                setShowImagePicker(false);
              }}
            />
          ) : null}
          <OrganizeForPublish
            projectId={projectId}
            folderId={folderId}
            publicationDate={publicationDate}
            folders={folders}
            onSetFolder={onSetFolder}
            onSetPublicationDate={onSetPublicationDate}
            onCreateFolder={onCreateFolder}
            toast={toast}
          />
        </>
      ) : null}

      <div style={{
        padding: '10px 12px', borderRadius: 12,
        border: '1px dashed var(--glass-border-strong)',
        fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <span>O Viral prepara os arquivos. A publicação é feita por você no Instagram.</span>
        <span>Seus projetos ficam neste navegador. Faça um backup para não perder o trabalho.</span>
        {onExportBackup ? (
          <button
            type="button"
            className="vc-btn vc-btn-ghost"
            onClick={() => { trackEvent('criar_rapido_backup'); onExportBackup(); }}
            style={{ alignSelf: 'flex-start', minHeight: 36, fontSize: 11 }}
          >
            Fazer backup do projeto (JSON)
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function PostGenerateActions({
  onAdjustText,
  onGenerateImages,
  onDownload,
  onMoreControl,
  exporting = false,
  imagesBusy = false,
  hasOpenAI = false,
  onAutoAdjustAll = null,
}) {
  const actions = [
    { id: 'text', label: 'Ajustar texto', icon: Type, onClick: onAdjustText },
    { id: 'img', label: 'Gerar imagens', icon: ImageIcon, onClick: onGenerateImages, disabled: !hasOpenAI || imagesBusy, busy: imagesBusy },
    { id: 'fit', label: 'Autoajustar cards', icon: SlidersHorizontal, onClick: onAutoAdjustAll },
    { id: 'dl', label: 'Baixar', icon: Download, onClick: onDownload, disabled: exporting, busy: exporting },
    { id: 'more', label: 'Mais controle', icon: SlidersHorizontal, onClick: onMoreControl },
  ];
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
        letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)',
      }}>
        Próximo passo
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {actions.map(({ id, label, icon: Icon, onClick, disabled, busy }) => (
          <button
            key={id}
            type="button"
            className="vc-btn vc-btn-ghost"
            disabled={disabled || !onClick}
            onClick={onClick}
            style={{
              minHeight: 48, borderRadius: 12, fontSize: 11, fontWeight: 600,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              opacity: disabled ? 0.45 : 1,
            }}
          >
            {busy ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Icon size={16} />}
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

function ImageBatchPicker({ slides, selectedIds, setSelectedIds, busy, onClose, onGenerate }) {
  const eligible = slides.filter((s) => String(s.imageQuery || '').trim());
  const allSelected = eligible.length > 0 && eligible.every((s) => selectedIds.includes(s.id));
  const toggle = (id) => setSelectedIds((current) => (
    current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
  ));

  return (
    <section style={{ padding: 12, borderRadius: 14, border: '1px solid var(--glass-border-strong)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Quais cards terão imagem?</div>
          <div style={{ marginTop: 2, fontSize: 10, color: 'var(--text-muted)' }}>Selecione todos ou apenas alguns.</div>
        </div>
        <button type="button" className="vc-btn vc-btn-ghost" aria-label="Fechar seleção" onClick={onClose} style={{ width: 44, minWidth: 44, height: 44, padding: 0 }}><X size={16} /></button>
      </div>
      <button
        type="button"
        className="vc-btn vc-btn-ghost"
        onClick={() => setSelectedIds(allSelected ? [] : eligible.map((s) => s.id))}
        style={{ minHeight: 40, fontSize: 11 }}
      >
        {allSelected ? 'Desmarcar todos' : 'Selecionar todos os cards'}
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {eligible.map((s, index) => {
          const selected = selectedIds.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(s.id)}
              style={{ minHeight: 78, position: 'relative', overflow: 'hidden', borderRadius: 10, border: `2px solid ${selected ? 'var(--accent)' : 'var(--hairline)'}`, background: s.bgImage ? '#111' : 'var(--bg-pearl)', padding: 0, cursor: 'pointer' }}
            >
              {s.bgImage ? <img src={s.bgImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
              <span style={{ position: 'absolute', left: 6, bottom: 5, color: '#fff', fontSize: 10, fontWeight: 700, textShadow: '0 1px 3px #000' }}>{index + 1}</span>
              <span style={{ position: 'absolute', right: 5, top: 5, width: 22, height: 22, borderRadius: 999, background: selected ? 'var(--accent)' : 'rgba(0,0,0,0.55)', color: '#fff', display: 'grid', placeItems: 'center' }}>{selected ? <Check size={12} /> : null}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="vc-btn vc-btn-primary" disabled={busy || !selectedIds.length} onClick={onGenerate} style={{ minHeight: 46 }}>
        {busy ? <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Gerando…</> : `Gerar ${selectedIds.length || ''} ${selectedIds.length === 1 ? 'imagem' : 'imagens'}`}
      </button>
    </section>
  );
}
