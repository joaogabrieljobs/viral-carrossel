// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useEffect, useId, useState } from 'react';
import { Sparkles, Loader2, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { resolveSlideReference } from '../../utils/slide-reference.js';

function perSlideImageActionState(slide = {}, busy = false, itemLabel = 'slide') {
  if (busy) {
    return {
      label: 'Gerando…',
      title: `Gerando a imagem deste ${itemLabel}.`,
    };
  }
  if (slide.bgImage) {
    return {
      label: 'Regenerar imagem',
      title: `Substitui a imagem atual deste ${itemLabel} por uma nova geração.`,
    };
  }
  if (slide.bgImageFailed) {
    return {
      label: 'Tentar novamente',
      title: `Tentar gerar novamente a imagem deste ${itemLabel}.`,
    };
  }
  return {
    label: 'Gerar imagem',
    title: `Gera apenas a imagem deste ${itemLabel}.`,
  };
}

function PerSlideImageRefBlock({
  slide, width, onChangeExtra, onRemoveRef, onPickRef,
  onGenerateImage, generateImageBusy,
  generationState,
  itemLabel = 'slide',
  collapsible = false,
}) {
  const extra = slide.imgExtraPrompt ?? '';
  const refSource = typeof slide.refImage === 'string' ? slide.refImage : '';
  const refImageId = slide.refImageId || slide.refImageAssetId || null;
  const hasReference = Boolean(refSource || refImageId || slide.refImageFailed);
  const [preview, setPreview] = useState({ imageId: null, source: '', url: '', error: '' });
  const currentPreview = preview.imageId === refImageId && preview.source === refSource;
  const ref = refImageId ? (currentPreview ? preview.url : '') : refSource;
  const refError = currentPreview ? preview.error : '';
  useEffect(() => {
    if (!refImageId) {
      setPreview({ imageId: null, source: '', url: '', error: '' });
      return undefined;
    }
    let cancelled = false;
    setPreview({ imageId: refImageId, source: refSource, url: '', error: '' });
    resolveSlideReference({ refImageId, refImage: refSource }).then((url) => {
      if (!cancelled) setPreview({ imageId: refImageId, source: refSource, url, error: '' });
    }).catch((error) => {
      if (!cancelled) setPreview({ imageId: refImageId, source: refSource, url: '', error: error.message });
    });
    return () => { cancelled = true; };
  }, [refImageId, refSource]);
  const imageAction = perSlideImageActionState(slide, generateImageBusy, itemLabel);
  const disabled = (generationState ? !generationState.canGenerate : false) || Boolean(refError);
  const disabledReason = disabled && !generateImageBusy
    ? (generationState?.message || refError || `Abra Direção e descreva a imagem deste ${itemLabel}.`)
    : '';
  const reasonId = useId();
  const promptId = useId();
  // Na grelha de cards o painel começa fechado: aberto em todos os cards ao
  // mesmo tempo repetia a mesma caixa 7 vezes e empurrava os cards para baixo.
  // Abre sozinho quando o slide já tem referência ou prompt extra.
  const [aberto, setAberto] = useState(() => !collapsible || hasReference || Boolean(extra.trim()));

  const gerarBtn = typeof onGenerateImage === 'function' && (
    <button
      type="button"
      onClick={onGenerateImage}
      disabled={disabled || generateImageBusy}
      aria-describedby={disabledReason ? reasonId : undefined}
      aria-busy={generateImageBusy || undefined}
      aria-label={imageAction.label}
      className="vc-btn vc-btn-ghost"
      title={disabledReason || imageAction.title}
      style={{
        flex: 1,
        width: '100%',
        height: 34,
        marginTop: 0,
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'var(--font-ui)',
        letterSpacing: '-0.011em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '0 12px',
      }}
    >
      {generateImageBusy ? (
        <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
      ) : (
        <Sparkles size={12} />
      )}
      <span aria-live="polite">{imageAction.label}</span>
    </button>
  );
  const reasonText = disabledReason && (
    <p id={reasonId} role="status" style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.45 }}>
      {disabledReason}
    </p>
  );

  if (!aberto) {
    return (
      <div style={{ width: width || '100%', marginTop: 10, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {gerarBtn}
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="vc-btn vc-btn-ghost"
            aria-expanded={false}
            title={`Referência e direção da imagem deste ${itemLabel}`}
            style={{
              height: 34, borderRadius: 9999, fontSize: 12, fontWeight: 500, padding: '0 12px',
              fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            }}
          >
            <ImageIcon size={12} /> Direção <ChevronDown size={12} />
          </button>
        </div>
        {reasonText}
      </div>
    );
  }

  return (
    <div
      style={{
        width: width || '100%',
        marginTop: 10,
        padding: 12,
        borderRadius: 11,
        border: '1px solid var(--hairline)',
        background: 'var(--bg-pearl)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.011em' }}>
          Referência + direção da imagem
        </div>
        {collapsible && (
          <button
            type="button"
            onClick={() => setAberto(false)}
            aria-expanded
            aria-label="Fechar direção da imagem"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
              minWidth: 28, minHeight: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} />
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
        <button
          type="button"
          onClick={onPickRef}
          style={{
            flexShrink: 0,
            width: 56,
            height: 56,
            borderRadius: 8,
            border: '1px dashed var(--border)',
            background: 'var(--bg-card)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            transition: 'border-color 0.12s, color 0.12s',
          }}
          title="Enviar foto de referência (produto, embalagem, mood)"
          aria-label="Adicionar imagem de referência"
        >
          {ref ? (
            <img src={ref} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 7 }} />
          ) : refImageId && !refError ? (
            <Loader2 size={20} aria-label="Carregando referência" style={{ animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <ImageIcon size={20} strokeWidth={1.75} />
          )}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label htmlFor={promptId} className="vc-label-sm" style={{ display: 'block', marginBottom: 4 }}>
            {slide.imageQuery?.trim() ? 'Prompt extra' : 'Direção da imagem'} (este {itemLabel})
          </label>
          <textarea
            id={promptId}
            value={extra}
            onChange={(e) => onChangeExtra(e.target.value)}
            rows={3}
            placeholder="Ex.: fundo branco minimalista, garrafa centralizada, sombra suave, estética skincare premium…"
            className="vc-input vc-textarea"
            style={{ fontSize: 13, lineHeight: 1.47, letterSpacing: '-0.011em', width: '100%', resize: 'vertical', minHeight: 56 }}
          />
        </div>
      </div>
      {gerarBtn}
      {reasonText}
      {hasReference && (
        <button
          type="button"
          onClick={onRemoveRef}
          style={{
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'var(--font-ui)',
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            letterSpacing: '-0.011em',
          }}
        >
          Remover referência
        </button>
      )}
    </div>
  );
}

export {
  perSlideImageActionState,
  PerSlideImageRefBlock,
};
