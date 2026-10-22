import React, { useEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Check, ChevronDown, Image as ImageIcon, Move, Palette, SlidersHorizontal, Sparkles, Type, Upload } from 'lucide-react';
import { renderPresetPreview } from '../../styles/visual-presets.jsx';
import { renderPresentationPresetPreview } from '../../styles/presentation-presets.jsx';
import { REMIX_TONES } from '../../utils/carousel-remix.js';
import { brandLogoReplacementPatch, storeSlideLogo } from '../../utils/slide-logo.js';
import { remapDestaqueSpansOnEdit } from '../../utils/text-spans.js';
import '../../styles/quick-adjustments.css';

/** Saved styles stay visible even when the built-in catalog is collapsed. */
export function quickVisiblePresets(presets, expanded = false, selectedId = '') {
  const catalog = (Array.isArray(presets) ? presets : []).filter((preset) => preset?.id && !preset.hidden);
  if (expanded) return catalog;
  const firstIds = new Set(catalog.filter((preset) => !preset.isCustom).slice(0, 6).map((preset) => preset.id));
  return catalog.filter((preset) => firstIds.has(preset.id) || preset.isCustom || preset.id === selectedId || preset.sourceId === selectedId);
}

/** Keep highlighted words attached to the surviving text as the user edits. */
export function quickTextEditPatch(slide, field, text) {
  const spans = slide?.destaqueSpans && typeof slide.destaqueSpans === 'object' ? slide.destaqueSpans : {};
  return {
    [field]: text,
    destaqueSpans: {
      ...spans,
      [field]: remapDestaqueSpansOnEdit(slide?.[field] || '', text, spans[field] || []),
    },
  };
}

export function quickOverlayTextPatch(slide, overlayId, text) {
  return {
    overlays: (Array.isArray(slide?.overlays) ? slide.overlays : []).map((overlay) => (
      overlay?.id === overlayId && ['text', 'cta'].includes(overlay.type) ? { ...overlay, text } : overlay
    )),
  };
}

const TEXT_SIZES = [
  { value: 85, label: 'Menor' },
  { value: 100, label: 'Padrão' },
  { value: 115, label: 'Maior' },
];

function TextSizeChoice({ label, value, onChange, disabled }) {
  return (
    <div className="vc-quick-adjustments-field">
      <span className="vc-quick-adjustments-label">{label}</span>
      <div className="vc-quick-adjustments-segment" role="group" aria-label={label}>
        {TEXT_SIZES.map((option) => (
          <button key={option.value} type="button" aria-pressed={Number(value ?? 100) === option.value} disabled={disabled} onClick={() => onChange(option.value)}>{option.label}</button>
        ))}
      </div>
    </div>
  );
}

