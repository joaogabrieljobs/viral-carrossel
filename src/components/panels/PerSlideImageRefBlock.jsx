// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useEffect, useId, useRef, useState } from 'react';
import { Sparkles, Loader2, Image as ImageIcon, ChevronDown, Plus, X } from 'lucide-react';
import {
  MAX_SLIDE_IMAGE_REFERENCES,
  resolveSlideReference,
  slideReferenceDescriptors,
} from '../../utils/slide-reference.js';

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
  onRenameRef,
  onGenerateImage, generateImageBusy,
  generationState,
  itemLabel = 'slide',
  collapsible = false,
}) {
  const extra = slide.imgExtraPrompt ?? '';
  const referenceItems = slideReferenceDescriptors(slide);
  const hasReference = referenceItems.length > 0;
  const referenceSignature = referenceItems.map(item => (
    `${item.key}:${item.refImageId || ''}:${item.refImage || ''}:${item.refImageFailed ? 1 : 0}`
  )).join('|');
  const [previews, setPreviews] = useState({});
  useEffect(() => {
    if (!referenceItems.length) { setPreviews({}); return undefined; }
    let cancelled = false;
    Promise.all(referenceItems.map(async item => {
      try {
        const url = await resolveSlideReference(item);
        return [item.key, { url:url || '', error:'' }];
      } catch (error) {
        return [item.key, { url:'', error:error.message }];
      }
    })).then(entries => { if (!cancelled) setPreviews(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
    // A assinatura representa os campos de referência; objetos são recriados no render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceSignature]);
  const refError = referenceItems.map(item => previews[item.key]?.error).find(Boolean) || '';
  const imageAction = perSlideImageActionState(slide, generateImageBusy, itemLabel);
  const disabled = (generationState ? !generationState.canGenerate : false) || Boolean(refError);
  const planWithoutImages = generationState?.reason === 'plan_without_images';
  const disabledReason = planWithoutImages || !(disabled && !generateImageBusy)
    ? ''
    : (generationState?.message || refError || `Abra Direção e descreva a imagem deste ${itemLabel}.`);
  const reasonId = useId();
  const promptId = useId();
  const promptRef = useRef(null);
  // Na grelha de cards o painel começa fechado: aberto em todos os cards ao
  // mesmo tempo repetia a mesma caixa 7 vezes e empurrava os cards para baixo.
  // Abre sozinho quando o slide já tem referência ou prompt extra.
  const [aberto, setAberto] = useState(() => !collapsible || hasReference || Boolean(extra.trim()));

  const insertMention = (mention) => {
    const field = promptRef.current;
    const fieldHasFocus = typeof document !== 'undefined' && document.activeElement === field;
    const start = fieldHasFocus ? (field?.selectionStart ?? extra.length) : extra.length;
    const end = fieldHasFocus ? (field?.selectionEnd ?? start) : start;
    const before = extra.slice(0, start);
    const after = extra.slice(end);
    const lead = before && !/\s$/.test(before) ? ' ' : '';
    const tail = after && !/^\s/.test(after) ? ' ' : '';
    const token = `@${mention}`;
    const next = `${before}${lead}${token}${tail}${after}`;
    const caret = before.length + lead.length + token.length + tail.length;
    onChangeExtra(next);
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(caret, caret);
    });
  };

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
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10, minWidth:0 }}>
        <div style={{ width:136, flexShrink:0 }}>
          <div className="vc-label-sm" style={{ marginBottom:5 }}>Referências do prompt ({referenceItems.length}/{MAX_SLIDE_IMAGE_REFERENCES})</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 64px)', gap:6 }}>
            {referenceItems.map((item, index) => {
              const preview = previews[item.key];
              return <div key={item.key} style={{ position:'relative', width:64, minWidth:0 }}>
                <div style={{ width:56, height:56, borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-card)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', color:'var(--text-muted)' }} title={item.name}>
                  {preview?.url ? <img src={preview.url} alt={item.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    : preview?.error ? <ImageIcon size={18} aria-label="Referência indisponível"/>
                      : <Loader2 size={18} aria-label="Carregando referência" style={{ animation:'spin 0.8s linear infinite' }}/>}</div>
                <button type="button" onClick={() => onRemoveRef?.(item.key)} aria-label={`Remover ${item.name}`} title={`Remover ${item.name}`} style={{ position:'absolute', top:-5, right:3, width:22, height:22, padding:0, borderRadius:999, border:'1px solid var(--border)', background:'var(--bg-base)', color:'var(--text-primary)', display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><X size={12}/></button>
                <label title={`Nome desta imagem no prompt. Arquivo: ${item.name}`} style={{ marginTop:4, width:64, height:24, border:'1px solid var(--border)', borderRadius:6, display:'flex', alignItems:'center', padding:'0 4px', boxSizing:'border-box', background:'var(--bg-card)', color:'var(--text-muted)', fontSize:10, fontFamily:'var(--font-mono)' }}>
                  <span aria-hidden="true">@</span>
                  <input
                    value={item.mention}
                    onChange={(event) => onRenameRef?.(item.key, event.target.value)}
                    aria-label={`Nome no prompt da referência ${index + 1}`}
                    spellCheck={false}
                    autoCapitalize="none"
                    style={{ width:'100%', minWidth:0, padding:0, border:0, outline:0, background:'transparent', color:'var(--text-primary)', font:'inherit' }}
                  />
                </label>
              </div>;
            })}
            {referenceItems.length < MAX_SLIDE_IMAGE_REFERENCES && <button
              type="button" onClick={onPickRef}
              style={{ width:56, height:56, borderRadius:8, border:'1px dashed var(--border)', background:'var(--bg-card)', cursor:'pointer', display:'flex', flexDirection:'column', gap:2, alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}
              title={`Adicionar até ${MAX_SLIDE_IMAGE_REFERENCES - referenceItems.length} referências`}
              aria-label="Adicionar imagens de referência"
            ><Plus size={17}/><span style={{ fontSize:9 }}>Adicionar</span></button>}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label htmlFor={promptId} className="vc-label-sm" style={{ display: 'block', marginBottom: 4 }}>
            {slide.imageQuery?.trim() ? 'Prompt extra' : 'Direção da imagem'} (este {itemLabel})
          </label>
          {referenceItems.length > 0 && <div style={{ display:'flex', flexWrap:'wrap', gap:5, margin:'0 0 6px' }} aria-label="Inserir referência no prompt">
            {referenceItems.map(item => <button
              key={`mention-${item.key}`}
              type="button"
              onClick={() => insertMention(item.mention)}
              aria-label={`Inserir @${item.mention} no prompt`}
              title={`Inserir @${item.mention} no prompt (${item.name})`}
              style={{ minHeight:24, padding:'2px 7px', borderRadius:999, border:'1px solid var(--border)', background:'var(--bg-card)', color:'var(--text-secondary)', fontSize:10, fontFamily:'var(--font-mono)', cursor:'pointer' }}
            >@{item.mention}</button>)}
          </div>}
          <textarea
            ref={promptRef}
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
          onClick={() => onRemoveRef?.('all')}
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
          Remover todas as referências
        </button>
      )}
    </div>
  );
}

export {
  perSlideImageActionState,
  PerSlideImageRefBlock,
};
