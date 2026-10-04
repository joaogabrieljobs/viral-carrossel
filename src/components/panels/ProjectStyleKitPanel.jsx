import React, { useRef, useEffect, useState } from 'react';
import { FileText, Image as ImageIcon, Trash2, Upload, X } from 'lucide-react';
import {
  MAX_REF_IMAGES,
  CONTEXT_MD_MAX,
  STYLE_PROMPT_MAX,
  styleKitHasContent,
  removeStyleKitRefImage,
  clearStyleKit,
} from '../../utils/style-kit.js';
import { imageGet } from '../../utils/image-store.js';
import { storeProjectReference } from '../../utils/style-kit-storage.js';
import { storeSlideLogo } from '../../utils/slide-logo.js';
import { ContextStatusBar } from './ContextStatusBar.jsx';
import { BrandTonePanel } from './BrandTonePanel.jsx';

function ReferenceThumbnail({ reference }) {
  const [src, setSrc] = useState(reference.dataUrl || '');
  useEffect(() => {
    let cancelled = false;
    let url;
    setSrc(reference.dataUrl || '');
    if (reference.imageId) imageGet(reference.imageId).then(entry => {
      if (!cancelled && entry?.blob) { url = URL.createObjectURL(entry.blob); setSrc(url); }
    }).catch(() => {});
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [reference.imageId, reference.dataUrl]);
  return src
    ? <img src={src} alt={reference.name || 'Referência'} title={reference.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    : <span>Reenvie a imagem</span>;
}

function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
          letterSpacing: '-0.011em', fontFamily: 'var(--font-ui)',
        }}>
          {label}
        </div>
        {hint ? (
          <p style={{
            margin: '4px 0 0', fontSize: 11, lineHeight: 1.45,
            color: 'var(--text-muted)', letterSpacing: '-0.005em',
          }}>
            {hint}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/**
 * Campos de contexto do projeto (brief / estilo / refs / logo).
 * Sem hierarquia própria: o pai (Home ou acordeão Narrativa) define o título.
 * Troca de projeto vive só na Home — sem botões duplicados aqui.
 */
function ProjectStyleKitPanel({
  styleKit,
  setStyleKit,
  toast = () => {},
  projectName = '',
  brand = null,
  setBrand = null,
  onAnalyzeBrandTone = null,
  analyzingBrandTone = false,
  hasOpenAI = false,
  onNeedKeys = null,
  material = null,
  projectId = null,
}) {
  const alive = useRef(true);
  const uploadVersion = useRef(0);
  const [uploading, setUploading] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; uploadVersion.current++; }; }, []);
  const contextFileRef = useRef(null);
  const refImagesInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const kit = styleKit || { stylePrompt: '', contextMd: '', refImages: [] };
  const refs = Array.isArray(kit.refImages) ? kit.refImages : [];
  const hasContent = styleKitHasContent(kit) || !!kit.logo?.imageId || !!kit.logo?.dataUrl;
  const nome = (projectName || '').trim() || 'este projeto';

  const patch = (partial) => {
    setStyleKit((prev) => ({ ...(prev || {}), ...partial }));
  };

  const onContextFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const version = ++uploadVersion.current;
    try {
      const text = await file.text();
      if (!alive.current || version !== uploadVersion.current) return;
      if (text.length > CONTEXT_MD_MAX) throw new Error(`O brief ultrapassa ${CONTEXT_MD_MAX.toLocaleString('pt-BR')} caracteres. Divida o arquivo; nada foi cortado ou substituído.`);
      patch({ contextMd: text });
      toast(`Contexto carregado em «${nome}»: ${file.name}`, 'success');
    } catch (err) { if (alive.current) toast(err.message || 'Não foi possível ler o arquivo.', 'error'); }
  };

  const onRefImages = async (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length || uploading) return;
    const version = uploadVersion.current;
    setUploading(true);
    try {
      const room = Math.max(0, MAX_REF_IMAGES - refs.length);
      if (files.length > room) toast(`Cabem mais ${room} referências neste projeto.`, 'info');
      for (const file of files.slice(0, room)) {
        const reference = await storeProjectReference(file);
        if (!alive.current || version !== uploadVersion.current) return;
        setStyleKit(prev => ({ ...prev, refImages: [...(prev.refImages || []), reference].slice(0, MAX_REF_IMAGES) }));
      }
    } catch (err) { if (alive.current) toast(err.message || 'Não foi possível salvar a referência.', 'error'); }
    finally { if (alive.current) setUploading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {brand ? (
        <ContextStatusBar
          brand={brand}
          styleKit={kit}
          material={material}
          projectName={projectName || kit.name}
        />
      ) : null}
      <input ref={logoInputRef} type="file" accept="image/png" aria-label="Arquivo PNG da logo do projeto" style={{ display: 'none' }} onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
        const version = uploadVersion.current;
        setUploading(true);
        try {
          const stored = await storeSlideLogo(file);
          URL.revokeObjectURL(stored.logoImage);
          if (!alive.current || version !== uploadVersion.current) return;
          patch({ logo: { imageId: stored.logoImageId, name: file.name }, logoOnGenerate: true });
          toast('Logo salva. Novos cards deste projeto já saem com ela (pode desativar em Marca → Logo).', 'success');
        } catch (error) { if (alive.current) toast(error.message, 'error'); }
        finally { if (alive.current) setUploading(false); }
      }} />
      <input
        ref={contextFileRef}
        type="file"
        accept=".md,.txt,.markdown,text/plain,text/markdown"
        style={{ display: 'none' }}
        aria-hidden
        tabIndex={-1}
        onChange={onContextFile}
      />
      <input
        ref={refImagesInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        aria-hidden
        tabIndex={-1}
        onChange={onRefImages}
      />

      <Field label="Nome do contexto" hint="Apelido curto deste projeto (ex.: MUSA).">
        <input
          className="vc-input"
          aria-label="Nome do contexto"
          value={kit.name || ''}
          maxLength={60}
          placeholder="Ex.: MUSA"
          onChange={e => patch({ name: e.target.value })}
        />
      </Field>

      <Field label="Logo" hint="PNG transparente. Preferência: aplicar nos novos cards do projeto.">
        {kit.logo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {kit.logo.name || 'Logo salva'}
            </span>
            <button
              type="button"
              className="vc-btn vc-btn-ghost"
              onClick={() => patch({ logo: null })}
              aria-label="Remover logo deste projeto"
              style={{ minHeight: 36, padding: '0 10px', color: '#f87171' }}
            >
              <Trash2 size={13} /> Remover
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className="vc-btn vc-btn-ghost"
          disabled={uploading}
          onClick={() => logoInputRef.current?.click()}
          style={{ width: '100%', minHeight: 44 }}
        >
          {kit.logo ? 'Trocar logo' : 'Importar logo PNG'}
        </button>
      </Field>

      <Field label="Brief" hint="CLAUDE.md / .txt — produto, público, regras.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="vc-btn vc-btn-ghost"
            onClick={() => contextFileRef.current?.click()}
            style={{ height: 40, borderRadius: 9999, fontSize: 12, fontWeight: 600, padding: '0 14px' }}
          >
            <Upload size={13} /> Carregar .md / .txt
          </button>
          {kit.contextMd?.trim() ? (
            <button
              type="button"
              onClick={() => patch({ contextMd: '' })}
              style={{
                height: 40, border: 'none', background: 'transparent', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-ui)',
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 8px',
              }}
            >
              <X size={12} /> Limpar
            </button>
          ) : null}
        </div>
        <textarea
          aria-label="Brief do projeto"
          maxLength={CONTEXT_MD_MAX}
          value={kit.contextMd || ''}
          onChange={(e) => patch({ contextMd: e.target.value.slice(0, CONTEXT_MD_MAX) })}
          rows={6}
          placeholder={`# ${nome}\n\n## Produto\n...\n\n## Público\n...\n\n## Tom e regras\n...`}
          className="vc-input vc-textarea"
          style={{
            minHeight: 120, resize: 'vertical', lineHeight: 1.5,
            fontFamily: 'var(--font-mono)', fontSize: 12,
          }}
        />
        {kit.contextMd?.trim() ? (
          <div style={{
            fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em', textAlign: 'right',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
          }}>
            <FileText size={10} />
            {kit.contextMd.length.toLocaleString('pt-BR')} caracteres
          </div>
        ) : null}
      </Field>

      {setBrand ? (
        <BrandTonePanel
          brand={brand}
          setBrand={setBrand}
          onAnalyze={onAnalyzeBrandTone}
          analyzing={analyzingBrandTone}
          hasTextAI={hasOpenAI}
          onNeedKeys={onNeedKeys}
          toast={toast}
          projectId={projectId}
        />
      ) : null}

      <Field label="Estilo visual" hint="Composição, tipografia, paleta, luz — direção dos cards.">
        <textarea
          aria-label="Estilo visual do projeto"
          value={kit.stylePrompt || ''}
          onChange={(e) => patch({ stylePrompt: e.target.value.slice(0, STYLE_PROMPT_MAX) })}
          rows={5}
          placeholder="Ex.: fotografia editorial 4:5, luz natural, paleta bege/preto, espaço negativo para tipografia…"
          className="vc-input vc-textarea"
          style={{ minHeight: 100, resize: 'vertical', lineHeight: 1.5, fontSize: 13 }}
        />
      </Field>

      <Field label="Referências" hint={`Moodboard (até ${MAX_REF_IMAGES}). Usadas se o slide não tiver referência própria.`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {refs.map((r) => (
            <div
              key={r.id}
              style={{
                position: 'relative', width: 72, height: 72, borderRadius: 8,
                border: '1px solid var(--glass-border-strong)', overflow: 'hidden',
                background: 'var(--bg-pearl)',
              }}
            >
              <ReferenceThumbnail reference={r} />
              <button
                type="button"
                aria-label={`Remover ${r.name || 'referência'}`}
                onClick={() => setStyleKit(prev => removeStyleKitRefImage(prev, r.id))}
                style={{
                  position: 'absolute', top: 4, right: 4, width: 22, height: 22,
                  borderRadius: 9999, border: 'none', cursor: 'pointer',
                  background: 'rgba(0,0,0,0.72)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {refs.length < MAX_REF_IMAGES ? (
            <button
              type="button"
              disabled={uploading}
              onClick={() => refImagesInputRef.current?.click()}
              title="Adicionar imagens de referência"
              aria-label="Adicionar imagens de referência"
              style={{
                width: 72, height: 72, borderRadius: 8,
                border: '1px dashed var(--glass-border-strong)', background: 'var(--bg-card)',
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
                color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-ui)',
              }}
            >
              <ImageIcon size={18} strokeWidth={1.75} />
              {uploading ? 'Salvando…' : 'Adicionar'}
            </button>
          ) : null}
        </div>
      </Field>

      {hasContent ? (
        <button
          type="button"
          onClick={() => {
            uploadVersion.current++;
            setStyleKit(clearStyleKit());
            toast(`Estilo e contexto de «${nome}» limpos.`, 'success');
          }}
          style={{
            alignSelf: 'center', minHeight: 36, padding: '6px 12px',
            cursor: 'pointer', border: 'none', background: 'transparent',
            color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-ui)',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}
        >
          <Trash2 size={11} /> Limpar contexto deste projeto
        </button>
      ) : null}
    </div>
  );
}

export { ProjectStyleKitPanel };