export function QuickAdjustmentsPanel({
  slide = {}, brand = {}, activeIdx = 0, cardCount = 0, isPresentation = false,
  projectId = null, visualPreset = '', presets = [], applyVisualPreset,
  updateSlide, onImportPhotoAt, onOpenPhotoPosition, onSaveBrandLogo,
  onRemix, busy = false, hasTextAI = false, onAutoAdjust, onMoreControl,
  editorFocus = null, toast,
}) {
  const [stylesExpanded, setStylesExpanded] = useState(false);
  const [styleScope, setStyleScope] = useState('card');
  const [toneId, setToneId] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const rootRef = useRef(null);
  const photoInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const mountedRef = useRef(true);
  const targetRef = useRef(null);
  const uploadVersionRef = useRef(0);
  const targetKey = `${projectId || ''}:${slide.id || activeIdx}`;
  const visibleAuxiliaryRef = useRef({ targetKey, fields: new Set() });
  if (visibleAuxiliaryRef.current.targetKey !== targetKey) visibleAuxiliaryRef.current = { targetKey, fields: new Set() };
  targetRef.current = targetKey;
  const selectedTextKey = editorFocus?.slideId === slide.id ? editorFocus.key : null;
  const auxiliaryFields = [
    { field: 'bodyAfterImage', key: 'bodyAfterImage', label: 'Texto complementar' },
    { field: 'eyebrowText', key: 'eyebrow', label: 'Título de apoio' },
    { field: 'strikethroughText', key: 'offer-strike', label: 'Texto riscado' },
    { field: 'afterTitleText', key: 'offer', label: 'Oferta' },
  ];
  for (const item of auxiliaryFields) {
    if (String(slide[item.field] || '').trim() || selectedTextKey === item.key) visibleAuxiliaryRef.current.fields.add(item.field);
  }
  const selectedOverlay = typeof selectedTextKey === 'string' && selectedTextKey.startsWith('ov_')
    ? (slide.overlays || []).find((overlay) => overlay?.id === selectedTextKey.slice(3) && ['text', 'cta'].includes(overlay.type))
    : null;
  const itemLabel = isPresentation ? 'slide' : 'card';
  const itemHeading = isPresentation ? 'Slide' : 'Card';
  const selectedPresetId = styleScope === 'all' ? visualPreset : slide.visualPresetId || visualPreset;
  const visiblePresets = quickVisiblePresets(presets, stylesExpanded, selectedPresetId);
  const catalogCount = quickVisiblePresets(presets, true).length;
  const hasPhoto = !!(slide.bgImage || slide.bgImageId || slide.bgImageAssetId);
  const hasLogo = !!(slide.logoImage || slide.logoImageId || slide.logoImageAssetId || brand.logo || brand.logoImageId || brand.logoAssetId);
  const tone = REMIX_TONES.find((entry) => entry.id === toneId);
  const disabled = busy || uploadingLogo || uploadingPhoto;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    uploadVersionRef.current += 1;
    setUploadingPhoto(false);
    setUploadingLogo(false);
  }, [targetKey]);

  useEffect(() => {
    setStyleScope('card');
    setStylesExpanded(false);
    setToneId('');
  }, [projectId]);

  useEffect(() => {
    if (!editorFocus?.section || editorFocus.slideId !== slide.id) return;
    const sectionName = editorFocus.section === 'ajustes-estilos' ? 'ajustes-estilos'
      : editorFocus.section === 'marca-logo' ? 'marca-logo'
        : editorFocus.section.startsWith('imagem') ? 'imagem-ajustes' : 'texto-caixa';
    const section = rootRef.current?.querySelector(`[data-vc-editor-section="${sectionName}"]`);
    if (!section) return;
    if (section.tagName === 'DETAILS') section.open = true;
    const frame = requestAnimationFrame(() => {
      // A double-click starts editing on the card itself after selection.
      // Do not steal its focus and immediately commit/close that editor.
      if (document.activeElement?.matches('[data-vc-inline-editable="true"][contenteditable="true"]')) return;
      section.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
      if (sectionName === 'texto-caixa') {
        const key = editorFocus.key === 'text' ? 'title' : editorFocus.key;
        const target = [...section.querySelectorAll('textarea')].find((node) => node.dataset.key === key)
          || section.querySelector('textarea');
        target?.focus({ preventScroll: true });
        target?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [editorFocus, slide.id]);

  const onLogoFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onSaveBrandLogo || disabled) return;
    const target = targetKey;
    const version = ++uploadVersionRef.current;
    const isCurrent = () => mountedRef.current && targetRef.current === target && uploadVersionRef.current === version;
    setUploadingLogo(true);
    try {
      const stored = await storeSlideLogo(file);
      if (!isCurrent()) {
        if (stored.logoImage?.startsWith('blob:')) URL.revokeObjectURL(stored.logoImage);
        return;
      }
      await onSaveBrandLogo(brandLogoReplacementPatch(stored, brand));
      if (!isCurrent()) return;
      toast?.(stored.logoLowRes ? 'Logo aplicada. Uma imagem maior ficará mais nítida.' : 'Logo aplicada ao projeto.', stored.logoLowRes ? 'info' : 'success');
    } catch (error) {
      if (isCurrent()) toast?.(error?.message || 'Não foi possível carregar a logo.', 'error');
    } finally {
      if (isCurrent()) setUploadingLogo(false);
    }
  };

  const onPhotoFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onImportPhotoAt || disabled) return;
    const target = targetKey;
    const version = ++uploadVersionRef.current;
    const isCurrent = () => mountedRef.current && targetRef.current === target && uploadVersionRef.current === version;
    setUploadingPhoto(true);
    try {
      await onImportPhotoAt(activeIdx, file);
    } catch (error) {
      if (isCurrent()) toast?.(error?.message || 'Não foi possível carregar a imagem.', 'error');
    } finally {
      if (isCurrent()) setUploadingPhoto(false);
    }
  };

  return (
    <div className="vc-quick-adjustments" ref={rootRef}>
      <header className="vc-quick-adjustments-heading">
        <div><span className="vc-quick-adjustments-kicker">Ajustes rápidos</span><h2>{itemHeading} {activeIdx + 1}{cardCount > 0 ? ` de ${cardCount}` : ''}</h2></div>
        <p>Escolha um estilo e dê seu toque final.</p>
        <button type="button" className="vc-quick-adjustments-button vc-quick-adjustments-primary" disabled={disabled || !onAutoAdjust} onClick={() => onAutoAdjust?.()}><Sparkles size={16} aria-hidden="true" />Organizar este {itemLabel}</button>
      </header>

      <section className="vc-quick-adjustments-styles" aria-label="Estilos prontos" data-vc-editor-section="ajustes-estilos">
        <div className="vc-quick-adjustments-section-title"><Palette size={16} aria-hidden="true" /><h3>Estilos prontos</h3></div>
        <div className="vc-quick-adjustments-segment" role="group" aria-label="Onde aplicar o estilo">
          <button type="button" aria-pressed={styleScope === 'card'} onClick={() => setStyleScope('card')} disabled={disabled}>Este {itemLabel}</button>
          <button type="button" aria-pressed={styleScope === 'all'} onClick={() => setStyleScope('all')} disabled={disabled}>Todos</button>
        </div>
        <div className="vc-quick-adjustments-presets">
          {visiblePresets.map((preset) => {
            const selected = preset.id === selectedPresetId || preset.sourceId === selectedPresetId;
            return (
              <button type="button" className="vc-quick-adjustments-preset" key={preset.id} aria-pressed={selected} aria-label={`Estilo ${preset.label || 'personalizado'}${preset.isCustom ? ', salvo por você' : ''}`} title={preset.desc || preset.label} disabled={disabled || !applyVisualPreset} onClick={() => applyVisualPreset?.(preset.id, styleScope, activeIdx)}>
                <span className={`vc-quick-adjustments-preview${isPresentation ? ' is-presentation' : ''}`} aria-hidden="true">{isPresentation ? renderPresentationPresetPreview(preset) : renderPresetPreview(preset)}</span>
                <span className="vc-quick-adjustments-preset-name">{preset.label || 'Meu estilo'}{preset.isCustom && <small>Seu preset</small>}</span>
                {selected && <Check size={15} className="vc-quick-adjustments-selected" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        {catalogCount > quickVisiblePresets(presets, false, selectedPresetId).length && <button type="button" className="vc-quick-adjustments-link" aria-expanded={stylesExpanded} onClick={() => setStylesExpanded((value) => !value)}>{stylesExpanded ? 'Mostrar menos estilos' : `Ver todos os estilos (${catalogCount})`}<ChevronDown size={15} aria-hidden="true" /></button>}
        <p className="vc-quick-adjustments-hint">Cores, fontes e composição em um clique.</p>
      </section>

      <details className="vc-quick-adjustments-disclosure" data-vc-editor-section="texto-caixa">
        <summary><Type size={17} aria-hidden="true" /><span>Texto<small>Edite as palavras e o tamanho</small></span><ChevronDown size={15} className="vc-quick-adjustments-chevron" aria-hidden="true" /></summary>
        <div className="vc-quick-adjustments-content">
          <label className="vc-quick-adjustments-field"><span>Título</span><textarea id="vc-quick-title" data-key="title" aria-label={`Título deste ${itemLabel}`} value={slide.title || ''} onChange={(event) => updateSlide?.(quickTextEditPatch(slide, 'title', event.target.value))} disabled={disabled || !updateSlide} rows={3} /></label>
          <label className="vc-quick-adjustments-field"><span>Texto de apoio</span><textarea data-key="subtitle" aria-label={`Texto de apoio deste ${itemLabel}`} value={slide.subtitle || ''} onChange={(event) => updateSlide?.(quickTextEditPatch(slide, 'subtitle', event.target.value))} disabled={disabled || !updateSlide} rows={4} /></label>
          {auxiliaryFields.filter((item) => visibleAuxiliaryRef.current.fields.has(item.field)).map((item) => <label className="vc-quick-adjustments-field" key={item.field}><span>{item.label}</span><textarea data-key={item.key} value={slide[item.field] || ''} onChange={(event) => updateSlide?.(quickTextEditPatch(slide, item.field, event.target.value))} disabled={disabled || !updateSlide} rows={item.field === 'bodyAfterImage' ? 3 : 2} /></label>)}
          {selectedOverlay && <label className="vc-quick-adjustments-field"><span>{selectedOverlay.type === 'cta' ? 'Texto do botão' : 'Texto selecionado'}</span><textarea data-key={selectedTextKey} value={selectedOverlay.text || ''} onChange={(event) => updateSlide?.(quickOverlayTextPatch(slide, selectedOverlay.id, event.target.value))} disabled={disabled || !updateSlide} rows={3} /></label>}
          <TextSizeChoice label="Tamanho do título" value={slide.titleSize} disabled={disabled || !updateSlide} onChange={(value) => updateSlide?.({ titleSize: value })} />
          <TextSizeChoice label="Tamanho do apoio" value={slide.subSize} disabled={disabled || !updateSlide} onChange={(value) => updateSlide?.({ subSize: value, ...(slide.bodyAfterImage ? { bodyAfterSize: value } : {}) })} />
          <div className="vc-quick-adjustments-field"><span>Alinhamento</span><div className="vc-quick-adjustments-segment" role="group" aria-label="Alinhamento do texto">{[{ id: 'left', label: 'Esquerda', Icon: AlignLeft }, { id: 'center', label: 'Centro', Icon: AlignCenter }, { id: 'right', label: 'Direita', Icon: AlignRight }].map(({ id, label, Icon }) => <button type="button" key={id} aria-label={label} aria-pressed={(slide.align || 'left') === id} disabled={disabled || !updateSlide} onClick={() => updateSlide?.({ align: id })}><Icon size={16} aria-hidden="true" /></button>)}</div></div>
        </div>
      </details>

      <details className="vc-quick-adjustments-disclosure" data-vc-editor-section="imagem-ajustes">
        <summary><ImageIcon size={17} aria-hidden="true" /><span>Imagem<small>Troque a foto ou ajuste o recorte</small></span><ChevronDown size={15} className="vc-quick-adjustments-chevron" aria-hidden="true" /></summary>
        <div className="vc-quick-adjustments-content">
          <input className="vc-quick-adjustments-file" ref={photoInputRef} type="file" accept="image/*" aria-label={`Enviar imagem para este ${itemLabel}`} onChange={onPhotoFile} tabIndex={-1} />
          <button type="button" className="vc-quick-adjustments-button" disabled={disabled || !onImportPhotoAt} onClick={() => photoInputRef.current?.click()}><Upload size={16} aria-hidden="true" />{uploadingPhoto ? 'Carregando…' : hasPhoto ? 'Trocar imagem' : 'Adicionar imagem'}</button>
          {hasPhoto && <><div className="vc-quick-adjustments-segment" role="group" aria-label="Enquadramento da imagem"><button type="button" disabled={disabled || !updateSlide} aria-pressed={(slide.bgFit || 'cover') === 'cover'} onClick={() => updateSlide?.({ bgFit: 'cover', bgZoom: 100 })}>Preencher</button><button type="button" disabled={disabled || !updateSlide} aria-pressed={slide.bgFit === 'contain'} onClick={() => updateSlide?.({ bgFit: 'contain', bgX: 50, bgY: 50, bgZoom: 100 })}>Foto inteira</button></div><button type="button" className="vc-quick-adjustments-button" disabled={disabled || !onOpenPhotoPosition} onClick={() => onOpenPhotoPosition?.()}><Move size={16} aria-hidden="true" />Reposicionar imagem</button></>}
        </div>
      </details>

      <details className="vc-quick-adjustments-disclosure" data-vc-editor-section="marca-logo">
        <summary><Palette size={17} aria-hidden="true" /><span>Identidade e tom<small>Sua logo e a voz do projeto</small></span><ChevronDown size={15} className="vc-quick-adjustments-chevron" aria-hidden="true" /></summary>
        <div className="vc-quick-adjustments-content">
          <div className="vc-quick-adjustments-field"><span>Logo do projeto</span><input className="vc-quick-adjustments-file" ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Enviar logo do projeto" onChange={onLogoFile} tabIndex={-1} /><button type="button" className="vc-quick-adjustments-button" disabled={disabled || !onSaveBrandLogo} onClick={() => logoInputRef.current?.click()}><Upload size={16} aria-hidden="true" />{uploadingLogo ? 'Carregando…' : hasLogo ? 'Trocar logo' : 'Adicionar logo'}</button><p className="vc-quick-adjustments-hint">Vale para todos os {isPresentation ? 'slides' : 'cards'} deste projeto.</p></div>
          <label className="vc-quick-adjustments-field"><span>Como o texto deve soar?</span><select value={toneId} onChange={(event) => setToneId(event.target.value)} disabled={disabled}><option value="">Escolha um tom</option>{REMIX_TONES.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>
          {tone && <p className="vc-quick-adjustments-hint">{tone.blurb}</p>}
          <button type="button" className="vc-quick-adjustments-button" disabled={disabled || !tone || !hasTextAI || !onRemix} onClick={() => onRemix?.(tone.hint, tone.label, { withImages: false })}><Sparkles size={16} aria-hidden="true" />Reescrever todos os textos</button>
          <p className="vc-quick-adjustments-hint">A reescrita só começa ao clicar no botão e vale para todo o projeto.</p>
          {!hasTextAI && <p className="vc-quick-adjustments-hint">Ative a IA em Mais controles para usar a reescrita.</p>}
        </div>
      </details>

      <button type="button" className="vc-quick-adjustments-link vc-quick-adjustments-more" disabled={disabled || !onMoreControl} onClick={() => onMoreControl?.()}><SlidersHorizontal size={15} aria-hidden="true" />Mais controles</button>
    </div>
  );
}
