// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useState, useLayoutEffect, useRef, useCallback } from 'react';
import { Sparkles, Search, Download, Trash2, Copy, Palette, Layout, Crop, Wand2, Loader2, Bookmark, Move, Video, TrendingUp, RefreshCw, X, Upload, Link as LinkIcon, FileText, AlignLeft, AlignCenter, AlignRight, AlignJustify, Type, BookOpen, Image as ImageIcon, ArrowUp, ArrowDown, Zap, Highlighter, ChevronRight, ChevronDown, Check, Instagram, Home, Layers, SlidersHorizontal } from 'lucide-react';
import { extractDominantColor } from '../utils/color-extraction.js';
import { saveHookToLibrary } from '../utils/hooks-library.js';
import VisualStylePicker from './VisualStylePicker.jsx';
import { VISUAL_PRESETS, applyVisualPreset } from '../styles/visual-presets.jsx';
import { hydrateBrandTextColors, effectiveTitleFontFamily } from '../utils/brand-helpers.js';
import { SectionLabel as S } from './ui/SectionLabel.jsx';
import { PALETTES, TITLE_FONTS } from '../utils/design-data.js';
import { clampTitleWeight } from '../utils/slide-design-system.js';
import { normalizeMaterialField, materialHasUserInput } from '../utils/generation-prompts.js';
import { effectiveBodyFontFamily, LAYOUTS, normalizePhotoRegion, normalizeSlideImgMode, slideStoredPresentationCssFilter, vcHandleAvatarImgStyle } from './card/SlideCardInner.jsx';
import { DEFAULT_PRESENTATION_IMG_ADJUST, presentationAdjustIsNeutral, presentationImgAdjustEquivalent } from './card/FullscreenViewer.jsx';
import { PerSlideImageRefBlock } from './panels/PerSlideImageRefBlock.jsx';
import { ExportMoreFormats } from './panels/ExportMoreFormats.jsx';
import { RefineBtn } from './ui/editor-chrome.jsx';
import { MOVABLE_ELEMENTS, hasElementOffset, resetElementOffsetsPatch } from '../utils/card-elements.js';
import { FontPairingPicker, FontPicker } from './ui/font-pickers.jsx';
import { LayoutMiniIcon, ImageFocalMiniIcon, PhotoRegionMiniIcon } from './ui/mini-icons.jsx';
import { Slider, Toggle, ColorRow } from './ui/primitives.jsx';
import { brandMatchesPalette, BODY_FONTS } from '../utils/brand-visuals.js';
import { slideAutoAdjustPatch, slideHasPendingPhotoIntent } from '../utils/canvas-zones.js';
import { normalizeDestaqueSpansForLen, remapDestaqueSpansOnEdit } from '../utils/text-spans.js';
import { DEFAULT_SLIDE_TEXT_INSET } from '../utils/canvas-layout.js';
import { generateDALLE } from '../utils/ai-client.js';

function guessFontFileFormat(file) {
  const n = (file?.name || '').toLowerCase();
  if (n.endsWith('.woff2')) return 'woff2';
  if (n.endsWith('.woff')) return 'woff';
  if (n.endsWith('.ttf')) return 'truetype';
  if (n.endsWith('.otf')) return 'opentype';
  const t = (file?.type || '').toLowerCase();
  if (t.includes('woff2')) return 'woff2';
  if (t.includes('woff')) return 'woff';
  if (t.includes('ttf')) return 'truetype';
  if (t.includes('otf')) return 'opentype';
  return 'woff2';
}

/** Ponto de ancoragem da foto (background-position % por slide). — Mesmos ids que LAYOUTS (tl…br). */
const IMAGE_FOCAL_XY = {
  tl: [20, 24], tc: [50, 24], tr: [80, 24],
  ml: [20, 50], mc: [50, 50], mr: [80, 50],
  bl: [20, 76], bc: [50, 76], br: [80, 76],
};

/** Presets de «modo» da imagem (encaixe + zoom). */
const IMAGE_MODE_PRESETS = [
  { id: 'full', label: 'Preencher', sub: 'cobre a zona · sem barras', patch: { bgFit: 'cover', bgX: 50, bgY: 50, bgZoom: 100 } },
  { id: 'show_all', label: 'Mais quadrado', sub: 'foto toda visível · vãos com fundo do card', patch: { bgFit: 'contain', bgX: 50, bgY: 50, bgZoom: 100 } },
  { id: 'vertical', label: 'Mais vertical', sub: 'recorte lateral', patch: { bgFit: 'cover', bgX: 50, bgY: 50, bgZoom: 132 } },
  { id: 'wide', label: 'Mais largo', sub: 'vê mais da cena', patch: { bgFit: 'cover', bgX: 50, bgY: 50, bgZoom: 86 } },
  { id: 'manual', label: 'Manual', sub: 'zoom % · tamanho livre', patch: { bgFit: 'custom' } },
];

function activeImageModePresetId(slide) {
  const fit = slide.bgFit ?? 'cover';
  const z = slide.bgZoom ?? 100;
  const x = slide.bgX ?? 50;
  const y = slide.bgY ?? 50;
  const nearCenter = Math.abs(x - 50) < 4 && Math.abs(y - 50) < 4;
  const zNear = (t) => Math.abs(z - t) < 3;
  if (fit === 'custom') return 'manual';
  if (fit === 'contain' && zNear(100) && nearCenter) return 'show_all';
  if (fit === 'cover' && zNear(100) && nearCenter) return 'full';
  if (fit === 'cover' && z >= 124) return 'vertical';
  if (fit === 'cover' && z <= 90) return 'wide';
  return null;
}

/** Qual célula da grelha 3×3 melhor corresponde a bgX/bgY (null se fora do molde). */
function activeImageFocalLayoutId(slide) {
  const x = slide.bgX ?? 50;
  const y = slide.bgY ?? 50;
  let best = null;
  let bestD = Infinity;
  for (const l of LAYOUTS) {
    const [px, py] = IMAGE_FOCAL_XY[l.id];
    const d = (x - px) ** 2 + (y - py) ** 2;
    if (d < bestD) { bestD = d; best = l.id; }
  }
  return bestD < 12 * 12 ? best : null;
}

const PHOTO_REGION_GRID = [
  { id: 'full', lab1: 'FUNDO', lab2: 'CHEIO' },
  { id: 'inset_h_top', lab1: 'FAIXA', lab2: 'TOPO' },
  { id: 'inset_h_middle', lab1: 'FAIXA', lab2: 'MEIO' },
  { id: 'inset_h_bottom', lab1: 'FAIXA', lab2: 'BASE' },
  { id: 'inset_h_narrow_mid', lab1: 'FAIXA', lab2: 'FINA' },
];

const BG_PATTERN_OPTIONS = [
  { id: 'none', label: 'Nenhum' },
  { id: 'grid', label: 'Grade (quadriculado)' },
  { id: 'dots', label: 'Bolinhas' },
  { id: 'hlines', label: 'Linhas horizontais' },
  { id: 'dlines', label: 'Linhas diagonais' },
  { id: 'diag_grid', label: 'Xadrez diagonal' },
];

/** Presets de filtro pré-configurados — atalho pra ajuste rápido na sidebar.
 *  Aplicados via `updateSlide({ presentationImgAdjust: PRESET[id] })`. */
const PRESENTATION_IMG_FILTER_PRESETS = [
  { id: 'neutro',    label: 'Neutro',    desc: 'Sem filtro', vals: { ...DEFAULT_PRESENTATION_IMG_ADJUST } },
  { id: 'editorial', label: 'Editorial', desc: 'Contraste +, cor sutil', vals: { exposure:0, brightness:-3, contrast:14, color:-6, blacks:6, tonalidade:0 } },
  { id: 'vintage',   label: 'Vintage',   desc: 'Quente + suave',           vals: { exposure:4, brightness:2, contrast:-6, color:10, blacks:-8, tonalidade:12 } },
  { id: 'bw',        label: 'P&B',       desc: 'Preto e branco contrastado', vals: { exposure:0, brightness:0, contrast:18, color:-50, blacks:8, tonalidade:0 } },
];

function unionDestaqueRangeIntoSpans(spansIn, selA, selB, len) {
  const lo = Math.max(0, Math.min(len, Math.min(selA, selB)));
  const hi = Math.max(0, Math.min(len, Math.max(selA, selB)));
  if (hi <= lo || !len) return normalizeDestaqueSpansForLen(spansIn, len);
  return normalizeDestaqueSpansForLen([...(spansIn || []), [lo, hi]], len);
}

// Fonte única das tabs do editor (sidebar desktop + bottom bar mobile).
// Criador: Home + Narrativa + Visual + Imagem + Marca · Diretor: + Texto · Studio: + Layout
const EDITOR_TABS = [
  { id:'home',      icon:Home,     label:'Home',      mode:'criador' },
  { id:'narrativa', icon:Wand2,    label:'Narrativa', mode:'criador' },
  { id:'visual',    icon:Palette,  label:'Visual',    mode:'criador' },
  { id:'imagem',    icon:ImageIcon,label:'Imagem',    mode:'criador' },
  { id:'texto',     icon:Type,     label:'Texto',     mode:'diretor' },
  { id:'layout',    icon:Layout,   label:'Layout',    mode:'studio' },
  { id:'brand',     icon:Instagram,label:'Marca',     mode:'criador' },
];
const APP_MODE_RANK = { criador: 1, diretor: 2, studio: 3 };
const visibleEditorTabs = (appMode) =>
  EDITOR_TABS.filter((t) => APP_MODE_RANK[t.mode] <= (APP_MODE_RANK[appMode] || 1));

