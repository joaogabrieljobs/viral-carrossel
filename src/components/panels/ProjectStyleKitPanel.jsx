import React, { useRef, useEffect, useState } from 'react';
import { FileText, FolderPlus, Image as ImageIcon, Layers, Trash2, Upload, X } from 'lucide-react';
import { SectionLabel as S } from '../ui/SectionLabel.jsx';
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
  return src ? <img src={src} alt={reference.name || 'Referência'} title={reference.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <span>Reenvie a imagem</span>;
}

/**
 * Área do projeto: bíblia visual + moodboard + brief tipo CLAUDE.md.
 * Persistido em `doc.styleKit` — cada projeto da biblioteca tem o seu.
 */
function ProjectStyleKitPanel({
  styleKit,
  setStyleKit,
  toast = () => {},
  projectName = '',
  onOpenProjects = null,
  onNewProject = null,
  compactHeader = false,
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
  const hasContent = styleKitHasContent(kit);
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
    <>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
        Nome do contexto
        <input className="vc-input" value={kit.name || ''} maxLength={60} placeholder="Ex.: MUSA" onChange={e => patch({ name: e.target.value })} />
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <strong style={{ fontSize: 12 }}>Logo do projeto</strong>
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)' }}>Salve um PNG transparente e aplique depois nos cards escolhidos, em Editar card.</p>
        {kit.logo && <span style={{ fontSize: 12 }}>{kit.logo.name || 'Logo salva no projeto'}</span>}
        <button type="button" className="vc-btn" disabled={uploading} onClick={() => logoInputRef.current?.click()}>{kit.logo ? 'Trocar logo do projeto' : 'Importar logo PNG para o projeto'}</button>
        <input ref={logoInputRef} type="file" accept="image/png" aria-label="Arquivo PNG da logo do projeto" style={{ display: 'none' }} onChange={async e => {
          const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
          const version = uploadVersion.current;
          setUploading(true);
          try {
            const stored = await storeSlideLogo(file);
            URL.revokeObjectURL(stored.logoImage);
            if (!alive.current || version !== uploadVersion.current) return;
            patch({ logo: { imageId: stored.logoImageId, name: file.name } });
            toast('Logo salva no projeto. Aplique nos cards que você escolher.', 'success');
          } catch (error) { if (alive.current) toast(error.message, 'error'); }
          finally { if (alive.current) setUploading(false); }
        }} />
      </div>
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

      {!compactHeader ? (
        <div style={{
          padding: '12px 14px',
          borderRadius: 12,
          border: '1px solid var(--hairline)',
          background: 'var(--bg-parchment)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)',
          }}>
            Contexto só deste projeto
          </div>
          <div style={{
            fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
            letterSpacing: '-0.011em', fontFamily: 'var(--font-ui)',
          }}>
            {nome}
          </div>
          <p style={{
            margin: 0, fontSize: 12, lineHeight: 1.45, color: 'var(--text-muted)',
            letterSpacing: '-0.005em',
          }}>
            Cada projeto na biblioteca tem o seu brief, estilo e referências.
            Troca de projeto em Projetos — ou cria um novo para outro contexto.
          </p>
          {(onOpenProjects || onNewProject) ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {onOpenProjects ? (
                <button
                  type="button"
                  className="vc-btn vc-btn-ghost"
                  onClick={onOpenProjects}
                  style={{
                    height: 34, borderRadius: 9999, fontSize: 12, fontWeight: 600,
                    padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Layers size={13} /> Projetos
                </button>
              ) : null}
              {onNewProject ? (
                <button
                  type="button"
                  className="vc-btn vc-btn-ghost"
                  onClick={onNewProject}
                  style={{
                    height: 34, borderRadius: 9999, fontSize: 12, fontWeight: 600,
                    padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <FolderPlus size={13} /> Novo projeto
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <S
        title="Brief do projeto"
        hint={`Ficheiro tipo CLAUDE.md com detalhes do produto, marca, público e regras. Vale só para «${nome}» — outros projetos não partilham este texto.`}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="vc-btn vc-btn-ghost"
            onClick={() => contextFileRef.current?.click()}
            style={{
              height: 36, borderRadius: 9999, fontSize: 12, fontWeight: 600,
              padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Upload size={13} /> Carregar .md / .txt
          </button>
          {kit.contextMd?.trim() ? (
            <button
              type="button"
              onClick={() => patch({ contextMd: '' })}
              style={{
                height: 36, border: 'none', background: 'transparent', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-ui)',
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 8px',
              }}
            >
              <X size={12} /> Limpar brief
            </button>
          ) : null}
        </div>
        <textarea
          aria-label="Brief do projeto"
          maxLength={CONTEXT_MD_MAX}
          value={kit.contextMd || ''}
          onChange={(e) => patch({ contextMd: e.target.value.slice(0, CONTEXT_MD_MAX) })}
          rows={8}
          placeholder={
            `# ${nome}\n\n` +
            '## Produto\n...\n\n' +
            '## Público\n...\n\n' +
            '## Tom e regras\n...\n\n' +
            '## Factos que a IA deve conhecer\n...'
          }
          className="vc-input vc-textarea"
          style={{
            minHeight: 140, resize: 'vertical', lineHeight: 1.5,
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
      </S>

      <S
        title="Estilo visual do projeto"
        hint={`Composição, tipografia, paleta, luz e mood — direção dos cards de «${nome}». O prompt extra de cada slide soma-se.`}
      >
        <textarea
          aria-label="Estilo visual do projeto"
          value={kit.stylePrompt || ''}
          onChange={(e) => patch({ stylePrompt: e.target.value.slice(0, STYLE_PROMPT_MAX) })}
          rows={6}
          placeholder={
            'Ex.: fotografia editorial 4:5, luz natural suave, paleta neutra bege/preto, ' +
            'muito espaço negativo no terço superior para tipografia Outfit Bold, ' +
            'composição centrada, fundo clean, sem texto na imagem, estética skincare premium…'
          }
          className="vc-input vc-textarea"
          style={{ minHeight: 110, resize: 'vertical', lineHeight: 1.5, fontSize: 13 }}
        />
      </S>

      <S
        title="Referências de imagem"
        hint={`Moodboard de «${nome}» (até ${MAX_REF_IMAGES}). Usadas quando o slide não tem referência própria.`}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {refs.map((r) => (
            <div
              key={r.id}
              style={{
                position: 'relative', width: 72, height: 72, borderRadius: 8,
                border: '1px solid var(--hairline)', overflow: 'hidden',
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
                border: '1px dashed var(--border)', background: 'var(--bg-card)',
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
      </S>

      {hasContent ? (
        <button
          type="button"
          onClick={() => {
            uploadVersion.current++;
            setStyleKit(clearStyleKit());
            toast(`Estilo e contexto de «${nome}» limpos.`, 'success');
          }}
          style={{
            alignSelf: 'center', minHeight: 32, padding: '4px 12px',
            cursor: 'pointer', border: 'none', background: 'transparent',
            color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-ui)',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}
        >
          <Trash2 size={11} /> Limpar estilo e contexto deste projeto
        </button>
      ) : null}
    </>
  );
}

export { ProjectStyleKitPanel };
