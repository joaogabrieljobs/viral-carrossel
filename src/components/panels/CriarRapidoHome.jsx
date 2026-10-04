import { OrganizeForPublish } from './OrganizeForPublish.jsx';
import { OBJECTIVE_TEMPLATES, applyObjectiveTemplate } from '../../utils/objective-templates.js';
import { trackEvent } from '../../utils/telemetry.js';
import { BrandTonePanel } from './BrandTonePanel.jsx';
import { buildIdentityChecklist, projectHasCarouselContent } from '../../utils/context-status.js';
import { storeSlideLogo } from '../../utils/slide-logo.js';
import { Download, Image as ImageIcon, Loader2, Sparkles, Type, SlidersHorizontal, Upload } from 'lucide-react';
import React, { useRef, useState } from 'react';

const BTN_CAPS = {
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontFamily: 'var(--font-mono)',
  fontWeight: 600,
};

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
  onNeedKeys,
  onAnalyzeBrandTone,
  analyzingBrandTone = false,
  toast,
  onExportAll,
  onExportBackup,
  exporting = false,
  onMoreControl,
  onAdjustText,
  onGenerateImages,
  imagesBusy = false,
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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [scopeImages, setScopeImages] = useState(false);
  const [objectiveId, setObjectiveId] = useState(null);
  const checklist = buildIdentityChecklist({ brand, styleKit });
  const hasResult = projectHasCarouselContent(slides);
  const promptTrim = String(quickPrompt || '').trim();
  const shortBio = String(brand?.bio || '').trim();

  const onLogoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingLogo(true);
    try {
      const stored = await storeSlideLogo(file);
      URL.revokeObjectURL(stored.logoImage);
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Falha ao ler a logo.'));
        reader.readAsDataURL(file);
      });
      setStyleKit?.((prev) => ({
        ...prev,
        logo: { imageId: stored.logoImageId, name: file.name },
        logoOnGenerate: true,
      }));
      setBrand?.({ ...brand, logo: dataUrl, logoPosition: brand?.logoPosition || 'tr', logoSize: brand?.logoSize ?? 120, logoOpacity: brand?.logoOpacity ?? 90 });
      toast?.('Logo salva. Novos cards deste projeto já saem com ela.', 'success');
      trackEvent('criar_rapido_logo');
    } catch (err) {
      toast?.(err.message || 'Não foi possível salvar a logo.', 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleGenerate = async () => {
    if (!promptTrim || genBusy) return;
    trackEvent('criar_rapido_generate', { with_images: scopeImages ? '1' : '0' });
    await onQuickGenerate?.(promptTrim, {
      withImages: !!(scopeImages && hasOpenAI),
      narrativeMode: 'none',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{
        padding: '10px 12px', borderRadius: 12,
        border: '1px solid var(--glass-border-strong)',
        background: 'var(--bg-card)',
        fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)',
      }}>
        <strong style={{ color: 'var(--text-secondary)' }}>{checklist.status.label}.</strong>{' '}
        {checklist.status.id === 'sem'
          ? 'A geração depende do pedido — o resultado pode sair genérico.'
          : checklist.status.id === 'basico'
            ? 'Já há orientação mínima da marca.'
            : 'Brief, tom e identidade prontos para reutilizar.'}
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {checklist.items.filter((i) => ['brief', 'tone', 'logo'].includes(i.id)).map((item) => (
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

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="vc-label-sm">Conte sobre sua marca</label>
        <textarea
          className="vc-input vc-textarea"
          rows={3}
          value={shortBio}
          onChange={(e) => setBrand?.({ ...brand, bio: e.target.value })}
          placeholder="O que você faz, para quem e o que torna sua marca diferente?"
          style={{ minHeight: 72, resize: 'vertical', lineHeight: 1.45 }}
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
        hasOpenAI={hasOpenAI}
        onNeedKeys={onNeedKeys}
        toast={toast}
      />

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
                  if (!String(quickPrompt || '').trim()) {
                    setQuickPrompt(applied.quickPrompt);
                    requestAnimationFrame(() => promptRef.current?.focus?.());
                    toast?.(`Pedido preenchido: ${t.label}`, 'success', 2800);
                  } else {
                    toast?.(`Objetivo «${t.label}» — o pedido atual mantém-se; o modo sugerido é ${t.narrativeMode}.`, 'info', 3500);
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
            onGenerateImages={onGenerateImages}
            onDownload={() => { trackEvent('criar_rapido_export'); onExportAll?.(); }}
            onMoreControl={onMoreControl}
            exporting={exporting}
            imagesBusy={imagesBusy}
            hasOpenAI={hasOpenAI}
          />
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
}) {
  const actions = [
    { id: 'text', label: 'Ajustar texto', icon: Type, onClick: onAdjustText },
    { id: 'img', label: 'Gerar imagens', icon: ImageIcon, onClick: onGenerateImages, disabled: !hasOpenAI || imagesBusy, busy: imagesBusy },
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
