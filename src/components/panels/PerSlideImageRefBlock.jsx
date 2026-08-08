// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React from 'react';
import { Sparkles, Loader2, Image as ImageIcon } from 'lucide-react';

function PerSlideImageRefBlock({
  slide, width, onChangeExtra, onRemoveRef, onPickRef,
  onGenerateImage, generateImageBusy, generateImageDisabled,
}) {
  const extra = slide.imgExtraPrompt ?? '';
  const ref = slide.refImage;
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
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.011em', marginBottom: 8 }}>
        Referência + direção da imagem
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
          ) : (
            <ImageIcon size={20} strokeWidth={1.75} />
          )}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label className="vc-label-sm" style={{ display: 'block', marginBottom: 4 }}>
            Prompt extra (este slide)
          </label>
          <textarea
            value={extra}
            onChange={(e) => onChangeExtra(e.target.value)}
            rows={3}
            placeholder="Ex.: fundo branco minimalista, garrafa centralizada, sombra suave, estética skincare premium…"
            className="vc-input vc-textarea"
            style={{ fontSize: 13, lineHeight: 1.47, letterSpacing: '-0.011em', width: '100%', resize: 'vertical', minHeight: 56 }}
          />
        </div>
      </div>
      {typeof onGenerateImage === 'function' && (
        <button
          type="button"
          onClick={onGenerateImage}
          disabled={generateImageDisabled || generateImageBusy}
          aria-busy={generateImageBusy || undefined}
          className="vc-btn vc-btn-primary"
          title={
            generateImageDisabled
              ? 'Defina palavras-chave de imagem neste card (aba Cards ou ao gerar o carrossel).'
              : 'Gera só a imagem deste slide com GPT Image ou Web trend, conforme o modo atual.'
          }
          style={{
            width: '100%',
            height: 34,
            marginTop: 0,
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 400,
            fontFamily: 'var(--font-ui)',
            letterSpacing: '-0.011em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {generateImageBusy ? (
            <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <Sparkles size={12} />
          )}
          Gerar imagem
        </button>
      )}
      {ref && (
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
  PerSlideImageRefBlock,
};