function SidebarContent({
  setHookLibrary,
  niche,
  slide, slides, activeIdx, brand, setBrand, updateSlide,
  addSlide, deleteSlide, duplicateSlide, moveSlide, refineSlide, refining,
  generateCaption, genCaption, caption, setCaption, setSetupOpen, setResearchOpen, fileInputRef,
  exportSlide, exportAll, exportPDF, exportPhotosOnly = () => {}, exporting, exportProgress, tab, setTab,
  openaiKey, hasOpenAI=false, setKeysOpen,
  setTemplatesOpen, setHookVarsOpen, refineAll, askPrompt, toast,
  material = { content:'', sources:'', context:'' }, setMaterial = () => {},
  imgParams = { fidelity:50, creativity:50, irreverence:50, objectivity:50 },
  setImgParams = () => {},
  setBrandsOpen, brandRoster = [], activeBrandId,
  setLibraryOpen = () => {}, libraryCount = 0,
  onPickVideo = () => {}, onRemoveVideo = () => {},
  openRefImagePicker = () => {},
  slideImgGenBusy = {},
  generateSlideImageAt = () => {},
  creativePreset = 'livre',
  fmt = 'carrossel',
  applyTypographyToAllCards,
  applyBrandTypographyToAllSlides,
  canvasEditMode = false, setCanvasEditMode = () => {},
  showPreviewAlignGrid = false, setShowPreviewAlignGrid = () => {},
  anyCanvasEnabled = false,
  patchCanvasZonesAt = () => {},
  openPhotoZoneImport = () => {},
  handleBatchPhotos = () => {},
  batchPhotoInputRef = { current: null },
  enableCanvasLayout = () => {},
  disableCanvasLayout = () => {},
  onOpenImageCrop = () => {},
  onOpenPhotoPosition = () => {},
  remixWithTone = () => {},
  hasLastGenerate = false,
  visualPreset = null,
  applyVisualPreset: applyVisualPresetCb = () => {},
  appMode = 'criador',
  setActiveIdx = () => {},
  activeEntry = null,
}) {
  const [dalleLoading, setDalleLoading] = React.useState(false);

  const applyDalleQuery = async (q) => {
    if (!hasOpenAI) { toast?.('Configure o provedor de imagem em ⚙ (OpenAI ou Z.ai).', 'error'); return; }
    updateSlide({ imageQuery: q, imgMode: 'dalle', bgImage: null, overlay: 70 });
    setDalleLoading(true);
    try {
      const url = await generateDALLE(q, openaiKey, imgParams, {
        refImage: slide.refImage,
        imgExtraPrompt: slide.imgExtraPrompt,
      });
      updateSlide({ bgImage: url, bgImageSource: 'ai' });
    } catch(e) { toast?.('GPT Image 2: '+e.message, 'error'); }
    finally { setDalleLoading(false); }
  };

  const replaceImg = async () => {
    const q = await askPrompt({
      title: 'Buscar imagem',
      label: 'PALAVRAS-CHAVE EM INGLÊS',
      defaultValue: slide.imageQuery || 'dramatic dark portrait',
      placeholder: 'Ex: cinematic moody portrait studio',
      cta: 'Aplicar',
    });
    if (!q) return;
    await applyDalleQuery(q);
  };

  const refreshImg = async () => {
    if (!slide.imageQuery) return replaceImg();
    await applyDalleQuery(slide.imageQuery);
  };

  const askUrlImg = async () => {
    const u = await askPrompt({
      title: 'Imagem por URL',
      label: 'URL DA IMAGEM',
      defaultValue: '',
      placeholder: 'https://...',
      cta: 'Usar imagem',
    });
    if (u) updateSlide({ bgImage: u });
  };

  const btnStyle = (active) => ({
    padding:'7px 0', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer',
    fontFamily:'var(--font-ui)', transition:'all 0.12s', border:'1px solid',
    display:'flex', alignItems:'center', justifyContent:'center', gap:5,
    background: active ? 'var(--accent)' : 'var(--bg-card)',
    borderColor: active ? 'var(--accent)' : 'var(--border)',
    color: active ? '#fff' : 'var(--text-secondary)',
  });

  const bgFitKey = slide.bgFit ?? 'custom';
  const sidebarBgPreviewFilter = slide.bgImage ? slideStoredPresentationCssFilter(slide) : undefined;

  const titleTaRef = React.useRef(null);
  const subtitleTaRef = React.useRef(null);
  const sandwichBodyTaRef = React.useRef(null);
  const lastTextFieldRef = React.useRef('title');
  const pendTitleSel = React.useRef(null);
  const pendSubtitleSel = React.useRef(null);
  const pendSandwichBodySel = React.useRef(null);
  // Captura a última seleção feita em qualquer textarea — usada como source-of-truth pelo
  // botão "Marcar Destaque" (mais robusto que document.activeElement, que pode mudar em
  // mobile quando o user toca o botão).
  const lastSelectionRef = React.useRef({ field: null, start: 0, end: 0, text: '' });
  const captureSelection = React.useCallback((field, ta) => {
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    if (end <= start) return; // só guarda quando há seleção real (range > 0)
    lastSelectionRef.current = { field, start, end, text: (ta.value || '').slice(start, end) };
  }, []);

  React.useLayoutEffect(() => {
    const p = pendTitleSel.current;
    pendTitleSel.current = null;
    if (!p) return;
    const el = titleTaRef.current;
    if (!el) return;
    el.selectionStart = p.s;
    el.selectionEnd = p.e;
  }, [slide.title]);

  React.useLayoutEffect(() => {
    const p = pendSubtitleSel.current;
    pendSubtitleSel.current = null;
    if (!p) return;
    const el = subtitleTaRef.current;
    if (!el) return;
    el.selectionStart = p.s;
    el.selectionEnd = p.e;
  }, [slide.subtitle]);

  React.useLayoutEffect(() => {
    const p = pendSandwichBodySel.current;
    pendSandwichBodySel.current = null;
    if (!p) return;
    const el = sandwichBodyTaRef.current;
    if (!el) return;
    el.selectionStart = p.s;
    el.selectionEnd = p.e;
  }, [slide.bodyAfterImage]);

  const marcarDestaque = React.useCallback(() => {
    const cultureBody = creativePreset === 'tendencia_cultura' || slide.useCultureLayout;
    const sel = lastSelectionRef.current;
    // Lista de candidatos de campo onde a seleção pode estar — ordenada pela prioridade
    // (campo capturado no onSelect primeiro). Cada candidato é {key, text}.
    const candidates = [];
    const pushCand = (key, text) => {
      if (typeof text === 'string') candidates.push({ key, text });
    };
    if (sel.field === 'title') pushCand('title', slide.title);
    else if (sel.field === 'subtitle') pushCand('subtitle', slide.subtitle);
    else if (sel.field === 'bodyAfterImage' && cultureBody) pushCand('bodyAfterImage', slide.bodyAfterImage);
    // Fallback: tenta os outros campos também, por se o sel.field estiver stale (raro mas possível)
    if (slide.title != null) pushCand('title', slide.title);
    if (slide.subtitle != null) pushCand('subtitle', slide.subtitle);
    if (cultureBody && slide.bodyAfterImage != null) pushCand('bodyAfterImage', slide.bodyAfterImage);

    // Tenta achar o trecho selecionado em cada candidato. Critério:
    //  1. preferir match exato nos índices capturados (mais rápido + preserva intenção)
    //  2. fallback: substring search (text contains sel.text) — se houver, calcular offset
    //  3. CRÍTICO: usar índices contra a versão TRIMMED do texto, pois o renderer trima
    //     antes de aplicar os spans (linha 5449: bodyAfterCulture = slide.bodyAfterImage.trim())
    let resolved = null;
    const wanted = (sel.text || '').trim();
    if (!wanted) {
      toast?.('Selecione um trecho de texto antes de marcar.', 'info');
      return;
    }
    // Renderer trata cada campo diferente:
    //  - title:          text={slide.title || ''}                — usa RAW
    //  - subtitle:       text={slide.subtitle}                   — usa RAW
    //  - bodyAfterImage: text={(slide.bodyAfterImage||'').trim()} — usa TRIMMED
    // Spans precisam ser armazenados contra a versão que o renderer recebe.
    const renderedTextFor = (key, raw) => key === 'bodyAfterImage' ? String(raw || '').trim() : String(raw || '');
    for (const c of candidates) {
      const raw = c.text || '';
      const rendered = renderedTextFor(c.key, raw);
      const renderOffset = rendered ? raw.indexOf(rendered) : 0;
      // Tentativa 1: índices capturados batem (texto identico no raw na faixa selecionada)
      const liveAtIdx = raw.slice(sel.start, sel.end);
      if (liveAtIdx === sel.text) {
        const renderStart = Math.max(0, sel.start - Math.max(0, renderOffset));
        const renderEnd = Math.min(rendered.length, sel.end - Math.max(0, renderOffset));
        if (renderEnd > renderStart && rendered.slice(renderStart, renderEnd) === sel.text) {
          resolved = { key: c.key, text: rendered, start: renderStart, end: renderEnd };
          break;
        }
      }
      // Tentativa 2: substring search no texto que o renderer realmente recebe
      const found = rendered.indexOf(wanted);
      if (found >= 0) {
        resolved = { key: c.key, text: rendered, start: found, end: found + wanted.length };
        break;
      }
    }

    if (!resolved) {
      toast?.('Não encontrei o trecho selecionado em nenhum campo. Selecione de novo e tente.', 'info');
      return;
    }

    const dsPrev = slide.destaqueSpans && typeof slide.destaqueSpans === 'object' ? slide.destaqueSpans : {};
    const curField = dsPrev[resolved.key] ?? [];
    const merged = unionDestaqueRangeIntoSpans(curField, resolved.start, resolved.end, resolved.text.length);
    console.log('[Destaque]', {
      field: resolved.key,
      selectedText: wanted,
      indexRange: [resolved.start, resolved.end],
      textInRender: resolved.text.slice(resolved.start, resolved.end),
      mergedSpans: merged,
      brandAccentHex: brand?.accent,
    });
    updateSlide({
      destaqueSpans: {
        ...dsPrev,
        [resolved.key]: merged,
      },
    });
    const preview = wanted.length > 30 ? wanted.slice(0, 30) + '…' : wanted;
    const fieldLabel = resolved.key === 'title' ? 'título' : resolved.key === 'subtitle' ? 'subtítulo' : 'texto';
    toast?.(`Destaque aplicado em "${preview}" (${fieldLabel}). Cor: ${brand?.accent || 'auto'}`, 'success', 3500);
  }, [slide.title, slide.subtitle, slide.bodyAfterImage, slide.destaqueSpans, creativePreset, slide.useCultureLayout, updateSlide, toast, brand?.accent]);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Tab bar — sub-nav. Polish: ícone 13 (era 11), aria-label,
          aria-current, role=tab pra screen readers. Sombra inset abaixo
          + borda mais escura pra separar visualmente do conteúdo
          (especialmente no drawer mobile, onde tab bar e body têm mesmo
          bg-sidebar e antes fundiam visualmente). */}
      <div
        data-vc-tour="sidebar-tabs"
        role="tablist"
        aria-label="Áreas de edição do projeto"
        style={{
          // Grid 3 colunas — 6 domínios em 2 linhas, todos visíveis sem overflow.
          // Era flex single-row que cortava quando passou de 4 itens.
          display:'grid',
          gridTemplateColumns:'repeat(3, minmax(0, 1fr))',
          rowGap: 0,
          borderBottom:'1px solid var(--border)',
          boxShadow:'0 6px 12px -8px rgba(0,0,0,0.18)',
          flexShrink:0,
          position:'relative', zIndex:1,
        }}
      >
        {(() => {
          // FASE 2 Narrative OS — tabs filtradas por appMode (fonte única EDITOR_TABS)
          return visibleEditorTabs(appMode);
        })().map(t=>{
          const active = tab===t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-current={active ? 'page' : undefined}
              onClick={()=>setTab(t.id)}
              className={`tab-bar-item ${active?'active':''}`}
            >
              <t.icon size={13} strokeWidth={active ? 2.25 : 2}/>{t.label}
            </button>
          );
        })}
      </div>

      {/* Scrollable body */}
      <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:20, paddingBottom:24 }}>

        {/* FASE 1 Narrative OS: split Cards em Imagem + Layout + (Tipografia
            em Visual + Texto card em Narrativa). Outer condition cobre os 4
            tabs que reusam seções daqui; cada section interno gate por tab. */}
        {(tab==='imagem' || tab==='layout' || tab==='texto' || tab==='narrativa' || tab==='slide') && (
          <>
            {(tab==='layout'||tab==='slide') && (<S
              title="Composição"
              hint="Zonas redimensionáveis dentro do card. Ative primeiro abaixo; depois mostre as molduras para clicar direto na área da foto. Pino de swap troca texto/foto entre cards."
            >
              {/* Polish: CTA primário com fontWeight 600 + ícone (era 400 e
                  parecia botão fantasma). Quando ativo, vira selo de sucesso
                  com Check em vez de só trocar cor. Desativar fica como link
                  sutil pra reduzir peso visual. Toggle vai pra baixo — só faz
                  sentido depois de ativar. */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <button
                  type="button"
                  onClick={enableCanvasLayout}
                  disabled={anyCanvasEnabled}
                  style={{
                    width:'100%', minHeight:44, padding:'0 18px', borderRadius:9999,
                    cursor: anyCanvasEnabled ? 'default' : 'pointer',
                    border:`1px solid ${anyCanvasEnabled ? 'var(--success, #16a34a)' : 'var(--accent)'}`,
                    background: anyCanvasEnabled ? 'var(--success, #16a34a)' : 'var(--accent)',
                    color:'#fff',
                    fontSize:13, fontWeight:600, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    transition:'background-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
                  }}
                  onMouseDown={(e) => { if (!anyCanvasEnabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {anyCanvasEnabled
                    ? <><Check size={14} strokeWidth={2.5}/>Composição ativa</>
                    : <><Sparkles size={14}/>Ativar composição</>}
                </button>
                {anyCanvasEnabled && (
                  <button
                    type="button"
                    onClick={disableCanvasLayout}
                    aria-label="Desativar composição em todos os cards"
                    style={{
                      alignSelf:'center', minHeight:32, padding:'0 14px',
                      cursor:'pointer', border:'none', background:'transparent',
                      color:'var(--text-muted)', fontSize:11, fontFamily:'var(--font-ui)',
                      letterSpacing:'-0.005em', textDecoration:'underline',
                      textUnderlineOffset:'3px', textDecorationColor:'var(--hairline)',
                      transition:'color 0.12s, text-decoration-color 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.textDecorationColor='var(--text-muted)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.textDecorationColor='var(--hairline)'; }}
                  >
                    Desativar composição
                  </button>
                )}
              </div>
              {/* Toggle só faz sentido depois de ativar — fica desabilitado e
                  com hint visual claro do porquê quando canvas está off. */}
              <div style={{ opacity: anyCanvasEnabled ? 1 : 0.55, transition:'opacity 0.15s' }}>
                <Toggle
                  label="Mostrar zonas no card"
                  value={canvasEditMode}
                  onChange={(v) => {
                    if (!anyCanvasEnabled) {
                      toast?.('Ative primeiro a composição com o botão acima.', 'info');
                      return;
                    }
                    setCanvasEditMode(v);
                  }}
                />
                {!anyCanvasEnabled && (
                  <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-ui)', marginTop:4, letterSpacing:'-0.005em' }}>
                    Disponível depois de ativar o canvas.
                  </div>
                )}
              </div>
            </S>)}

            {(tab==='imagem'||tab==='slide') && (<S
              title="Importar imagens"
              hint="Separa da tipografia: só afeta a foto de fundo mostrada na zona de imagem do card. O primeiro ficheiro vai para o slide 1, o segundo para o slide 2, e assim por diante."
            >
              {/* Polish: 3 botões com mesmo padrão drop-zone (ícone num
                  círculo accent + label primary + subtítulo). Hover puxa
                  fundo accent-surface + borda accent. Visual e a11y unificados
                  com os uploads da Marca. */}
              {(() => {
                const importBtnStyle = {
                  width:'100%', minHeight:60, padding:'10px 14px', borderRadius:11,
                  cursor:'pointer', border:'1px solid var(--hairline)',
                  background:'var(--bg-card)', fontFamily:'var(--font-ui)',
                  display:'flex', alignItems:'center', gap:12, textAlign:'left',
                  transition:'background-color 0.15s var(--ease-smooth), border-color 0.15s var(--ease-smooth)',
                };
                const importIconWrap = {
                  width:30, height:30, borderRadius:'50%', flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background:'var(--accent-surface)', color:'var(--accent)',
                };
                const importTextWrap = { display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:0 };
                const importTitle = { fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em', lineHeight:1.3 };
                const importSub = { fontSize:10, color:'var(--text-muted)', letterSpacing:'-0.005em', lineHeight:1.35 };
                const onEnter = e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.background='var(--accent-surface)'; };
                const onLeave = e => { e.currentTarget.style.borderColor='var(--hairline)'; e.currentTarget.style.background='var(--bg-card)'; };
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <button type="button" onClick={() => batchPhotoInputRef.current?.click()} style={importBtnStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>
                      <span style={importIconWrap} aria-hidden><Upload size={14} strokeWidth={2.25}/></span>
                      <span style={importTextWrap}>
                        <span style={importTitle}>Importar em lote</span>
                        <span style={importSub}>Distribui um arquivo por slide na ordem (1 → N)</span>
                      </span>
                    </button>
                    <button type="button" onClick={() => openPhotoZoneImport?.(activeIdx)} style={importBtnStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>
                      <span style={importIconWrap} aria-hidden><ImageIcon size={14} strokeWidth={2.25}/></span>
                      <span style={importTextWrap}>
                        <span style={importTitle}>Importar foto neste slide</span>
                        <span style={importSub}>Substitui só a zona de imagem do card {activeIdx + 1}</span>
                      </span>
                    </button>
                    <button type="button" onClick={() => onPickVideo?.()} style={importBtnStyle} onMouseEnter={onEnter} onMouseLeave={onLeave} aria-label="MP4 / MOV / WebM até 60 MB. Substitui foto se houver." title="MP4 / MOV / WebM até 60 MB. Substitui foto se houver.">
                      <span style={importIconWrap} aria-hidden><Video size={14} strokeWidth={2.25}/></span>
                      <span style={importTextWrap}>
                        <span style={importTitle}>Importar vídeo neste slide</span>
                        <span style={importSub}>MP4 · MOV · WebM — até 60 MB · substitui a foto</span>
                      </span>
                    </button>
                    {slide.videoId ? (
                      <button
                        type="button"
                        onClick={() => onRemoveVideo?.()}
                        style={{
                          alignSelf:'center', minHeight:32, padding:'0 14px',
                          cursor:'pointer', border:'none', background:'transparent',
                          color:'var(--text-muted)', fontSize:11, fontFamily:'var(--font-ui)',
                          letterSpacing:'-0.005em',
                          display:'inline-flex', alignItems:'center', gap:6,
                          transition:'color 0.12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color='var(--accent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color='var(--text-muted)'; }}
                      >
                        <Trash2 size={11} aria-hidden/>
                        Remover vídeo do slide
                        {slide.videoName ? <span style={{ opacity:0.6, marginLeft:4 }}>({slide.videoName.slice(0, 18)}…)</span> : null}
                      </button>
                    ) : null}
                  </div>
                );
              })()}
            </S>)}

            {(tab==='imagem'||tab==='slide') && slide.bgImage ? (
              <S title="Posicionar foto" hint="Arraste a foto livremente num preview grande pra centralizar. Usa o mesmo bgX/bgY já existente, só a UX é melhor.">
                <button
                  type="button"
                  onClick={() => onOpenPhotoPosition()}
                  style={{
                    width: '100%', minHeight: 40, borderRadius: 11, cursor: 'pointer',
                    border: '1px solid var(--accent)', background: 'var(--success-surface)',
                    color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
                    fontFamily: 'var(--font-ui)', letterSpacing: '-0.011em',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <Move size={14} aria-hidden/>
                  Abrir preview grande pra arrastar
                </button>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>
                  Tem grade de rule-of-thirds + crosshair pra centralizar com precisão.
                </div>
              </S>
            ) : null}

            {/* D4: Filtros pré-configurados — só faz sentido se há foto no slide ativo */}
            {(tab==='imagem'||tab==='slide') && slide.bgImage ? (
              <S title="Filtro da foto (preset)" hint="Atalho rápido. Pra ajuste fino use o painel «Ajustes da foto» em tela cheia.">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {PRESENTATION_IMG_FILTER_PRESETS.map((p) => {
                    const isActive = (() => {
                      if (p.id === 'neutro') return presentationAdjustIsNeutral(slide.presentationImgAdjust);
                      return presentationImgAdjustEquivalent(slide.presentationImgAdjust, p.vals);
                    })();
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (p.id === 'neutro') {
                            updateSlide({ presentationImgAdjust: undefined });
                          } else {
                            updateSlide({ presentationImgAdjust: { ...p.vals } });
                          }
                        }}
                        style={{
                          padding:'10px 12px', borderRadius:8, cursor:'pointer',
                          border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: isActive ? 'var(--success-surface)' : 'var(--bg-card)',
                          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontSize:12, fontFamily:'var(--font-ui)', textAlign:'left',
                          display:'flex', flexDirection:'column', gap:2, letterSpacing:'-0.011em',
                        }}
                      >
                        <span style={{ fontWeight:600 }}>{p.label}</span>
                        <span style={{ fontSize:10, color:'var(--text-muted)' }}>{p.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </S>
            ) : null}

            {(tab==='narrativa'||tab==='slide') && (<S title={`Texto — card ${activeIdx+1} / ${slides.length}`}>
              <div>
                <label className="vc-label-sm" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <span>Título</span>
                  {(slide.title || '').trim() ? (
                    <button
                      type="button"
                      onClick={() => {
                        setHookLibrary(prev => saveHookToLibrary(prev, {
                          hook: slide.title,
                          niche,
                          tone: brand.tone,
                        }));
                        toast('Hook salvo na biblioteca — vai aparecer em futuras gerações do mesmo nicho.', 'success');
                      }}
                      title="Salvar este título na biblioteca de hooks para reutilizar em novos carrosséis"
                      style={{
                        background:'none', border:'none', cursor:'pointer',
                        color:'var(--text-muted)', fontSize:10, fontFamily:'var(--font-ui)',
                        padding:'4px 8px', borderRadius:6, letterSpacing:'-0.011em',
                        display:'inline-flex', alignItems:'center', gap:4,
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Bookmark size={11} aria-hidden/> Salvar como hook
                    </button>
                  ) : null}
                </label>
                <textarea
                  ref={titleTaRef}
                  onFocus={() => { lastTextFieldRef.current = 'title'; }}
                  onSelect={(e) => captureSelection('title', e.currentTarget)}
                  onKeyUp={(e) => captureSelection('title', e.currentTarget)}
                  value={slide.title}
                  onChange={(e) => {
                    const nw = e.target.value;
                    const old = slide.title ?? '';
                    const ds = slide.destaqueSpans && typeof slide.destaqueSpans === 'object' ? slide.destaqueSpans : {};
                    const nextTitleSpans = remapDestaqueSpansOnEdit(old, nw, ds.title ?? []);
                    updateSlide({
                      title: nw,
                      destaqueSpans: { ...ds, title: nextTitleSpans },
                    });
                  }}
                  rows={2}
                  className="vc-input vc-textarea"
                  style={{ fontSize:17, fontWeight:600 }}
                />
              </div>
              <div>
                <label className="vc-label-sm">Subtítulo</label>
                <textarea
                  ref={subtitleTaRef}
                  onFocus={() => { lastTextFieldRef.current = 'subtitle'; }}
                  onSelect={(e) => captureSelection('subtitle', e.currentTarget)}
                  onKeyUp={(e) => captureSelection('subtitle', e.currentTarget)}
                  value={slide.subtitle}
                  onChange={(e) => {
                    const nw = e.target.value;
                    const old = slide.subtitle ?? '';
                    const ds = slide.destaqueSpans && typeof slide.destaqueSpans === 'object' ? slide.destaqueSpans : {};
                    const nextSubSpans = remapDestaqueSpansOnEdit(old, nw, ds.subtitle ?? []);
                    updateSlide({
                      subtitle: nw,
                      destaqueSpans: { ...ds, subtitle: nextSubSpans },
                    });
                  }}
                  rows={3}
                  className="vc-input vc-textarea"
                  style={{ fontSize:17, color:'var(--text-secondary)', fontWeight:400 }}
                />
              </div>
              {(creativePreset === 'tendencia_cultura' || slide.useCultureLayout) && (
                <>
                  <div>
                    <label className="vc-label-sm">Texto abaixo da imagem (sandwich)</label>
                    <textarea
                      ref={sandwichBodyTaRef}
                      onFocus={() => { lastTextFieldRef.current = 'bodyAfter'; }}
                      onSelect={(e) => captureSelection('bodyAfterImage', e.currentTarget)}
                      onKeyUp={(e) => captureSelection('bodyAfterImage', e.currentTarget)}
                      value={slide.bodyAfterImage ?? ''}
                      onChange={(e) => {
                        const nw = e.target.value;
                        const old = slide.bodyAfterImage ?? '';
                        const ds = slide.destaqueSpans && typeof slide.destaqueSpans === 'object' ? slide.destaqueSpans : {};
                        const nextB = remapDestaqueSpansOnEdit(old, nw, ds.bodyAfterImage ?? []);
                        updateSlide({
                          bodyAfterImage: nw,
                          destaqueSpans: { ...ds, bodyAfterImage: nextB },
                        });
                      }}
                      rows={4}
                      placeholder={
                        'Parágrafo abaixo da foto no layout editorial. Marque Destaque na barra lateral ou mantenha **trecho** nos slides antigos.'
                      }
                      className="vc-input vc-textarea"
                      style={{ fontSize:17, color:'var(--text-secondary)', fontWeight:400 }}
                    />
                  </div>
                  <div>
                    <label className="vc-label-sm">Superfície (auto = claro/escuro alternado)</label>
                    <select
                      value={slide.cultureTone || ''}
                      onChange={e=>updateSlide({ cultureTone: e.target.value })}
                      className="vc-input"
                      style={{ fontSize:12, height:36 }}
                    >
                      <option value="">Automático</option>
                      <option value="light">Claro</option>
                      <option value="dark">Escuro</option>
                      <option value="accent">Cor Destaques da marca (superfície)</option>
                    </select>
                  </div>
                </>
              )}
              <button
                type="button"
                onMouseDown={(e) => {
                  if (refining) return;
                  e.preventDefault(); // mantém foco no textarea (desktop)
                  e.currentTarget.style.transform = 'scale(0.95)';
                }}
                onTouchStart={(e) => {
                  if (refining) return;
                  // Em touch o blur do textarea acontece ANTES do click — captura a seleção viva agora
                  const ae = typeof document !== 'undefined' ? document.activeElement : null;
                  if (ae === titleTaRef.current) captureSelection('title', titleTaRef.current);
                  else if (ae === subtitleTaRef.current) captureSelection('subtitle', subtitleTaRef.current);
                  else if (ae === sandwichBodyTaRef.current) captureSelection('bodyAfterImage', sandwichBodyTaRef.current);
                  e.currentTarget.style.transform = 'scale(0.95)';
                }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                onClick={marcarDestaque}
                disabled={refining}
                title="Aplica a cor Destaques da marca ao trecho selecionado (sem alterar o texto). Use no título, subtítulo ou bloco inferior."
                aria-label="Marcar destaque no texto selecionado"
                style={{
                  width:'100%', minHeight:36, borderRadius:9999, cursor: refining ? 'not-allowed' : 'pointer',
                  border:'1px solid var(--accent)', background:'var(--bg-pearl)', color:'var(--accent)',
                  fontSize:13, fontWeight:600, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  opacity: refining ? 0.5 : 1,
                  transition:'transform 0.1s var(--ease-smooth)',
                }}
              >
                <Highlighter size={15} aria-hidden />
                Marcar Destaque
              </button>
              <RefineBtn onRefine={refineSlide} busy={refining}/>
              <button
                onClick={()=>setHookVarsOpen(true)}
                disabled={refining}
                aria-label="Gerar variações de gancho"
                style={{
                  width:'100%', height:36, borderRadius:8, cursor:'pointer',
                  background:'var(--bg-card)', border:'1px solid var(--border)',
                  color:'var(--text-secondary)', fontSize:11, fontWeight:600, fontFamily:'var(--font-ui)',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all 0.12s',
                }}
                onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
                onMouseLeave={e=>{e.currentTarget.style.color='var(--text-secondary)';e.currentTarget.style.borderColor='var(--border)';}}
              >
                <Zap size={11} style={{ color:'var(--accent)' }}/>Gerar 5 variações de gancho
              </button>
            </S>)}

            {(tab==='narrativa'||tab==='slide') && (
              <S
                title="Textos de assinatura deste card"
                hint="Vêm preenchidos pelos padrões visuais (Bold Promo, Case Study…). São por card — deixe vazio para esconder."
              >
                <div>
                  <label className="vc-label-sm">Sobrelinha (acima do título)</label>
                  <input
                    value={slide.eyebrowText ?? ''}
                    onChange={e=>updateSlide({ eyebrowText: e.target.value })}
                    className="vc-input"
                    placeholder="Sua categoria"
                    style={{ fontSize:12 }}
                  />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div>
                    <label className="vc-label-sm">Riscado</label>
                    <input
                      value={slide.strikethroughText ?? ''}
                      onChange={e=>updateSlide({ strikethroughText: e.target.value })}
                      className="vc-input"
                      placeholder="De R$00"
                      style={{ fontSize:12 }}
                    />
                  </div>
                  <div>
                    <label className="vc-label-sm">Depois do título</label>
                    <input
                      value={slide.afterTitleText ?? ''}
                      onChange={e=>updateSlide({ afterTitleText: e.target.value })}
                      className="vc-input"
                      placeholder="por R$00"
                      style={{ fontSize:12 }}
                    />
                  </div>
                </div>
              </S>
            )}

            {(tab==='imagem'||tab==='slide') && (
              <PerSlideImageRefBlock
                slide={slide}
                onChangeExtra={(v) => updateSlide({ imgExtraPrompt: v })}
                onRemoveRef={() => updateSlide({ refImage: null })}
                onPickRef={() => openRefImagePicker(activeIdx)}
                onGenerateImage={() => generateSlideImageAt(activeIdx)}
                generateImageBusy={!!slideImgGenBusy[slide.id]}
                generateImageDisabled={
                  !(slide.imageQuery || '').trim() ||
                  (normalizeSlideImgMode(slide.imgMode) === 'dalle' && !hasOpenAI)
                }
              />
            )}

            {(tab==='imagem'||tab==='slide') && (<S title={slide.canvas?.enabled ? 'Imagem na área da foto' : 'Imagem de fundo'}>
              {slide.bgImage && (
                <div style={{ position:'relative', marginBottom:2, borderRadius:8, overflow:'hidden' }}>
                  <img
                    src={slide.bgImage}
                    alt=""
                    style={{
                      width:'100%',
                      height:80,
                      objectFit:'cover',
                      display:'block',
                      ...(sidebarBgPreviewFilter ? { filter: sidebarBgPreviewFilter } : {}),
                    }}
                  />
                  {/* overlay label showing query */}
                  {slide.imageQuery && (
                    <div style={{
                      position:'absolute', bottom:0, left:0, right:0,
                      background:'linear-gradient(transparent, rgba(0,0,0,0.7))',
                      padding:'12px 8px 6px', fontSize:9,
                      color:'rgba(255,255,255,0.65)', fontFamily:'var(--font-mono)',
                      letterSpacing:'0.04em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                    }}>{slide.imageQuery}</div>
                  )}
                  {/* action buttons */}
                  <div style={{ position:'absolute', top:5, right:5, display:'flex', gap:4 }}>
                    {slide.imageQuery && (
                      <button onClick={refreshImg} disabled={dalleLoading} aria-label="Nova foto (mesmo tema)" title="Nova foto (mesmo tema)" style={{
                        background:'rgba(0,0,0,0.7)', border:'1px solid rgba(255,255,255,0.1)',
                        color:'#fff', padding:'4px 5px', borderRadius:5, cursor:dalleLoading?'wait':'pointer', display:'flex',
                        opacity:dalleLoading?0.45:1,
                      }}><RefreshCw size={10}/></button>
                    )}
                    <button onClick={()=>updateSlide({bgImage:null})} aria-label="Remover imagem" title="Remover imagem" style={{
                      background:'rgba(0,0,0,0.7)', border:'1px solid rgba(255,255,255,0.1)',
                      color:'#fff', padding:'4px 5px', borderRadius:5, cursor:'pointer', display:'flex',
                    }}><Trash2 size={10}/></button>
                  </div>
                </div>
              )}
              <div style={{
                fontSize:11, lineHeight:1.47, letterSpacing:'-0.011em', fontFamily:'var(--font-ui)',
                color:'var(--text-muted)',
                background:'var(--bg-pearl)', border:'1px solid var(--hairline)', borderRadius:11,
                padding:'8px 10px',
              }}>
                {hasOpenAI
                  ? 'Fundo: GPT Image 2. Buscar altera as palavras-chave; ⟳ gera outra imagem com o mesmo tema.'
                  : 'Para gerar fundos por IA, configure a chave OpenAI (⚙). Até lá: Upload ou URL.'}
              </div>

              {(() => {
                const bodyCv = (String(slide.bodyAfterImage || '')).trim();
                const sandwichLike =
                  (creativePreset === 'tendencia_cultura' || slide.useCultureLayout) &&
                  !!bodyCv &&
                  (!!slide.bgImage || slideHasPendingPhotoIntent(slide));
                const cultureStatFlatLike =
                  (creativePreset === 'tendencia_cultura' || slide.useCultureLayout) &&
                  !slide.bgImage &&
                  !slideHasPendingPhotoIntent(slide) &&
                  !!bodyCv &&
                  !!(String(slide.subtitle || '').trim());
                const photoInsetBlocked = !!slide.canvas?.enabled || sandwichLike || cultureStatFlatLike;
                const pr = normalizePhotoRegion(slide);
                return (
                  <div>
                    <div style={{
                      fontFamily:'var(--font-mono)',
                      fontSize:10,
                      letterSpacing:'0.06em',
                      fontWeight:600,
                      color:'var(--text-muted)',
                      textTransform:'uppercase',
                      marginBottom:6,
                    }}>Área da foto no card</div>
                    {photoInsetBlocked ? (
                      <div style={{
                        fontSize:11, lineHeight:1.47, color:'var(--text-muted)', fontFamily:'var(--font-ui)',
                        background:'var(--bg-pearl)', border:'1px solid var(--hairline)', borderRadius:11, padding:'8px 10px',
                      }}>
                        Faixa com margens e cantos arredondados só no <strong style={{ fontWeight:600 }}>layout clássico</strong>
                        {' '}(sem canvas e sem sanduíche cultura neste card).
                      </div>
                    ) : (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                        {PHOTO_REGION_GRID.map((row) => {
                          const active = pr === row.id;
                          return (
                            <button
                              key={row.id}
                              type="button"
                              onClick={() => updateSlide({ photoRegion: row.id })}
                              style={{
                                ...btnStyle(active),
                                flexDirection: 'column',
                                gap: 4,
                                padding: '8px 4px 6px',
                                minHeight: 72,
                              }}
                              aria-label={`${row.lab1} ${row.lab2}`}
                            >
                              <PhotoRegionMiniIcon regionId={row.id} active={active} />
                              <span style={{
                                fontSize:8,
                                fontWeight:600,
                                fontFamily:'var(--font-mono)',
                                letterSpacing:'0.04em',
                                lineHeight:1.15,
                                textAlign:'center',
                                color: active ? '#fff' : 'var(--text-muted)',
                              }}>
                                {row.lab1}<br />{row.lab2}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Action buttons */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[
                  { icon:Upload, label:'Upload', action:()=>fileInputRef.current?.click() },
                  { icon:LinkIcon, label:'URL', action:askUrlImg },
                  { icon:Search, label:'Buscar', action:()=>replaceImg() },
                  {
                    icon: Crop,
                    label: 'Recortar',
                    action: () => onOpenImageCrop?.(),
                    disabled: !slide.bgImage,
                  },
                ].map(({ icon: Icon, label, action, disabled })=>(
                  <button
                    key={label}
                    type="button"
                    onClick={action}
                    disabled={disabled}
                    style={{
                      background: disabled ? 'var(--bg-pearl)' : 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding:'8px 0',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      display:'flex', flexDirection:'column',
                      alignItems:'center', gap:4, transition:'all 0.12s',
                      color: 'var(--text-muted)',
                      opacity: disabled ? 0.55 : 1,
                    }}
                    onMouseEnter={(e)=>{
                      if (disabled) return;
                      e.currentTarget.style.color='var(--text-primary)';
                      e.currentTarget.style.borderColor='var(--accent)';
                    }}
                    onMouseLeave={(e)=>{
                      if (disabled) return;
                      e.currentTarget.style.color='var(--text-muted)';
                      e.currentTarget.style.borderColor='var(--border)';
                    }}
                  >
                    <Icon size={12}/><span style={{ fontSize:11, fontWeight:600, letterSpacing:'-0.011em' }}>{label}</span>
                  </button>
                ))}
              </div>

              {slide.imageQuery && (
                <div style={{
                  fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)',
                  background:'var(--accent-surface)', border:'1px solid rgba(0,0,0,0.1)',
                  borderRadius:8, padding:'6px 10px', lineHeight:1.5,
                }}>
                  {hasOpenAI ? 'GPT · ' : ''}Palavras-chave · &quot;{slide.imageQuery}&quot;
                </div>
              )}

              {slide.bgImage && (
                <>
                  {slide.canvas?.enabled && (
                    <div style={{
                      fontSize:11, lineHeight:1.47, letterSpacing:'-0.011em', fontFamily:'var(--font-ui)',
                      color:'var(--text-muted)',
                      background:'var(--bg-pearl)', border:'1px solid var(--hairline)', borderRadius:11,
                      padding:'8px 10px',
                    }}>
                      Com <strong style={{ fontWeight:600 }}>canvas</strong> ativo, o modo e o foco aplicam-se à{' '}
                      <strong style={{ fontWeight:600 }}>foto dentro da zona de imagem</strong> — arraste a moldura no preview para mudar o quadro.
                    </div>
                  )}
                  <div>
                    <div style={{
                      fontFamily:'var(--font-mono)',
                      fontSize:10,
                      letterSpacing:'0.06em',
                      fontWeight:600,
                      color:'var(--text-muted)',
                      textTransform:'uppercase',
                      marginBottom:6,
                    }}>Modo da imagem</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                      {IMAGE_MODE_PRESETS.map((m) => {
                        const on = activeImageModePresetId(slide) === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => updateSlide(m.patch)}
                            style={{
                              ...btnStyle(on),
                              flexDirection: 'column',
                              gap: 2,
                              padding: '8px 6px',
                              minHeight: 52,
                              textAlign: 'center',
                            }}
                            aria-label={`${m.label}: ${m.sub}`}
                          >
                            <span style={{ fontSize:11, fontWeight:600, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>{m.label}</span>
                            <span style={{ fontSize:9, fontFamily:'var(--font-ui)', opacity: on ? 0.92 : 1, color: on ? 'rgba(255,255,255,0.92)' : 'var(--text-muted)' }}>{m.sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{
                      fontFamily:'var(--font-mono)',
                      fontSize:10,
                      letterSpacing:'0.06em',
                      fontWeight:600,
                      color:'var(--text-muted)',
                      textTransform:'uppercase',
                      marginBottom:6,
                    }}>Foco no recorte</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                      {LAYOUTS.map((l) => {
                        const active = activeImageFocalLayoutId(slide) === l.id;
                        const [px, py] = IMAGE_FOCAL_XY[l.id];
                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => updateSlide({ bgX: px, bgY: py })}
                            style={{
                              ...btnStyle(active),
                              flexDirection: 'column',
                              gap: 4,
                              padding: '8px 4px 6px',
                              minHeight: 76,
                            }}
                            aria-label={`Foco da imagem ${l.posLab[0]} ${l.posLab[1]}`}
                            title={`Ancorar recorte: ${l.posLab.join(' ')}`}
                          >
                            <ImageFocalMiniIcon layoutId={l.id} active={active} />
                            <span style={{
                              fontSize:8,
                              fontWeight:600,
                              fontFamily:'var(--font-mono)',
                              letterSpacing:'0.04em',
                              lineHeight:1.15,
                              textAlign:'center',
                              color: active ? '#fff' : 'var(--text-muted)',
                            }}>
                              {l.posLab[0]}<br />{l.posLab[1]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Slider label="Posição X fina" value={slide.bgX} min={0} max={100} onChange={v=>updateSlide({bgX:v})}/>
                  <Slider label="Posição Y fina" value={slide.bgY} min={0} max={100} onChange={v=>updateSlide({bgY:v})}/>
                  <Slider
                    label={bgFitKey === 'custom' ? 'Zoom (%)' : 'Escala do recorte'}
                    value={slide.bgZoom}
                    min={50}
                    max={300}
                    onChange={v=>updateSlide({bgZoom:v})}
                  />
                  <Slider label="Overlay escuro" value={slide.overlay} min={0} max={100} onChange={v=>updateSlide({overlay:v})}/>
                  <Slider label="Opacidade" value={slide.bgOpacity} min={0} max={100} onChange={v=>updateSlide({bgOpacity:v})}/>
                  <Toggle label="Espelhar horizontalmente" value={slide.bgMirror} onChange={v=>updateSlide({bgMirror:v})}/>
                </>
              )}
            </S>)}

            {(tab==='imagem'||tab==='slide') && (<S title="Padrão sobre o fundo" hint="Textura discreta por cima da cor e da foto (incluída nas exportações).">
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {BG_PATTERN_OPTIONS.map((opt) => {
                  const on = (slide.bgPattern ?? 'none') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateSlide({ bgPattern: opt.id })}
                      style={{
                        width:'100%',
                        textAlign:'left',
                        padding:'10px 12px',
                        borderRadius:10,
                        cursor:'pointer',
                        border:`1px solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
                        background: on ? 'var(--accent-surface-strong)' : 'var(--bg-card)',
                        fontSize:12,
                        fontWeight:600,
                        fontFamily:'var(--font-ui)',
                        color:'var(--text-primary)',
                        letterSpacing:'-0.011em',
                        transition:'border-color 0.12s, background 0.12s',
                      }}
                    >{opt.label}</button>
                  );
                })}
              </div>
            </S>)}

            {(tab==='layout'||tab==='slide') && (<><details className="vc-adjust-details" style={{ border:'1px solid var(--hairline)', borderRadius:12, background:'var(--bg-card)' }}>
              <summary style={{
                padding:'10px 12px',
                cursor:'pointer',
                display:'flex',
                alignItems:'center',
                justifyContent:'space-between',
                fontFamily:'var(--font-mono)',
                fontSize:10,
                letterSpacing:'0.06em',
                fontWeight:600,
                color:'var(--text-secondary)',
                textTransform:'uppercase',
                userSelect:'none',
              }}>
                Grade de imagens
                <ChevronDown size={14} strokeWidth={2} style={{ opacity:0.45, flexShrink:0 }} aria-hidden />
              </summary>
              <div style={{ padding:'0 12px 12px' }}>
                <Toggle label="Mostrar grade" value={showPreviewAlignGrid} onChange={setShowPreviewAlignGrid} />
                <p style={{
                  margin:'8px 0 0',
                  fontSize:11,
                  lineHeight:1.47,
                  color:'var(--text-muted)',
                  fontFamily:'var(--font-ui)',
                  letterSpacing:'-0.011em',
                }}>
                  Grelha só no preview do editor — não entra nas exportações.
                </p>
              </div>
            </details>

            <details className="vc-adjust-details" open style={{ border:'1px solid var(--hairline)', borderRadius:12, background:'var(--bg-card)' }}>
              <summary style={{
                padding:'10px 12px',
                cursor:'pointer',
                display:'flex',
                alignItems:'center',
                justifyContent:'space-between',
                fontFamily:'var(--font-mono)',
                fontSize:10,
                letterSpacing:'0.06em',
                fontWeight:600,
                color:'var(--text-secondary)',
                textTransform:'uppercase',
                userSelect:'none',
              }}>
                Título & subtítulo
                <ChevronDown size={14} strokeWidth={2} style={{ opacity:0.45, flexShrink:0 }} aria-hidden />
              </summary>
              <div style={{ padding:'0 12px 12px', display:'flex', flexDirection:'column', gap:12 }}>
                {slide.canvas?.enabled && (
                  <div style={{
                    fontSize:11, lineHeight:1.47, letterSpacing:'-0.011em', fontFamily:'var(--font-ui)',
                    color:'var(--text-muted)',
                    background:'var(--bg-pearl)', border:'1px solid var(--hairline)', borderRadius:11,
                    padding:'8px 10px',
                  }}>
                    Com composição ativa, esta grelha afeta o posicionamento <strong style={{ fontWeight:600 }}>dentro</strong>
                    {' '}das zonas de texto do preview (junto com «Distância das bordas»).
                    Para mover o quadro inteiro no card, use o modo edição de zonas no preview e arraste a moldura.
                  </div>
                )}
                <div>
                  <div style={{
                    fontFamily:'var(--font-mono)',
                    fontSize:10,
                    letterSpacing:'0.06em',
                    fontWeight:600,
                    color:'var(--text-muted)',
                    textTransform:'uppercase',
                    marginBottom:6,
                  }}>Layout & posição</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                    {LAYOUTS.map((l) => {
                      const active = slide.layout === l.id;
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => updateSlide({ layout: l.id })}
                          style={{
                            ...btnStyle(active),
                            flexDirection: 'column',
                            gap: 4,
                            padding: '8px 4px 6px',
                            minHeight: 76,
                          }}
                          aria-label={`${l.posLab[0]} ${l.posLab[1]}`}
                          title={`${l.posLab[0]} ${l.posLab[1]}`}
                        >
                          <LayoutMiniIcon layoutId={l.id} active={active} />
                          <span style={{
                            fontSize:8,
                            fontWeight:600,
                            fontFamily:'var(--font-mono)',
                            letterSpacing:'0.04em',
                            lineHeight:1.15,
                            textAlign:'center',
                            color: active ? '#fff' : 'var(--text-muted)',
                          }}>
                            {l.posLab[0]}<br />{l.posLab[1]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div style={{
                    fontFamily:'var(--font-mono)',
                    fontSize:10,
                    letterSpacing:'0.06em',
                    fontWeight:600,
                    color:'var(--text-muted)',
                    textTransform:'uppercase',
                    marginBottom:6,
                  }}>Alinhamento</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:4 }}>
                    {[
                      { id:'left', icon:AlignLeft, title:'Esquerda', short:'ESQ.' },
                      { id:'center', icon:AlignCenter, title:'Centro', short:'CENTRO' },
                      { id:'right', icon:AlignRight, title:'Direita', short:'DIR.' },
                      { id:'justify', icon:AlignJustify, title:'Justificar', short:'JUST.' },
                    ].map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => updateSlide({ align: a.id })}
                        style={{
                          ...btnStyle(slide.align === a.id),
                          flexDirection: 'column',
                          gap: 4,
                          padding: '8px 2px',
                          minHeight: 52,
                        }}
                        title={a.title}
                        aria-label={a.title}
                      >
                        <a.icon size={13} />
                        <span style={{
                          fontSize:8,
                          fontWeight:600,
                          fontFamily:'var(--font-mono)',
                          letterSpacing:'0.03em',
                          color: slide.align === a.id ? '#fff' : 'var(--text-muted)',
                        }}>{a.short}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <Toggle label="Glass ao redor do conteúdo" value={!!slide.textBg} onChange={(v) => updateSlide({ textBg: v })} />
                {slide.textBg && (
                  <Slider label="Opacidade do glass" value={slide.textBgOpacity ?? 55} min={10} max={90} onChange={(v) => updateSlide({ textBgOpacity: v })} />
                )}
                <Slider label="Distância das bordas" value={slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET} min={1} max={20} onChange={(v) => updateSlide({ textInset: v })} />
              </div>
            </details></>)}

            {(tab==='layout'||tab==='slide') && (<S
              title="Ajuste automático"
              hint="Cover e tipografia; com canvas reorganiza foto e todas as zonas de texto em conjunto (largura útil ~6%, espaçamentos entre foto/título/subtítulo ou topo/foto/rodapé) para caber dentro da margem do cartão e evitar cortes."
            >
              <button
                type="button"
                onClick={() => {
                  const p = slideAutoAdjustPatch(slide, { creativePreset, fmt });
                  if (!Object.keys(p).length) {
                    toast?.('Nada urgente a ajustar neste cartão.', 'info');
                    return;
                  }
                  updateSlide(p);
                  const parts = [];
                  if (p.bgFit != null || p.bgX != null || p.bgY != null || p.bgZoom != null) parts.push('foto a preencher a zona (cover)');
                  if (p.canvas) parts.push('zonas normalizadas');
                  if (p.titleSize != null || p.subSize != null || p.bodyAfterSize != null || p.titleLeading != null || p.subLeading != null || p.textInset != null) {
                    parts.push('tipografia calibrada');
                  }
                  if (p.layout != null || p.align != null) parts.push('bloco de texto reposicionado');
                  toast?.(`Ajuste aplicado: ${parts.join(' · ')}.`, 'success');
                }}
                style={{
                  width:'100%', minHeight:40, borderRadius:9999, cursor:'pointer',
                  border:'1px solid var(--accent)',
                  background:'var(--accent)', color:'#fff',
                  fontSize:13, fontWeight:400, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                  transition:'transform 0.1s var(--ease-smooth)',
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <SlidersHorizontal size={15} aria-hidden/>
                Ajuste automático
              </button>
            </S>)}

            {(tab==='texto'||tab==='slide') && (<S title="Tamanho">
              <Slider label="Tamanho título"    value={slide.titleSize} min={50} max={180} onChange={v=>updateSlide({titleSize:v})}/>
              <Slider label="Tamanho subtítulo" value={slide.subSize}   min={50} max={180} onChange={v=>updateSlide({subSize:v})}/>
              {(creativePreset === 'tendencia_cultura' || slide.useCultureLayout || !!(String(slide.bodyAfterImage || '').trim())) ? (
                <Slider
                  label="Tamanho — texto abaixo da foto"
                  value={slide.bodyAfterSize ?? slide.subSize ?? 100}
                  min={50}
                  max={180}
                  onChange={(v) => updateSlide({ bodyAfterSize: v })}
                />
              ) : null}
            </S>)}

            {(tab==='texto'||tab==='slide') && (<S title="Estilo do título" hint="Peso e caixa são os controles primários. Tracking/leading em «Ajustes avançados».">
              <div>
                <label className="vc-label-sm">
                  Peso da fonte
                </label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:4 }}>
                  {[400, 600, 700, 800].map(w => (
                    <button key={w} onClick={()=>updateSlide({titleWeight:w})}
                      style={{
                        padding:'7px 0', borderRadius:6, fontSize:11, cursor:'pointer',
                        fontWeight:w, fontFamily: effectiveTitleFontFamily(brand), transition:'all 0.12s',
                        background: (slide.titleWeight ?? 800) === w ? 'var(--text-primary)' : 'var(--bg-card)',
                        border: `1px solid ${(slide.titleWeight ?? 800) === w ? 'transparent' : 'var(--border)'}`,
                        color:    (slide.titleWeight ?? 800) === w ? 'var(--bg-base)'  : 'var(--text-secondary)',
                      }}
                    >{w}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="vc-label-sm">
                  Caixa
                </label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                  {[
                    { id:'normal', label:'Normal' },
                    { id:'upper',  label:'AaA → AAA' },
                    { id:'lower',  label:'AaA → aaa' },
                  ].map(c => (
                    <button key={c.id} onClick={()=>updateSlide({titleCase:c.id})}
                      style={{
                        padding:'7px 4px', borderRadius:6, fontSize:10, cursor:'pointer',
                        fontWeight:600, fontFamily:'var(--font-ui)', transition:'all 0.12s',
                        background: (slide.titleCase ?? 'normal') === c.id ? 'var(--text-primary)' : 'var(--bg-card)',
                        border: `1px solid ${(slide.titleCase ?? 'normal') === c.id ? 'transparent' : 'var(--border)'}`,
                        color:    (slide.titleCase ?? 'normal') === c.id ? 'var(--bg-base)'  : 'var(--text-secondary)',
                      }}
                    >{c.label}</button>
                  ))}
                </div>
              </div>
              {/* Ajustes avançados: tracking + leading do título.
                  Escondidos por default — reduz cognitive overload no
                  domínio Texto (90% dos users não vão mexer aqui). */}
              <details className="vc-adjust-details" style={{ marginTop:6, border:'1px solid var(--hairline)', borderRadius:11, background:'var(--bg-pearl)' }}>
                <summary style={{
                  padding:'10px 12px', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.06em',
                  fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase',
                  userSelect:'none',
                }}>
                  Ajustes avançados (título)
                  <ChevronDown size={14} strokeWidth={2} style={{ opacity:0.45, flexShrink:0 }} aria-hidden/>
                </summary>
                <div style={{ padding:'0 12px 12px' }}>
                  <Slider label="Entre letras (tracking)" value={slide.titleTracking ?? 0} min={-10} max={30} onChange={v=>updateSlide({titleTracking:v})}/>
                  <Slider label="Entre linhas (leading)"  value={slide.titleLeading ?? 105} min={80} max={180} onChange={v=>updateSlide({titleLeading:v})}/>
                </div>
              </details>
            </S>)}

            {/* Subtítulo: tracking/leading também vão atrás de details
                (são ajustes finos, não primary controls). */}
            {(tab==='texto'||tab==='slide') && (<S title="Estilo do subtítulo" hint="Ajustes finos de espaçamento em «Ajustes avançados».">
              <details className="vc-adjust-details" style={{ border:'1px solid var(--hairline)', borderRadius:11, background:'var(--bg-pearl)' }}>
                <summary style={{
                  padding:'10px 12px', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.06em',
                  fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase',
                  userSelect:'none',
                }}>
                  Ajustes avançados (subtítulo)
                  <ChevronDown size={14} strokeWidth={2} style={{ opacity:0.45, flexShrink:0 }} aria-hidden/>
                </summary>
                <div style={{ padding:'0 12px 12px' }}>
                  <Slider label="Entre letras (tracking)" value={slide.subTracking ?? 0} min={-10} max={30} onChange={v=>updateSlide({subTracking:v})}/>
                  <Slider label="Entre linhas (leading)"  value={slide.subLeading ?? 150} min={100} max={220} onChange={v=>updateSlide({subLeading:v})}/>
                </div>
              </details>
            </S>)}

            {(tab==='texto'||tab==='slide') && (<S title="Legibilidade">
              <Toggle label="Sombra no texto" value={slide.textShadow!==false} onChange={v=>updateSlide({textShadow:v})}/>
              <div style={{ marginTop:10, paddingTop:12, borderTop:'1px solid var(--hairline)' }}>
                <button
                  type="button"
                  disabled={!applyTypographyToAllCards || slides.length <= 1}
                  onClick={() => applyTypographyToAllCards?.()}
                  title={slides.length <= 1 ? 'Precisa de pelo menos dois cards' : 'Copia tamanhos, espaçamento e legibilidade para todos os slides'}
                  aria-label="Aplicar tipografia deste card a todos os slides"
                  style={{
                    width:'100%', minHeight:44,
                    padding:'0 16px',
                    borderRadius:9999,
                    border:'1px solid var(--accent)',
                    background:'var(--accent)',
                    color:'#fff',
                    fontSize:12,
                    fontWeight:600,
                    fontFamily:'var(--font-ui)',
                    letterSpacing:'-0.011em',
                    cursor: (!applyTypographyToAllCards || slides.length <= 1) ? 'not-allowed' : 'pointer',
                    opacity: (!applyTypographyToAllCards || slides.length <= 1) ? 0.45 : 1,
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    gap:8,
                    transition:'transform 0.1s var(--ease-smooth), opacity 0.12s',
                  }}
                  onMouseDown={e => { if (slides.length > 1 && applyTypographyToAllCards) e.currentTarget.style.transform = 'scale(0.95)'; }}
                  onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <Layers size={14} strokeWidth={2}/>
                  Aplicar em todos os cards
                </button>
                <p style={{
                  margin:'8px 0 0',
                  fontSize:11,
                  lineHeight:1.47,
                  letterSpacing:'-0.011em',
                  color:'var(--text-muted)',
                }}>
                  Usa os ajustes de <strong style={{ fontWeight:600, color:'var(--text-secondary)' }}>Tamanho</strong>,{' '}
                  <strong style={{ fontWeight:600, color:'var(--text-secondary)' }}>Espaçamento</strong>,
                  {' '}<strong style={{ fontWeight:600, color:'var(--text-secondary)' }}>Título &amp; subtítulo</strong>{' '}
                  e <strong style={{ fontWeight:600, color:'var(--text-secondary)' }}>Legibilidade</strong> deste card em todos os slides (não altera textos nem posição no grid).
                </p>
              </div>
            </S>)}

            {(tab==='layout'||tab==='slide') && (() => {
              const movidos = MOVABLE_ELEMENTS.filter((e) => hasElementOffset(slide, e.key));
              return (
                <S
                  title="Posição livre"
                  hint="Clique no meio de qualquer elemento do card e arraste. Vale para texto, foto, barra editorial, selo e ornamentos."
                >
                  {movidos.length ? (
                    <>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {movidos.map((e) => (
                          <button
                            key={e.key}
                            type="button"
                            onClick={() => updateSlide(resetElementOffsetsPatch(slide, e.key))}
                            title={`Repor ${e.label.toLowerCase()} no lugar do layout`}
                            style={{
                              display:'inline-flex', alignItems:'center', gap:5,
                              fontSize:11, padding:'6px 10px', borderRadius:9999,
                              border:'1px solid var(--hairline)', background:'var(--bg-card)',
                              color:'var(--text-secondary)', fontFamily:'var(--font-ui)',
                              cursor:'pointer', letterSpacing:'-0.011em',
                            }}
                          >
                            {e.label}<X size={10} aria-hidden/>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => updateSlide(resetElementOffsetsPatch(slide))}
                        style={{
                          alignSelf:'flex-start', fontSize:11, padding:'7px 14px',
                          borderRadius:9999, border:'1px solid var(--hairline)',
                          background:'var(--bg-card)', color:'var(--text-secondary)',
                          fontFamily:'var(--font-ui)', fontWeight:600, cursor:'pointer',
                        }}
                      >
                        Repor tudo
                      </button>
                    </>
                  ) : (
                    <p style={{ fontSize:11, color:'var(--text-muted)', margin:0, lineHeight:1.5, fontFamily:'var(--font-ui)' }}>
                      Nada foi movido neste card. Arraste um elemento na pré-visualização
                      e ele aparece aqui para repor.
                    </p>
                  )}
                </S>
              );
            })()}

            {(tab==='layout'||tab==='slide') && (<S title="Operações">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[
                  { label:'Duplicar', icon:Copy, action:()=>duplicateSlide(activeIdx), disabled:false },
                  { label:'Apagar', icon:Trash2, action:()=>deleteSlide(activeIdx), disabled:slides.length<=1, danger:true },
                  { label:'Subir', icon:ArrowUp, action:()=>moveSlide(activeIdx,-1), disabled:activeIdx===0 },
                  { label:'Descer', icon:ArrowDown, action:()=>moveSlide(activeIdx,1), disabled:activeIdx===slides.length-1 },
                ].map(({label,icon:Icon,action,disabled,danger})=>(
                  <button key={label} onClick={action} disabled={disabled} style={{
                    background:'var(--bg-card)', border:'1px solid var(--border)',
                    borderRadius:8, padding:'8px 0', cursor:disabled?'not-allowed':'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    fontSize:11, fontWeight:600, fontFamily:'var(--font-ui)',
                    color: disabled ? 'var(--text-muted)' : danger ? '#f87171' : 'var(--text-secondary)',
                    opacity: disabled ? 0.35 : 1, transition:'all 0.12s',
                  }}
                  onMouseEnter={e=>{ if(!disabled) e.currentTarget.style.color = danger ? '#ef4444' : 'var(--text-primary)'; }}
                  onMouseLeave={e=>{ if(!disabled) e.currentTarget.style.color = danger ? '#f87171' : 'var(--text-secondary)'; }}
                  >
                    <Icon size={11}/>{label}
                  </button>
                ))}
              </div>
            </S>)}
          </>
        )}

        {/* Visual (FASE 1 Narrative OS): domínio dedicado ao mood/estética.
            Padrão Visual ganha protagonismo aqui — era enterrado na Marca. */}
        {tab==='visual' && (
          <>
            <div style={{
              padding:'4px 0 8px',
              fontSize:13, color:'var(--text-secondary)',
              fontFamily:'var(--font-ui)', letterSpacing:'-0.011em', lineHeight:1.5,
            }}>
              <strong style={{ color:'var(--text-primary)' }}>Escolha um padrão visual.</strong>
              {' '}Paleta, fontes e tipografia mudam de uma vez.
              Cada estilo tem uma assinatura própria (header bar, pill, ornaments…).
            </div>
            <VisualStylePicker
              value={visualPreset}
              onChange={applyVisualPresetCb}
              presets={VISUAL_PRESETS}
              title=""
            />
          </>
        )}

        {/* FASE 1 final + 6 domínios: outer cobre brand+visual+texto.
            Marca = identidade pura, Visual = mood/paletas, Texto = fontes. */}
        {(tab==='brand' || tab==='visual' || tab==='texto') && (
          <>
            {/* Switcher de perfis de marca — útil pra freelance/agência alternar entre clientes */}
            {tab==='brand' && setBrandsOpen && (
              <S title="Perfis de marca" hint="Salve combinações completas (cores, fontes, logo, bio, tom) e troque entre clientes/projetos com 1 clique.">
                <button
                  onClick={() => setBrandsOpen(true)}
                  style={{
                    width:'100%', padding:'10px 12px', borderRadius:9, cursor:'pointer',
                    background:'var(--bg-card)', border:'1px solid var(--border)',
                    display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
                    transition:'all 0.12s',
                  }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                    <div style={{ display:'flex', gap:2, flexShrink:0 }}>
                      {(() => {
                        const sw = hydrateBrandTextColors(brand);
                        return [brand.bg, brand.titleColor, sw.subtitleColor, sw.textColor, brand.accent];
                      })().map((c,i)=>(
                        <div key={i} style={{ width:14, height:14, borderRadius:3, background:c, border:'1px solid rgba(255,255,255,0.08)' }}/>
                      ))}
                    </div>
                    <div style={{ textAlign:'left', minWidth:0, flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {brandRoster.find(b => b.id === activeBrandId)?.name || 'Perfil personalizado'}
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.04em' }}>
                        {brandRoster.length} {brandRoster.length === 1 ? 'perfil' : 'perfis'} salvos
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={13} color="var(--text-muted)"/>
                </button>
              </S>
            )}

            {/* Padrão Visual migrado pra aba Visual (FASE 1 Narrative OS).
                Marca agora foca em identidade pura: logo, handle, bio, tom. */}

            {tab==='texto' && (<S title="Texto nos slides" hint="Padrão da marca para tamanho, tracking e peso. Cards novos herdam; ajustes finos por card continuam em Cards.">
              <div>
                <div style={{
                  fontFamily:'var(--font-mono)',
                  fontSize:10,
                  letterSpacing:'0.06em',
                  fontWeight:600,
                  color:'var(--text-muted)',
                  textTransform:'uppercase',
                  marginBottom:6,
                }}>Tamanho</div>
                <Slider label="Tamanho título" value={brand.textTitleSize ?? 100} min={50} max={180} onChange={v => setBrand({ ...brand, textTitleSize: v })} />
                <Slider label="Tamanho subtítulo" value={brand.textSubSize ?? 100} min={50} max={180} onChange={v => setBrand({ ...brand, textSubSize: v })} />
                {(creativePreset === 'tendencia_cultura' || slides.some((s) => s.useCultureLayout || !!(String(s.bodyAfterImage || '').trim()))) ? (
                  <Slider
                    label="Tamanho — texto abaixo da foto"
                    value={brand.textBodyAfterSize ?? brand.textSubSize ?? 100}
                    min={50}
                    max={180}
                    onChange={(v) => setBrand({ ...brand, textBodyAfterSize: v })}
                  />
                ) : null}
              </div>
              <div style={{ marginTop: 4 }}>
                <div style={{
                  fontFamily:'var(--font-mono)',
                  fontSize:10,
                  letterSpacing:'0.06em',
                  fontWeight:600,
                  color:'var(--text-muted)',
                  textTransform:'uppercase',
                  marginBottom:6,
                }}>Espaçamento — Título</div>
                <Slider label="Entre letras (tracking)" value={brand.textTitleTracking ?? 0} min={-10} max={30} onChange={v => setBrand({ ...brand, textTitleTracking: v })} />
                <Slider label="Entre linhas (leading)" value={brand.textTitleLeading ?? 105} min={80} max={180} onChange={v => setBrand({ ...brand, textTitleLeading: v })} />
                <div>
                  <label className="vc-label-sm">Peso da fonte</label>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:4 }}>
                    {[400, 600, 700, 800].map(w => (
                      <button key={w} type="button" onClick={()=>setBrand({ ...brand, textTitleWeight: w })}
                        style={{
                          padding:'7px 0', borderRadius:6, fontSize:11, cursor:'pointer',
                          fontWeight:w, fontFamily: effectiveTitleFontFamily(brand), transition:'all 0.12s',
                          background: (brand.textTitleWeight ?? 800) === w ? 'var(--text-primary)' : 'var(--bg-card)',
                          border: `1px solid ${(brand.textTitleWeight ?? 800) === w ? 'transparent' : 'var(--border)'}`,
                          color:    (brand.textTitleWeight ?? 800) === w ? 'var(--bg-base)'  : 'var(--text-secondary)',
                        }}
                      >{w}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="vc-label-sm">Caixa do título</label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                    {[
                      // Preview-as-label: cada botão mostra "Ab" renderizado no caso real
                      // — usuário vê o efeito antes de clicar. CSS textTransform faz o resto.
                      { id:'normal', label:'Aa',   title:'Como digitado (Title case)',  cssCase:'none',      hint:'Como digitado' },
                      { id:'upper',  label:'Aa',   title:'Tudo MAIÚSCULO',              cssCase:'uppercase', hint:'MAIÚSCULAS' },
                      { id:'lower',  label:'Aa',   title:'tudo minúsculo',              cssCase:'lowercase', hint:'minúsculas' },
                    ].map(c => {
                      const on = (brand.textTitleCase ?? 'normal') === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={()=>setBrand({ ...brand, textTitleCase: c.id })}
                          title={c.title}
                          aria-label={c.title}
                          aria-pressed={on}
                          style={{
                            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                            gap:2, padding:'8px 4px', borderRadius:8, cursor:'pointer',
                            fontFamily:'var(--font-ui)', transition:'all 0.12s',
                            background: on ? 'var(--text-primary)' : 'var(--bg-card)',
                            border: `1px solid ${on ? 'transparent' : 'var(--border)'}`,
                            color:    on ? 'var(--bg-base)' : 'var(--text-secondary)',
                          }}
                        >
                          {/* Preview tipográfico — o "Aa" é renderizado no caso real */}
                          <span style={{
                            fontSize:16, fontWeight:700, lineHeight:1, letterSpacing:'-0.02em',
                            textTransform: c.cssCase,
                          }}>{c.label}</span>
                          <span style={{
                            fontSize:9, fontFamily:'var(--font-mono)',
                            letterSpacing:'0.04em', textTransform:'uppercase',
                            opacity: on ? 0.85 : 0.6,
                          }}>{c.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 4 }}>
                <div style={{
                  fontFamily:'var(--font-mono)',
                  fontSize:10,
                  letterSpacing:'0.06em',
                  fontWeight:600,
                  color:'var(--text-muted)',
                  textTransform:'uppercase',
                  marginBottom:6,
                }}>Espaçamento — Subtítulo</div>
                <Slider label="Entre letras (tracking)" value={brand.textSubTracking ?? 0} min={-10} max={30} onChange={v => setBrand({ ...brand, textSubTracking: v })} />
                <Slider label="Entre linhas (leading)" value={brand.textSubLeading ?? 150} min={100} max={220} onChange={v => setBrand({ ...brand, textSubLeading: v })} />
              </div>
              <div style={{ marginTop:10, paddingTop:12, borderTop:'1px solid var(--hairline)' }}>
                <button
                  type="button"
                  onClick={() => applyBrandTypographyToAllSlides?.()}
                  aria-label="Aplicar tipografia da marca a todos os slides"
                  style={{
                    width:'100%', minHeight:44,
                    padding:'0 16px',
                    borderRadius:9999,
                    border:'1px solid var(--accent)',
                    background:'var(--accent)',
                    color:'#fff',
                    fontSize:12,
                    fontWeight:600,
                    fontFamily:'var(--font-ui)',
                    letterSpacing:'-0.011em',
                    cursor:'pointer',
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    gap:8,
                    transition:'transform 0.1s var(--ease-smooth)',
                  }}
                  onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                  onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <Layers size={14} strokeWidth={2}/>
                  Aplicar tipografia a todos os slides
                </button>
                <p style={{
                  margin:'8px 0 0',
                  fontSize:11,
                  lineHeight:1.47,
                  letterSpacing:'-0.011em',
                  color:'var(--text-muted)',
                }}>
                  Não altera textos nem layout — só copia os valores acima para cada card (como em Cards → Legibilidade → Aplicar em todos).
                </p>
              </div>
            </S>)}

            {tab==='brand' && (<S title="Perfil Instagram" hint="A foto do perfil aparece no círculo colorido ao lado do @ nos cards (aba Marca).">
              <div>
                <label className="vc-label-sm">@ Username</label>
                <input
                  value={brand.handle || ''}
                  onChange={e=>setBrand({...brand,handle:e.target.value})}
                  placeholder="@seuperfil"
                  className="vc-input"
                />
              </div>
              <Toggle label="Mostrar @ nos slides" value={brand.showHandle} onChange={v=>setBrand({...brand,showHandle:v})}/>
              <details
                className="vc-adjust-details"
                style={{
                  marginTop: 10,
                  border: '1px solid var(--hairline)',
                  borderRadius: 11,
                  background: 'var(--bg-pearl)',
                }}
              >
                <summary style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  userSelect: 'none',
                }}>
                  Posição do @ no card
                  <ChevronDown size={14} strokeWidth={2} style={{ opacity: 0.45, flexShrink: 0 }} aria-hidden />
                </summary>
                <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.45, margin: 0, fontFamily: 'var(--font-ui)' }}>
                    Percentagem da largura e da altura do cartão — referência no canto superior esquerdo da pílula. Pode alinhar ao texto ou ao fundo.
                  </p>
                  <Slider label="Da esquerda (%)" value={brand.handleBadgeX ?? 5} min={0} max={100} onChange={(v) => setBrand({ ...brand, handleBadgeX: v })} />
                  <Slider label="Do topo (%)" value={brand.handleBadgeY ?? 4} min={0} max={100} onChange={(v) => setBrand({ ...brand, handleBadgeY: v })} />
                  <button
                    type="button"
                    onClick={() => setBrand({ ...brand, handleBadgeX: 5, handleBadgeY: 4 })}
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: 2,
                      fontSize: 11,
                      padding: '7px 14px',
                      borderRadius: 9999,
                      border: '1px solid var(--hairline)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-ui)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      letterSpacing: '-0.011em',
                    }}
                  >
                    Repor posição padrão
                  </button>
                </div>
              </details>
              <div style={{ marginTop: 10 }}>
                <label className="vc-label-sm">Foto no ícone do @</label>
                {brand.handleAvatar ? (
                  <>
                  <div style={{
                    display:'flex', alignItems:'center', gap:10,
                    background:'var(--bg-card)', border:'1px solid var(--border)',
                    borderRadius:9, padding:10, marginTop:4,
                  }}>
                    <div style={{
                      width:48, height:48, borderRadius:'50%', flexShrink:0,
                      overflow:'hidden',
                      border:'2px solid var(--hairline)',
                      background:`conic-gradient(from 45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)`,
                      padding:2, boxSizing:'border-box',
                    }}>
                    <div style={{
                      width:'100%', height:'100%', borderRadius:'50%', overflow:'hidden',
                      background:'#0a0a0a',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <img
                        src={brand.handleAvatar}
                        alt=""
                        draggable={false}
                        style={vcHandleAvatarImgStyle(brand)}
                      />
                    </div>
                  </div>
                    <div style={{ flex:1, fontSize:11, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', lineHeight:1.45 }}>
                      Aparece dentro do anel do badge nos cards.
                    </div>
                    <button
                      type="button"
                      onClick={() => setBrand({
                        ...brand,
                        handleAvatar: null,
                        handleAvatarPosX: 50,
                        handleAvatarPosY: 50,
                        handleAvatarRotate: 0,
                        handleAvatarZoom: 100,
                      })}
                      aria-label="Remover foto do perfil" title="Remover foto do perfil"
                      style={{ width:30, height:30, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                    >
                      <Trash2 size={11}/>
                    </button>
                  </div>
                  <details
                    className="vc-adjust-details"
                    open
                    style={{
                      marginTop: 10,
                      border: '1px solid var(--hairline)',
                      borderRadius: 11,
                      background: 'var(--bg-pearl)',
                    }}
                  >
                    <summary style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.06em',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      userSelect: 'none',
                    }}>
                      Enquadramento 360° no círculo
                      <ChevronDown size={14} strokeWidth={2} style={{ opacity: 0.45, flexShrink: 0 }} aria-hidden />
                    </summary>
                    <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.45, margin: 0, fontFamily: 'var(--font-ui)' }}>
                        Posição, rotação e zoom valem só para a foto dentro do anel do @ nos cards.
                      </p>
                      <Slider label="Esquerda → direita" value={brand.handleAvatarPosX ?? 50} min={0} max={100} onChange={(v) => setBrand({ ...brand, handleAvatarPosX: v })} />
                      <Slider label="Topo → base" value={brand.handleAvatarPosY ?? 50} min={0} max={100} onChange={(v) => setBrand({ ...brand, handleAvatarPosY: v })} />
                      <Slider label="Rotação (°)" value={brand.handleAvatarRotate ?? 0} min={0} max={360} onChange={(v) => setBrand({ ...brand, handleAvatarRotate: v })} />
                      <Slider label="Zoom no círculo" value={brand.handleAvatarZoom ?? 100} min={85} max={200} onChange={(v) => setBrand({ ...brand, handleAvatarZoom: v })} />
                      <button
                        type="button"
                        onClick={() => setBrand({
                          ...brand,
                          handleAvatarPosX: 50,
                          handleAvatarPosY: 50,
                          handleAvatarRotate: 0,
                          handleAvatarZoom: 100,
                        })}
                        style={{
                          alignSelf: 'flex-start',
                          marginTop: 2,
                          fontSize: 11,
                          padding: '7px 14px',
                          borderRadius: 9999,
                          border: '1px solid var(--hairline)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-secondary)',
                          fontFamily: 'var(--font-ui)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          letterSpacing: '-0.011em',
                        }}
                      >
                        Repor enquadramento
                      </button>
                    </div>
                  </details>
                  </>
                ) : (
                  // Drop-zone do avatar do @: borda sólida hairline, ícone num
                  // círculo accent-surface; hover puxa fundo accent-surface sem
                  // mudar borda pra accent (evita o "tracejado vermelho" agressivo).
                  <label
                    style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'12px 14px', minHeight:60, borderRadius:11,
                      cursor:'pointer', marginTop:6,
                      background:'var(--bg-card)', border:'1px solid var(--hairline)',
                      color:'var(--text-secondary)',
                      fontFamily:'var(--font-ui)',
                      transition:'background-color 0.15s var(--ease-smooth), border-color 0.15s var(--ease-smooth)',
                    }}
                    onMouseEnter={e=>{
                      e.currentTarget.style.borderColor='var(--accent)';
                      e.currentTarget.style.background='var(--accent-surface)';
                    }}
                    onMouseLeave={e=>{
                      e.currentTarget.style.borderColor='var(--hairline)';
                      e.currentTarget.style.background='var(--bg-card)';
                    }}
                  >
                    {/* Mesmo placeholder que o card usa sem foto: o anel do
                        Instagram com o emoji dentro, para o painel mostrar o
                        que sai impresso. */}
                    <span style={{
                      width:36, height:36, borderRadius:'50%', flexShrink:0,
                      background:'conic-gradient(from 45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
                      padding:2, boxSizing:'border-box',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }} aria-hidden>
                      <span style={{
                        width:'100%', height:'100%', borderRadius:'50%',
                        background:'var(--bg-elevated)', fontSize:15, lineHeight:1,
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>📷</span>
                    </span>
                    <span style={{ display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:0 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em', lineHeight:1.3 }}>
                        Carregar foto de perfil
                      </span>
                      <span style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:'-0.005em' }}>
                        Sem foto, os cards mostram 📷 · PNG · JPG · WebP até 2&nbsp;MB
                      </span>
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display:'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) {
                          toast?.('Imagem muito grande. Máximo 2MB.', 'error');
                          e.target.value = '';
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => setBrand({ ...brand, handleAvatar: reader.result });
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            </S>)}

            {tab==='brand' && (
              <S
                title="Barra editorial (topo)"
                hint="Faixa fina no topo do card. Vem preenchida pelos padrões visuais — aqui você troca por texto seu. Deixe vazio para esconder."
              >
                <div>
                  <label className="vc-label-sm">Esquerda</label>
                  <input
                    value={brand.cultureHeaderLeft ?? ''}
                    onChange={e=>setBrand({ ...brand, cultureHeaderLeft: e.target.value })}
                    className="vc-input"
                    placeholder="@seuperfil"
                    style={{ fontSize:12 }}
                  />
                </div>
                <div>
                  <label className="vc-label-sm">Centro</label>
                  <input
                    value={brand.cultureHeaderCenter ?? ''}
                    onChange={e=>setBrand({ ...brand, cultureHeaderCenter: e.target.value })}
                    className="vc-input"
                    placeholder="Sua categoria"
                    style={{ fontSize:12 }}
                  />
                </div>
                <div>
                  <label className="vc-label-sm">Direita (ano)</label>
                  <input
                    value={brand.cultureHeaderYear ?? ''}
                    onChange={e=>setBrand({ ...brand, cultureHeaderYear: e.target.value })}
                    className="vc-input"
                    placeholder="2026"
                    style={{ fontSize:12 }}
                  />
                </div>
              </S>
            )}

            {tab==='brand' && (
              <S
                title="Selo do rodapé (pill)"
                hint="Cápsula centrada na base do card — CTA, hashtag ou handle. Vazio esconde."
              >
                <div>
                  <label className="vc-label-sm">Texto</label>
                  <input
                    value={brand.footerPillText ?? ''}
                    onChange={e=>setBrand({ ...brand, footerPillText: e.target.value })}
                    className="vc-input"
                    placeholder="#suahashtag"
                    style={{ fontSize:12 }}
                  />
                </div>
                {String(brand.footerPillText || '').trim() ? (
                  <>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <div>
                        <label className="vc-label-sm">Fundo</label>
                        <input
                          type="color"
                          value={brand.footerPillBg || brand.accent || '#0a0a0a'}
                          onChange={e=>setBrand({ ...brand, footerPillBg: e.target.value })}
                          aria-label="Cor de fundo do selo"
                          style={{ width:'100%', height:32, padding:0, border:'1px solid var(--border)', borderRadius:6, background:'none', cursor:'pointer' }}
                        />
                      </div>
                      <div>
                        <label className="vc-label-sm">Texto</label>
                        <input
                          type="color"
                          value={brand.footerPillFg || '#ffffff'}
                          onChange={e=>setBrand({ ...brand, footerPillFg: e.target.value })}
                          aria-label="Cor do texto do selo"
                          style={{ width:'100%', height:32, padding:0, border:'1px solid var(--border)', borderRadius:6, background:'none', cursor:'pointer' }}
                        />
                      </div>
                    </div>
                    <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text-secondary)', cursor:'pointer' }}>
                      <input
                        type="checkbox"
                        checked={brand.footerPillArrow !== false}
                        onChange={e=>setBrand({ ...brand, footerPillArrow: e.target.checked })}
                      />
                      Mostrar seta circular
                    </label>
                  </>
                ) : null}
              </S>
            )}

            {tab==='brand' && (
              <S
                title="Barra do rodapé (3 colunas)"
                hint="Rodapé estilo ficha técnica. Use «rótulo|valor» para duas linhas — ex.: «Tema|Growth». Vazio esconde a coluna."
              >
                {[
                  ['footerBarLeft', 'Esquerda', 'Tema|Growth'],
                  ['footerBarCenter', 'Centro', 'Por|@seuperfil'],
                  ['footerBarRight', 'Direita', 'Salve|↓'],
                ].map(([campo, rotulo, exemplo]) => (
                  <div key={campo}>
                    <label className="vc-label-sm">{rotulo}</label>
                    <input
                      value={brand[campo] ?? ''}
                      onChange={e=>setBrand({ ...brand, [campo]: e.target.value })}
                      className="vc-input"
                      placeholder={exemplo}
                      style={{ fontSize:12 }}
                    />
                  </div>
                ))}
              </S>
            )}

            {tab==='brand' && (
              <S title="Ornamentos" hint="Detalhes de assinatura que os padrões visuais ligam ou desligam.">
                {[
                  ['showStarOrnament', 'Estrela de 8 pontas acima do título', false],
                  ['showPageBadge', 'Contador N/M no canto superior', false],
                  ['subtitleVisible', 'Mostrar subtítulo', true],
                ].map(([campo, rotulo, padrao]) => (
                  <label key={campo} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text-secondary)', cursor:'pointer' }}>
                    <input
                      type="checkbox"
                      checked={brand[campo] ?? padrao}
                      onChange={e=>setBrand({ ...brand, [campo]: e.target.checked })}
                    />
                    {rotulo}
                  </label>
                ))}
              </S>
            )}

            {tab==='brand' && (<S title="Logo da marca" hint="Aplicado automaticamente em todos os cards. PNG transparente é o ideal.">
              {brand.logo ? (
                <div style={{
                  display:'flex', alignItems:'center', gap:10,
                  background:'var(--bg-card)', border:'1px solid var(--border)',
                  borderRadius:9, padding:10,
                }}>
                  <div style={{
                    width:54, height:54, borderRadius:6, flexShrink:0,
                    background:`url(${brand.logo}) center/contain no-repeat`,
                    border:'1px solid var(--border)',
                    backgroundColor:'rgba(255,255,255,0.04)',
                  }}/>
                  <div style={{ flex:1, fontSize:11, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', lineHeight:1.45 }}>
                    Logo aplicada · canto {{ tl:'sup. esquerdo', tr:'sup. direito', bl:'inf. esquerdo', br:'inf. direito' }[brand.logoPosition || 'tr']}
                  </div>
                  <button
                    onClick={() => setBrand({ ...brand, logo: null })}
                    aria-label="Remover logo" title="Remover logo"
                    style={{ width:30, height:30, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                  >
                    <Trash2 size={11}/>
                  </button>
                </div>
              ) : (
                // Mesmo padrão drop-zone do avatar: borda sólida hairline,
                // ícone num círculo accent, hover = fundo accent-surface.
                <label
                  style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'12px 14px', minHeight:60, borderRadius:11,
                    cursor:'pointer',
                    background:'var(--bg-card)', border:'1px solid var(--hairline)',
                    color:'var(--text-secondary)',
                    fontFamily:'var(--font-ui)',
                    transition:'background-color 0.15s var(--ease-smooth), border-color 0.15s var(--ease-smooth)',
                  }}
                  onMouseEnter={e=>{
                    e.currentTarget.style.borderColor='var(--accent)';
                    e.currentTarget.style.background='var(--accent-surface)';
                  }}
                  onMouseLeave={e=>{
                    e.currentTarget.style.borderColor='var(--hairline)';
                    e.currentTarget.style.background='var(--bg-card)';
                  }}
                >
                  <span style={{
                    width:32, height:32, borderRadius:'50%', flexShrink:0,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background:'var(--accent-surface)', color:'var(--accent)',
                  }} aria-hidden>
                    <Upload size={14} strokeWidth={2.25}/>
                  </span>
                  <span style={{ display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:0 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em', lineHeight:1.3 }}>
                      Carregar logo da marca
                    </span>
                    <span style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:'-0.005em' }}>
                      PNG · JPG · SVG — até 2&nbsp;MB (PNG transparente é o ideal)
                    </span>
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    style={{ display:'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) {
                        toast?.('Imagem muito grande. Máximo 2MB.', 'error');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => setBrand({ ...brand, logo: reader.result });
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
              {brand.logo && (
                <>
                  <div>
                    <label className="vc-label-sm">Posição</label>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4 }}>
                      {[
                        { id:'tl', label:'↖' },
                        { id:'tr', label:'↗' },
                        { id:'bl', label:'↙' },
                        { id:'br', label:'↘' },
                      ].map(p => {
                        const on = (brand.logoPosition || 'tr') === p.id;
                        return (
                          <button key={p.id} onClick={()=>setBrand({...brand, logoPosition: p.id})}
                            style={{
                              padding:'8px 0', borderRadius:6, fontSize:14, cursor:'pointer',
                              background: on ? 'var(--text-primary)' : 'var(--bg-card)',
                              border: `1px solid ${on ? 'transparent' : 'var(--border)'}`,
                              color: on ? 'var(--bg-base)' : 'var(--text-secondary)',
                              fontWeight:700,
                            }}
                          >{p.label}</button>
                        );
                      })}
                    </div>
                  </div>
                  <Slider label="Tamanho da logo" value={brand.logoSize ?? 30} min={20} max={80} onChange={v=>setBrand({...brand, logoSize: v})}/>
                  <Slider label="Opacidade" value={brand.logoOpacity ?? 90} min={20} max={100} onChange={v=>setBrand({...brand, logoOpacity: v})}/>
                </>
              )}
            </S>)}

            {tab==='brand' && (<S title="Identidade verbal" hint="Esses campos viram contexto da IA em toda geração — quanto mais preciso, mais consistente o carrossel fica.">
              <div>
                <label className="vc-label-sm">Bio / o que faço</label>
                <textarea
                  value={brand.bio || ''} onChange={e=>setBrand({...brand,bio:e.target.value})} rows={2}
                  placeholder="Ex: Estrategista de marca para indústria estética. Decodifico mercado e marcas."
                  className="vc-input vc-textarea" style={{ resize:'vertical', minHeight:54 }}
                />
              </div>
              <div>
                <label className="vc-label-sm">Posicionamento</label>
                <textarea
                  value={brand.positioning || ''} onChange={e=>setBrand({...brand,positioning:e.target.value})} rows={2}
                  placeholder="Ex: Conteúdo estratégico, sem motivacional. Dois passos à frente do óbvio."
                  className="vc-input vc-textarea" style={{ resize:'vertical', minHeight:54 }}
                />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div>
                  <label className="vc-label-sm">Tom padrão</label>
                  <input
                    value={brand.defaultTone || ''} onChange={e=>setBrand({...brand,defaultTone:e.target.value})}
                    placeholder="Ex: direto, provocativo"
                    className="vc-input"
                  />
                </div>
                <div>
                  <label className="vc-label-sm">Público</label>
                  <input
                    value={brand.defaultAudience || ''} onChange={e=>setBrand({...brand,defaultAudience:e.target.value})}
                    placeholder="Ex: empreendedores"
                    className="vc-input"
                  />
                </div>
              </div>
              <div>
                <label className="vc-label-sm">Assinatura / CTA recorrente</label>
                <input
                  value={brand.signature || ''} onChange={e=>setBrand({...brand,signature:e.target.value})}
                  placeholder='Ex: "Salve para revisar antes da próxima campanha."'
                  className="vc-input"
                />
              </div>
              <div>
                <label className="vc-label-sm">Links / site / portfolio</label>
                <input
                  value={brand.links || ''} onChange={e=>setBrand({...brand,links:e.target.value})}
                  placeholder="Ex: site.com.br · linktr.ee/marca"
                  className="vc-input"
                />
              </div>
            </S>)}

            {tab==='visual' && (<><S title="Paletas prontas">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {PALETTES.map(p=>(
                  <button
                    key={p.name}
                    type="button"
                    className="palette-swatch"
                    onClick={() =>
                      setBrand((b) => ({
                        ...b,
                        bg: p.bg,
                        titleColor: p.title,
                        subtitleColor: p.subtitle,
                        textColor: p.text,
                        accent: p.accent,
                      }))
                    }
                    style={{
                      background:'var(--bg-card)',
                      border: brandMatchesPalette(brand, p)
                        ? '2px solid var(--accent)'
                        : '1px solid var(--border)',
                      borderRadius:8, padding:'10px 10px 8px', textAlign:'left', cursor:'pointer',
                      transition:'all 0.15s',
                    }}
                  >
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
                      {[p.bg, p.title, p.subtitle, p.text, p.accent].map((c,i)=>(
                        <div key={i} style={{ width:18, height:18, borderRadius:4, background:c, border:'1px solid rgba(255,255,255,0.08)', flexShrink:0 }}/>
                      ))}
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', fontWeight:600, letterSpacing:'0.02em' }}>{p.name}</div>
                  </button>
                ))}
              </div>
            </S>

            <S title="Cores manuais" hint="Título = primeira e última folha · Subtítulo = linha curta nos slides do meio · Texto = parágrafos e blocos de corpo (sanduíche inclusive). Destaques = trechos marcados no editor.">
              <ColorRow label="Fundo" value={brand.bg} onChange={v=>setBrand({...brand,bg:v})}/>
              <Toggle
                label="Intercalar fundo entre cards"
                value={!!brand.interleaveBg}
                onChange={(v) => setBrand({
                  ...brand,
                  interleaveBg: v,
                  ...((v && !(String(brand.bgAlternate || '').trim())) ? { bgAlternate: '#f5f5f7' } : {}),
                })}
              />
              {brand.interleaveBg ? (
                <div style={{
                  fontSize:11, lineHeight:1.47, letterSpacing:'-0.011em', fontFamily:'var(--font-ui)',
                  color:'var(--text-muted)', marginTop:-4, marginBottom:2,
                }}>
                  Slides 1 e 3 usam «Fundo» · 2 e 4 usam a segunda cor. Um «Fundo por slide» substitui esta regra nesse card.
                </div>
              ) : null}
              {brand.interleaveBg ? (
                <ColorRow
                  label="Segundo fundo"
                  value={(brand.bgAlternate && String(brand.bgAlternate).trim()) ? brand.bgAlternate : '#f5f5f7'}
                  onChange={v=>setBrand({ ...brand, bgAlternate: v })}
                />
              ) : null}
              {(() => {
                const bh = hydrateBrandTextColors(brand);
                const activeBgImage = slides[activeIdx]?.bgImage;
                return (
                  <>
                    <ColorRow label="Título" value={bh.titleColor} onChange={v=>setBrand({...brand,titleColor:v})} contrastBg={brand.bg} contrastKind="large"/>
                    <ColorRow label="Subtítulo (meio)" value={bh.subtitleColor} onChange={v=>setBrand({...brand,subtitleColor:v})} contrastBg={brand.bg} contrastKind="body"/>
                    <ColorRow label="Texto" value={bh.textColor} onChange={v=>setBrand({...brand,textColor:v})} contrastBg={brand.bg} contrastKind="body"/>
                    <ColorRow label="Destaques" value={brand.accent} onChange={v=>setBrand({...brand,accent:v})} contrastBg={brand.bg} contrastKind="body"/>
                    {activeBgImage ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const hex = await extractDominantColor(activeBgImage);
                          if (hex) {
                            setBrand({ ...brand, accent: hex });
                            toast(`Cor de destaque extraída da foto: ${hex}`, 'success');
                          } else {
                            toast('Não consegui extrair cor dominante (imagem muito uniforme?).', 'warning');
                          }
                        }}
                        style={{
                          marginTop: 6, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                          background: 'var(--bg-card)', border: '1px solid var(--border)',
                          color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-ui)',
                          letterSpacing: '-0.011em', textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}
                      >
                        <Sparkles size={14} style={{ color: 'var(--accent)' }} aria-hidden/>
                        <span>Usar cor dominante da foto do card atual como «Destaques»</span>
                      </button>
                    ) : null}
                  </>
                );
              })()}
            </S>
            </>)}

            {tab==='texto' && (<>
            <S title="Fontes próprias (ficheiro)" hint="WOFF2, WOFF, TTF ou OTF até 5MB. As listas abaixo (Google) ficam como reserva se o ficheiro não tiver todos os pesos.">
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label className="vc-label-sm">Ficheiro — títulos da marca</label>
                  {brand.customTitleFont?.dataUrl ? (
                    <div style={{
                      display:'flex', alignItems:'center', gap:10, marginTop:4,
                      background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:9, padding:10,
                    }}>
                      <div
                        style={{
                          fontSize:18, fontWeight:600, color:'var(--text-primary)', fontFamily: effectiveTitleFontFamily(brand),
                          letterSpacing:'-0.022em', lineHeight:1, flex:1, minWidth:0,
                        }}
                      >
                        Aa
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={brand.customTitleFont.fileName}>
                        {brand.customTitleFont.fileName || 'fonte-título'}
                      </div>
                      <button
                        type="button"
                        onClick={() => setBrand({ ...brand, customTitleFont: null })}
                        aria-label="Remover fonte de título" title="Remover fonte de título"
                        style={{ width:30, height:30, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
                      >
                        <Trash2 size={11}/>
                      </button>
                    </div>
                  ) : (
                    <label
                      style={{
                        display:'flex', alignItems:'center', gap:12,
                        padding:'10px 14px', minHeight:54, borderRadius:11,
                        cursor:'pointer', marginTop:6,
                        background:'var(--bg-card)', border:'1px solid var(--hairline)',
                        fontFamily:'var(--font-ui)',
                        transition:'background-color 0.15s var(--ease-smooth), border-color 0.15s var(--ease-smooth)',
                      }}
                      onMouseEnter={e=>{
                        e.currentTarget.style.borderColor='var(--accent)';
                        e.currentTarget.style.background='var(--accent-surface)';
                      }}
                      onMouseLeave={e=>{
                        e.currentTarget.style.borderColor='var(--hairline)';
                        e.currentTarget.style.background='var(--bg-card)';
                      }}
                    >
                      <span style={{
                        width:30, height:30, borderRadius:'50%', flexShrink:0,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        background:'var(--accent-surface)', color:'var(--accent)',
                      }} aria-hidden>
                        <Upload size={13} strokeWidth={2.25}/>
                      </span>
                      <span style={{ display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:0 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em', lineHeight:1.3 }}>
                          Carregar fonte do título
                        </span>
                        <span style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:'-0.005em' }}>
                          WOFF2 · WOFF · TTF · OTF — até 5&nbsp;MB
                        </span>
                      </span>
                      <input
                        type="file"
                        accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
                        style={{ display:'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const max = 5 * 1024 * 1024;
                          if (file.size > max) {
                            toast?.('Ficheiro demasiado grande. Máximo 5MB.', 'error');
                            e.target.value = '';
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => setBrand({
                            ...brand,
                            customTitleFont: {
                              dataUrl: reader.result,
                              format: guessFontFileFormat(file),
                              fileName: file.name,
                            },
                          });
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
                <div>
                  <label className="vc-label-sm">Ficheiro — corpo / subtítulo</label>
                  {brand.customBodyFont?.dataUrl ? (
                    <div style={{
                      display:'flex', alignItems:'center', gap:10, marginTop:4,
                      background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:9, padding:10,
                    }}>
                      <div
                        style={{
                          fontSize:14, fontWeight:400, color:'var(--text-primary)', fontFamily: effectiveBodyFontFamily(brand),
                          letterSpacing:'-0.011em', lineHeight:1.35, flex:1, minWidth:0,
                        }}
                      >
                        Texto de exemplo
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={brand.customBodyFont.fileName}>
                        {brand.customBodyFont.fileName || 'fonte-corpo'}
                      </div>
                      <button
                        type="button"
                        onClick={() => setBrand({ ...brand, customBodyFont: null })}
                        aria-label="Remover fonte de corpo" title="Remover fonte de corpo"
                        style={{ width:30, height:30, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
                      >
                        <Trash2 size={11}/>
                      </button>
                    </div>
                  ) : (
                    <label
                      style={{
                        display:'flex', alignItems:'center', gap:12,
                        padding:'10px 14px', minHeight:54, borderRadius:11,
                        cursor:'pointer', marginTop:6,
                        background:'var(--bg-card)', border:'1px solid var(--hairline)',
                        fontFamily:'var(--font-ui)',
                        transition:'background-color 0.15s var(--ease-smooth), border-color 0.15s var(--ease-smooth)',
                      }}
                      onMouseEnter={e=>{
                        e.currentTarget.style.borderColor='var(--accent)';
                        e.currentTarget.style.background='var(--accent-surface)';
                      }}
                      onMouseLeave={e=>{
                        e.currentTarget.style.borderColor='var(--hairline)';
                        e.currentTarget.style.background='var(--bg-card)';
                      }}
                    >
                      <span style={{
                        width:30, height:30, borderRadius:'50%', flexShrink:0,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        background:'var(--accent-surface)', color:'var(--accent)',
                      }} aria-hidden>
                        <Upload size={13} strokeWidth={2.25}/>
                      </span>
                      <span style={{ display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:0 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em', lineHeight:1.3 }}>
                          Carregar fonte do corpo
                        </span>
                        <span style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:'-0.005em' }}>
                          WOFF2 · WOFF · TTF · OTF — até 5&nbsp;MB
                        </span>
                      </span>
                      <input
                        type="file"
                        accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
                        style={{ display:'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const max = 5 * 1024 * 1024;
                          if (file.size > max) {
                            toast?.('Ficheiro demasiado grande. Máximo 5MB.', 'error');
                            e.target.value = '';
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => setBrand({
                            ...brand,
                            customBodyFont: {
                              dataUrl: reader.result,
                              format: guessFontFileFormat(file),
                              fileName: file.name,
                            },
                          });
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </S>

            <FontPairingPicker
              brand={brand}
              onApply={(p) => setBrand({
                ...brand,
                titleFont: p.titleFont,
                bodyFont: p.bodyFont,
                textTitleWeight: clampTitleWeight(p.titleFont, p.textTitleWeight),
              })}
            >
              <FontPicker title="Fonte — Título" fonts={TITLE_FONTS} active={brand.titleFont} onChange={val=>setBrand({...brand,titleFont:val})}/>
              <FontPicker title="Fonte — Corpo"  fonts={BODY_FONTS}  active={brand.bodyFont}  onChange={val=>setBrand({...brand,bodyFont:val})}/>
            </FontPairingPicker>
            </>)}
          </>
        )}

        {/* Conteúdo base agora vive dentro de Narrativa (FASE 1 merge) —
            matéria-prima da IA pertence ao domínio narrativo. */}
        {tab==='narrativa' && (
          <>
            <S
              title="Conteúdo base"
              hint="Texto, anotação ou rascunho que a IA usará como matéria-prima ao gerar/refinar slides. Pode ser longo."
            >
              <textarea
                value={material.content || ''}
                onChange={e => setMaterial({ ...material, content: e.target.value })}
                rows={8}
                placeholder={'Ex: cole aqui sua transcrição de aula, post antigo, outline do tema, ' +
                  'pesquisa de mercado, depoimentos de clientes, notas de leitura...\n\n' +
                  'A IA usa este texto como base de fatos antes de inventar.'}
                className="vc-input vc-textarea"
                style={{ minHeight:140, resize:'vertical', lineHeight:1.5 }}
              />
              {normalizeMaterialField(material.content) ? (
                <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.04em', textAlign:'right' }}>
                  {normalizeMaterialField(material.content).length.toLocaleString('pt-BR')} caracteres
                </div>
              ) : null}
            </S>

            <S
              title="Fontes & referências"
              hint="URLs (uma por linha ou várias separadas por espaço): ao gerar o carrossel, o app tenta ler o texto da página no servidor e envia esse conteúdo à IA — sem isso os modelos não abrem links. Sites com paywall, login forte ou só JavaScript podem falhar."
            >
              <textarea
                value={material.sources || ''}
                onChange={e => setMaterial({ ...material, sources: e.target.value })}
                rows={6}
                placeholder={'https://hbr.org/...\n' +
                  'Pesquisa Edelman Trust Barometer 2026\n' +
                  '"O luxo deixou de ser status. Virou tempo." — entrevista X\n' +
                  '@autor.referência'}
                className="vc-input vc-textarea"
                style={{ minHeight:110, resize:'vertical', lineHeight:1.5, fontFamily:'var(--font-mono)', fontSize:11 }}
              />
            </S>

            <S
              title="Contexto extra para o prompt"
              hint="Instruções específicas que a IA deve seguir nesta geração. Sobrepõe regras default."
            >
              <textarea
                value={material.context || ''}
                onChange={e => setMaterial({ ...material, context: e.target.value })}
                rows={4}
                placeholder={'Ex: "Evite jargão técnico, foque em casos brasileiros. ' +
                  'Use linguagem mais informal. Cite dados quando relevante. ' +
                  'Não use a palavra X. Termine sempre com pergunta provocativa."'}
                className="vc-input vc-textarea"
                style={{ minHeight:80, resize:'vertical', lineHeight:1.5 }}
              />
            </S>

            <S title="Atalhos rápidos">
              {/* Hierarquia: CTA primário full-width, Limpar como link sutil.
                  Era grid 1fr-1fr que forçava 'Gerar com este material' a
                  quebrar em 2 linhas (apertado e feio). */}
              <button
                onClick={() => setSetupOpen(true)}
                style={{
                  width:'100%', height:44, borderRadius:9999, cursor:'pointer',
                  background:'var(--accent)', border:'none',
                  color:'#fff', fontSize:14, fontWeight:600, fontFamily:'var(--font-ui)',
                  letterSpacing:'-0.011em',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  whiteSpace:'nowrap',
                  transition:'background-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
                }}
              >
                <Sparkles size={14}/>Gerar com este material
              </button>
              <button
                onClick={() => setMaterial({ ...material, content: '', sources: '', context: '', refProfileId: null })}
                disabled={!materialHasUserInput(material)}
                style={{
                  alignSelf:'center', minHeight:32, padding:'4px 12px',
                  cursor: !materialHasUserInput(material) ? 'not-allowed' : 'pointer',
                  border:'none', background:'transparent',
                  color:'var(--text-muted)', fontSize:11, fontFamily:'var(--font-ui)',
                  letterSpacing:'-0.005em',
                  display:'inline-flex', alignItems:'center', gap:5,
                  opacity: !materialHasUserInput(material) ? 0.4 : 1,
                  transition:'color 0.12s',
                }}
              >
                <Trash2 size={11}/>Limpar tudo
              </button>
            </S>
          </>
        )}

        {/* HOME / Storyboard — visão geral do projeto. Sequência de cards,
            estatísticas, fluxo narrativo. "Mesa criativa" cinematográfica. */}
        {tab==='home' && (
          <>
            {/* Saudação + status */}
            <div style={{
              padding: '18px 16px',
              borderRadius: 16,
              border: '1px solid var(--glass-border-strong)',
              background: 'linear-gradient(135deg, rgba(255,45,141,0.10) 0%, rgba(143,125,255,0.06) 100%)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              boxShadow: '0 0 32px rgba(255, 45, 141, 0.10), inset 0 1px 0 rgba(255,255,255,0.10)',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                marginBottom: 6, fontFamily: 'var(--font-mono)',
              }}>
                Storyboard
              </div>
              <div style={{
                fontSize: 18, fontWeight: 600, color: 'var(--text-primary)',
                letterSpacing: '-0.016em', lineHeight: 1.25, marginBottom: 4,
                fontFamily: 'var(--font-display)',
              }}>
                {activeEntry?.name || 'Carrossel sem título'}
              </div>
              <div style={{
                fontSize: 12, color: 'var(--text-muted)',
                letterSpacing: '-0.005em',
              }}>
                {slides.length} card{slides.length === 1 ? '' : 's'} ·
                {' '}{slides.filter(s => s.bgImage).length} com imagem ·
                {' '}{slides.filter(s => (s.title || '').trim()).length} com título
              </div>
            </div>

            {/* Fluxo narrativo — mini-thumbs vertical */}
            <S title="Fluxo da narrativa" hint="Sequência dos cards e progressão. Clique pra editar.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {slides.map((s, i) => {
                  const isActive = i === activeIdx;
                  const hasImg = !!s.bgImage;
                  const titlePreview = (s.title || '').trim().slice(0, 50) || '— sem título —';
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveIdx(i)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: 10, borderRadius: 12,
                        border: `1px solid ${isActive ? 'rgba(255, 45, 141, 0.42)' : 'var(--glass-border)'}`,
                        background: isActive
                          ? 'linear-gradient(135deg, rgba(255,45,141,0.10) 0%, rgba(255,45,141,0.03) 100%)'
                          : 'rgba(255, 255, 255, 0.04)',
                        cursor: 'pointer', textAlign: 'left',
                        boxShadow: isActive
                          ? '0 0 16px rgba(255, 45, 141, 0.16), inset 0 1px 0 rgba(255,255,255,0.08)'
                          : 'none',
                        transition: 'all 0.18s var(--ease-smooth)',
                      }}
                    >
                      {/* Mini thumb */}
                      <div style={{
                        width: 40, height: 50, borderRadius: 6, flexShrink: 0,
                        background: hasImg
                          ? `url(${s.bgImage}) center/cover, ${s.bg || brand.bg || '#0a0a0a'}`
                          : (s.bg || brand.bg || '#0a0a0a'),
                        border: '1px solid var(--glass-border)',
                        position: 'relative',
                      }}>
                        <span style={{
                          position: 'absolute', bottom: 2, left: 3,
                          fontSize: 8, fontWeight: 700, color: '#fff',
                          fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                        }}>{String(i + 1).padStart(2, '0')}</span>
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 600,
                          color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                          letterSpacing: '-0.011em',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          marginBottom: 2,
                        }}>{titlePreview}</div>
                        <div style={{
                          fontSize: 10, color: 'var(--text-muted)',
                          letterSpacing: '-0.005em',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          {hasImg && <><ImageIcon size={9}/>foto</>}
                          {hasImg && (s.title || '').trim() && <span style={{ opacity: 0.5 }}>·</span>}
                          {(s.title || '').trim() && <><Type size={9}/>texto</>}
                          {!hasImg && !(s.title || '').trim() && <span style={{ color: 'var(--text-muted)' }}>vazio</span>}
                        </div>
                      </div>
                      {isActive && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: 'var(--accent)',
                          fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                        }}>Ativo</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </S>

            {/* Ação rápida — gerar novo */}
            <S title="Ações rápidas">
              <button
                onClick={() => setSetupOpen?.(true)}
                style={{
                  width: '100%', minHeight: 48, borderRadius: 9999,
                  background: 'linear-gradient(135deg, #ff2d8d 0%, #ff4fa1 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.10)',
                  color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-ui)',
                  letterSpacing: '-0.011em', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 8px 24px rgba(255, 45, 141, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
                }}
              >
                <Sparkles size={15}/>Novo carrossel com IA
              </button>
            </S>
          </>
        )}

        {/* Narrativa (FASE 1): IA + Conteúdo gradual. Por enquanto só os
            controles que estavam na aba IA (gerar/refinar/legenda/tom). */}
        {tab==='narrativa' && (
          <>
            <S title="Gerar conteúdo">
              <button onClick={()=>setSetupOpen(true)} style={{
                width:'100%', height:44, borderRadius:9999, border:'none', cursor:'pointer',
                background:'var(--accent)',
                color:'#fff', fontSize:14, fontWeight:400, fontFamily:'var(--font-ui)',
                letterSpacing:'-0.016em',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                transition:'background-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
              }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--accent-hover)'}
              onMouseLeave={e=>e.currentTarget.style.background='var(--accent)'}
              onMouseDown={e=>e.currentTarget.style.transform='scale(0.98)'}
              onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
              >
                <Sparkles size={14}/>Novo carrossel com IA
              </button>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <button onClick={()=>setTemplatesOpen?.(true)} style={{
                  height:38, borderRadius:8, cursor:'pointer',
                  background:'var(--bg-card)', border:'1px solid var(--border)',
                  color:'var(--text-secondary)', fontSize:11, fontWeight:600, fontFamily:'var(--font-ui)',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all 0.12s',
                }}
                onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
                onMouseLeave={e=>{e.currentTarget.style.color='var(--text-secondary)';e.currentTarget.style.borderColor='var(--border)';}}
                aria-label="Abrir templates prontos"
                >
                  <Layout size={12}/>Templates
                </button>
                <button onClick={()=>setResearchOpen(true)} style={{
                  height:38, borderRadius:8, cursor:'pointer',
                  background:'var(--bg-card)', border:'1px solid var(--border)',
                  color:'var(--text-secondary)', fontSize:11, fontWeight:600, fontFamily:'var(--font-ui)',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all 0.12s',
                }}
                onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
                onMouseLeave={e=>{e.currentTarget.style.color='var(--text-secondary)';e.currentTarget.style.borderColor='var(--border)';}}
                aria-label="Pesquisar nicho"
                >
                  <TrendingUp size={12}/>Pesquisar
                </button>
              </div>
            </S>

            <S title="Refinar todos os cards" hint="Aplica uma instrução a todo o carrossel mantendo coerência narrativa.">
              {/* Variante prominent: CTA drop-zone (círculo accent + título +
                  subtítulo) pra ler como botão e não como fundo desbotado. */}
              <RefineBtn
                onRefine={refineAll}
                busy={refining}
                variant="prominent"
                label="Refinar com IA"
                subtitle="Aplica uma instrução em todos os cards de uma vez"
              />
            </S>

            {hasLastGenerate ? (
              <S title="Refazer com tom alternativo" hint="Usa o mesmo tema/material da última geração mas com inflexão de tom diferente. O carrossel atual fica em Cmd+Z (undo) pra você comparar.">
                {/* Polish: cards verticais com label grande + micro-descrição em cinza.
                    Hover puxa borda accent + lift sutil. Disabled durante refining. */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                  {[
                    { id:'analitico',  label:'Analítico',  blurb:'Editorial, calmo, conceitual.', hint:'mais analítico-editorial, conceitual e calmo, com profundidade de raciocínio' },
                    { id:'provocador', label:'Provocador', blurb:'Contraintuitivo, vira a tese.',  hint:'mais provocador e contraintuitivo, virando a tese óbvia do avesso sem deixar de sustentar' },
                    { id:'leve',       label:'Leve',       blurb:'Direto, humor sutil, curto.',   hint:'mais leve, conversacional e direto, com humor sutil e frases curtas' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => remixWithTone(opt.hint, opt.label)}
                      disabled={refining}
                      aria-label={opt.hint} title={opt.hint}
                      style={{
                        display:'flex', flexDirection:'column', alignItems:'flex-start', gap:4,
                        padding:'10px 10px 11px', borderRadius:10, cursor: refining ? 'not-allowed' : 'pointer',
                        background:'var(--bg-card)', border:'1px solid var(--border)',
                        color:'var(--text-secondary)',
                        fontFamily:'var(--font-ui)',
                        opacity: refining ? 0.5 : 1,
                        transition:'border-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth), background-color 0.15s var(--ease-smooth)',
                        textAlign:'left',
                      }}
                      onMouseEnter={e => {
                        if (refining) return;
                        e.currentTarget.style.borderColor = 'var(--accent)';
                        e.currentTarget.style.background = 'var(--accent-surface)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.background = 'var(--bg-card)';
                      }}
                      onMouseDown={e => { if (!refining) e.currentTarget.style.transform = 'scale(0.97)'; }}
                      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em' }}>
                        {opt.label}
                      </span>
                      <span style={{ fontSize:10, lineHeight:1.35, color:'var(--text-muted)', letterSpacing:'-0.005em' }}>
                        {opt.blurb}
                      </span>
                    </button>
                  ))}
                </div>
              </S>
            ) : null}

            <S title="Legenda do post">
              {caption ? (
                <>
                  <textarea value={caption} onChange={e=>setCaption(e.target.value)} rows={7}
                    className="vc-input vc-textarea"
                    style={{ fontSize:11, lineHeight:1.6, fontFamily:'var(--font-mono)', color:'var(--text-secondary)' }}
                  />
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    <button onClick={()=>navigator.clipboard?.writeText(caption)} className="vc-btn vc-btn-ghost" style={{ height:34 }}>
                      <Copy size={11}/>Copiar
                    </button>
                    <button onClick={generateCaption} disabled={genCaption} className="vc-btn vc-btn-ghost" style={{ height:34, opacity:genCaption?0.5:1 }}>
                      {genCaption ? <Loader2 size={11} style={{animation:'spin 0.8s linear infinite'}}/> : <RefreshCw size={11}/>}Regerar
                    </button>
                  </div>
                </>
              ) : (
                // Empty state da legenda: solid border + ícone num círculo
                // accent, mesma estética dos uploads. Hover puxa fundo accent-surface.
                <button onClick={generateCaption} disabled={genCaption} style={{
                  width:'100%', minHeight:60, padding:'12px 16px', borderRadius:11,
                  cursor:genCaption?'not-allowed':'pointer',
                  background:'var(--bg-card)', border:'1px solid var(--hairline)',
                  fontFamily:'var(--font-ui)',
                  display:'flex', alignItems:'center', gap:12,
                  opacity:genCaption?0.6:1,
                  transition:'background-color 0.15s var(--ease-smooth), border-color 0.15s var(--ease-smooth)',
                }}
                onMouseEnter={e=>{if(!genCaption){e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.background='var(--accent-surface)';}}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--hairline)';e.currentTarget.style.background='var(--bg-card)';}}
                >
                  <span style={{
                    width:32, height:32, borderRadius:'50%', flexShrink:0,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background:'var(--accent-surface)', color:'var(--accent)',
                  }} aria-hidden>
                    {genCaption ? <Loader2 size={14} style={{animation:'spin 0.8s linear infinite'}}/> : <FileText size={14} strokeWidth={2.25}/>}
                  </span>
                  <span style={{ display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:0, textAlign:'left' }}>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em', lineHeight:1.3 }}>
                      Gerar legenda para o post
                    </span>
                    <span style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:'-0.005em' }}>
                      IA escreve com base no carrossel atual
                    </span>
                  </span>
                </button>
              )}
            </S>
          </>
        )}
      </div>

      {/* Download footer — uma única row: dropdown "Baixar" (com card N + ZIP
          + PDF + fotos limpas dentro) + Projetos + ✓ Salvo. Liberta ~80px
          que antes eram do CTA fixo "Baixar card N". */}
      <div style={{ borderTop:'1px solid var(--border)', padding:'10px 12px', display:'flex', alignItems:'center', gap:8, justifyContent:'space-between', flexShrink:0 }}>
        <ExportMoreFormats
          slides={slides}
          exporting={exporting}
          exportProgress={exportProgress}
          activeIdx={activeIdx}
          onExportSlide={exportSlide}
          onExportAll={exportAll}
          onExportPDF={exportPDF}
          onExportPhotosOnly={exportPhotosOnly}
          hideSlideOption={false}
        />
        <button
          onClick={() => setLibraryOpen(true)}
          aria-label="Abrir biblioteca de projetos salvos"
          title={libraryCount > 1 ? `${libraryCount} projetos salvos` : 'Meus projetos salvos'}
          style={{
            minHeight:32, cursor:'pointer',
            border:'none', background:'transparent',
            color:'var(--text-muted)', fontSize:11, fontFamily:'var(--font-ui)',
            letterSpacing:'-0.005em',
            display:'inline-flex', alignItems:'center', gap:5,
            transition:'color 0.12s',
            padding:'4px 6px', borderRadius:6, whiteSpace:'nowrap',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <BookOpen size={11}/>
          {libraryCount > 1
            ? <>Projetos · <strong style={{ color:'inherit', fontWeight:700 }}>{libraryCount}</strong></>
            : 'Projetos'}
        </button>
        <span
          title="Salvando automaticamente"
          aria-label="Salvando automaticamente"
          style={{
            display:'inline-flex', alignItems:'center', gap:4,
            fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-ui)',
            letterSpacing:'-0.005em', whiteSpace:'nowrap',
          }}
        >
          <Check size={10} strokeWidth={3} style={{ color:'var(--accent)' }} aria-hidden/>
          Salvo
        </span>
      </div>
    </div>
  );
}

export {
  guessFontFileFormat,
  IMAGE_FOCAL_XY,
  IMAGE_MODE_PRESETS,
  activeImageModePresetId,
  activeImageFocalLayoutId,
  PHOTO_REGION_GRID,
  BG_PATTERN_OPTIONS,
  PRESENTATION_IMG_FILTER_PRESETS,
  unionDestaqueRangeIntoSpans,
  EDITOR_TABS,
  APP_MODE_RANK,
  visibleEditorTabs,
  SidebarContent,
};
