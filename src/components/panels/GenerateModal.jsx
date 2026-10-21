// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, Loader2, Bookmark, X, ChevronRight, ChevronLeft, Check, Settings } from 'lucide-react';
import { getHooksForNiche } from '../../utils/hooks-library.js';
import VisualStylePicker from '../VisualStylePicker.jsx';
import { VISUAL_PRESETS } from '../../styles/visual-presets.jsx';
import { GEN_MODE_BY_ID, CREATIVE_PRESETS, CREATIVE_PRESET_BY_ID, SLIDE_TEXT_DENSITY_OPTIONS, quickTemplateIdFromPreset, isQuickTemplatePreset } from '../../utils/generation-prompts.js';
import { ModePicker, ReferenceProfilesCuradoria, ImgParamsPanel } from './generate-modal-parts.jsx';
import { PhotoRegionMiniIcon } from '../ui/mini-icons.jsx';
import { CONTENT_OBJECTIVES, normalizeContentObjective } from '../../utils/editorial-strategy.js';
import { buildPerformanceGuidance } from '../../utils/publication-results.js';
import { CARD_VISUAL_STYLE_IDS } from '../../utils/doc-schema.js';
import {
  APRESENTACAO_PRESET_ID,
  DEFAULT_PRESENTATION_PATH_ID,
  PRESENTATION_PATHS,
  getPresentationPath,
  normalizePresentationPath,
} from '../../utils/presentation.js';
import {
  DEFAULT_PRESENTATION_VISUAL_PRESET_ID,
  PRESENTATION_VISUAL_PRESETS,
  resolvePresentationVisualPresetDefinition,
} from '../../styles/presentation-presets.jsx';
import { moontNarrative } from '../../config/moont-brand.js';
import { genModeUiLabel } from '../../utils/ui-depth-labels.js';

function normalizeCardVisualStyle(v) {
  const r = typeof v === 'string' ? v : 'full';
  return CARD_VISUAL_STYLE_IDS.has(r) ? r : 'full';
}

const CARD_VISUAL_STYLE_OPTIONS = [
  { id: 'full', short: 'FUNDO', desc: 'Imagem em tela cheia com texto por cima.' },
  { id: 'inset_h_top', short: 'FOTO ↑', desc: 'Faixa de foto no topo, texto abaixo.' },
  { id: 'inset_h_middle', short: 'MEIO', desc: 'Título, faixa de foto no meio e subtítulo.' },
  { id: 'inset_h_bottom', short: 'FOTO ↓', desc: 'Texto no topo, faixa de foto em baixo.' },
];

/** Modo narrativo interno por arquétipo; a pessoa só escolhe no modo Personalizado. */
const QUICK_TEMPLATE_NARRATIVE_MODE = {
  erro_comum: 'editorial',
  tendencia: 'editorial',
  decodificacao: 'deep',
  comportamento: 'storytelling',
};

/**
 * Mantém os catálogos de carrossel e apresentação isolados. Presets antigos de
 * carrossel não declaravam `productKind`, então a ausência do campo continua
 * significando carrossel. Quando o chamador não fornece nenhum preset válido
 * para o produto, o assistente usa o catálogo oficial correspondente.
 */
function filterVisualPresetsForProduct(presets, productKind) {
  const isPresentation = productKind === 'apresentacao';
  const received = Array.isArray(presets) ? presets : [];
  const matching = received.filter((preset) => (
    preset && (isPresentation
      ? preset.productKind === 'apresentacao'
      : preset.productKind !== 'apresentacao')
  ));

  if (matching.length) return matching;
  return isPresentation ? PRESENTATION_VISUAL_PRESETS : VISUAL_PRESETS;
}

function resolveInitialVisualPreset({
  presets,
  productKind,
  defaultVisualPreset,
  presentationPath = DEFAULT_PRESENTATION_PATH_ID,
}) {
  const available = filterVisualPresetsForProduct(presets, productKind);
  const selected = defaultVisualPreset
    ? resolvePresentationVisualPresetDefinition(defaultVisualPreset, available)
    : null;
  if (selected) {
    return selected.id;
  }
  if (productKind !== 'apresentacao') return null;

  const suggested = getPresentationPath(presentationPath).suggestedVisualPreset
    || DEFAULT_PRESENTATION_VISUAL_PRESET_ID;
  return available.some((preset) => preset.id === suggested)
    ? suggested
    : (available[0]?.id || DEFAULT_PRESENTATION_VISUAL_PRESET_ID);
}

/** Impede que o assistente herde o pacote do outro produto ao ser aberto. */
export function resolveCreativePresetForProduct(presetId, productKind) {
  if (productKind === 'apresentacao') return APRESENTACAO_PRESET_ID;
  return presetId === APRESENTACAO_PRESET_ID ? 'livre' : (presetId || 'livre');
}

function GenerateModal({
  open, onClose, onGenerate, onCancelGeneration,
  defaultNiche='', defaultTopic='', defaultTone='', defaultAudience='',
  hasOpenAI=false, hasAnthropic=false, onOpenKeys,
  defaultWithImages = true,
  imageProviderLabel = 'GPT Image 2',
  brandSummary, materialSummary,
  onGoToMaterial,
  imgParams = { fidelity:50, creativity:50, irreverence:50, objectivity:50 },
  onImgParamsChange,
  mode: defaultMode = 'editorial',
  onModeChange,
  creativePreset: defaultCreativePreset = 'livre',
  contentObjective: defaultContentObjective = 'auto',
  resultsLibrary = [],
  performanceSettings = {},
  onCreativePresetChange,
  slideTextDensity: defaultSlideTextDensity = '1_1',
  onSlideTextDensityChange,
  cardVisualStyle: defaultCardVisualStyle = 'full',
  onCardVisualStyleChange,
  visualPreset: defaultVisualPreset = null,
  onVisualPresetChange,
  visualPresets = VISUAL_PRESETS,
  productKind = 'carrossel',
  presentationPath: defaultPresentationPath = DEFAULT_PRESENTATION_PATH_ID,
  material = { content: '', sources: '', context: '', refProfileId: null },
  setMaterial = () => {},
  hookLibrary = [],
}) {
  const isPresentation = productKind === 'apresentacao';
  const productNarrative = moontNarrative(productKind);
  const productFlow = isPresentation ? 'Faça uma ideia avançar' : 'Faça uma ideia circular';
  const initialPresentationPath = normalizePresentationPath(defaultPresentationPath);
  const availableVisualPresets = useMemo(
    () => filterVisualPresetsForProduct(visualPresets, productKind),
    [visualPresets, productKind],
  );
  const [topic, setTopic] = useState(defaultTopic);
  const [count, setCount] = useState(() => (
    isPresentation ? getPresentationPath(initialPresentationPath).defaultSlideCount : 6
  ));
  const [niche, setNiche] = useState(defaultNiche);
  const [audience, setAudience] = useState(defaultAudience || '');
  const [mode, setMode] = useState(defaultMode);
  const [packCreative, setPackCreative] = useState(() => (
    resolveCreativePresetForProduct(defaultCreativePreset, productKind)
  ));
  const [presentationPath, setPresentationPath] = useState(initialPresentationPath);
  const [contentObjective, setContentObjective] = useState(() => normalizeContentObjective(defaultContentObjective));
  const performanceGuidance = buildPerformanceGuidance(resultsLibrary, {
    ...performanceSettings, objective: contentObjective, niche, presetId: packCreative,
    mode: packCreative === 'tendencia_cultura' ? 'editorial' : (QUICK_TEMPLATE_NARRATIVE_MODE[quickTemplateIdFromPreset(packCreative)] || mode),
  });
  useEffect(() => { if (open) setContentObjective(normalizeContentObjective(defaultContentObjective)); }, [open, defaultContentObjective]);
  const [textDensity, setTextDensity] = useState(defaultSlideTextDensity || '1_1');
  useEffect(() => { if (open) setMode(defaultMode); }, [open, defaultMode]);
  useEffect(() => {
    if (!open) return;
    const nextPath = normalizePresentationPath(defaultPresentationPath);
    setPresentationPath(nextPath);
    setCount(isPresentation ? getPresentationPath(nextPath).defaultSlideCount : 6);
    setPackCreative(resolveCreativePresetForProduct(defaultCreativePreset, productKind));
  }, [open, defaultCreativePreset, defaultPresentationPath, isPresentation, productKind]);
  useEffect(() => { if (open) setTextDensity(defaultSlideTextDensity || '1_1'); }, [open, defaultSlideTextDensity]);
  const [cardStyle, setCardStyle] = useState(() => normalizeCardVisualStyle(defaultCardVisualStyle));
  useEffect(() => {
    if (open) setCardStyle(normalizeCardVisualStyle(defaultCardVisualStyle));
  }, [open, defaultCardVisualStyle]);
  // Padrão visual selecionado (paleta + fontes + tipografia). Null = mantém
  // marca atual sem mudanças. Aplicado ao brand no momento de gerar.
  const [visualPreset, setVisualPresetLocal] = useState(() => resolveInitialVisualPreset({
    presets: visualPresets,
    productKind,
    defaultVisualPreset,
    presentationPath: initialPresentationPath,
  }));
  useEffect(() => {
    if (!open) return;
    setVisualPresetLocal(resolveInitialVisualPreset({
      presets: availableVisualPresets,
      productKind,
      defaultVisualPreset,
      presentationPath: defaultPresentationPath,
    }));
  }, [open, defaultVisualPreset, defaultPresentationPath, productKind, availableVisualPresets]);
  // Cópia local mutável dos eixos da imagem (salva no documento apenas ao gerar).
  const [params, setParams] = useState(imgParams);
  useEffect(() => { if (open) setParams(imgParams); }, [open, imgParams]);
  const setAxis = (key, val) => setParams(p => ({ ...p, [key]: val }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Etapa 3: a pessoa escolhe entre gerar só o texto ou texto e imagens.
  const [wantImages, setWantImages] = useState(!!hasOpenAI && !!defaultWithImages);
  useEffect(() => {
    if (open) setWantImages(!!hasOpenAI && !!defaultWithImages);
  }, [open, hasOpenAI, defaultWithImages]);
  const [creativePresetsOpen, setCreativePresetsOpen] = useState(false);
  useEffect(() => { if (open) setCreativePresetsOpen(false); }, [open]);

  // Fluxo em etapas: 1=Ideia, 2=Formato, 3=Imagens, 4=Revisão.
  // Volta à etapa 1 sempre que reabre, para iniciar um fluxo limpo.
  const [step, setStep] = useState(1);
  useEffect(() => { if (open) setStep(1); }, [open]);
  const STEPS = useMemo(() => ([
    { id: 1, label: isPresentation ? 'Intenção' : 'Ideia' },
    { id: 2, label: isPresentation ? 'Caminho' : 'Formato' },
    { id: 3, label: 'Imagens' },
    { id: 4, label: 'Revisão' },
  ]), [isPresentation]);
  // Rótulos amigáveis para densidade (IDs internos preservados para compatibilidade
  // com docs salvos). "1/1, 1/2..." era abstrato — "Denso/Balanceado/Minimal"
  // comunica intenção direta.
  const DENSITY_FRIENDLY = useMemo(() => ({
    '1_1': 'Denso',
    '1_2': 'Balanceado',
    '1_3': 'Médio',
    '1_4': 'Minimal',
    '1_5': 'Mínimo',
  }), []);

  useEffect(() => {
    if (!open) return;
    setErr('');
    // Também copia valores vazios: ao trocar de projeto, nenhum rascunho do
    // projeto anterior pode sobreviver no modal.
    setTopic(defaultTopic || '');
    setNiche(defaultNiche || '');
    setAudience(defaultAudience || '');
  }, [open, defaultTopic, defaultNiche, defaultAudience]);

  const dialogRef = useRef(null);
  const stepPanelRef = useRef(null);
  const previousStepRef = useRef(step);
  const returnFocusRef = useRef(null);
  const requestClose = () => {
    if (busy) {
      onCancelGeneration?.();
      return;
    }
    onClose?.();
  };
  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement;
    const focusTimer = window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusTimer);
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  // Ao trocar de etapa, o botão acionado sai da árvore ou muda de função.
  // Move o foco para o novo painel para que teclado e leitor de tela recebam
  // imediatamente o conteúdo certo, inclusive ao chegar à revisão.
  useEffect(() => {
    if (!open || previousStepRef.current === step) return undefined;
    previousStepRef.current = step;
    const focusTimer = window.requestAnimationFrame(() => {
      stepPanelRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(focusTimer);
  }, [open, step]);

  const onDialogKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      requestClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const controls = [...dialogRef.current.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) {
      event.preventDefault();
      dialogRef.current.focus();
    } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const hasMaterialPack =
    Array.isArray(materialSummary) && materialSummary.length > 0;
  const hasContextPack =
    (Array.isArray(brandSummary) && brandSummary.length > 0) ||
    hasMaterialPack;
  /** Personalizado (`livre`) expõe modo narrativo, nicho e público (tom base vem da Marca). Demais pacotes trazem estrutura fixa. */
  const modoPersonalizado = !isPresentation && packCreative === 'livre';
  const narrativeLockedForPack =
    !modoPersonalizado && isQuickTemplatePreset(packCreative)
      ? (QUICK_TEMPLATE_NARRATIVE_MODE[quickTemplateIdFromPreset(packCreative)] || 'editorial')
      : null;
  /** Tema digitado OU nicho OU Marca/Material preenchidos — evita botão morto só com contexto injetado. */
  const resolvedGenerationTopic = (() => {
    const t = topic.trim();
    if (t) return t;
    if ((modoPersonalizado || isPresentation) && niche.trim()) return `Conteúdo focado no contexto: ${niche.trim()}`;
    if (hasContextPack) return 'Conteúdo baseado no material de referência e na identidade da marca.';
    return '';
  })();

  // A etapa 1 exige tema válido (resolvedGenerationTopic já cobre alternativas
  // de nicho e contexto). As demais etapas permitem revisar os valores padrão.
  const canProceed = step === 1 ? !!resolvedGenerationTopic : true;
  const selectedPresentationPath = getPresentationPath(presentationPath);
  const selectPresentationPath = (pathId) => {
    const normalized = normalizePresentationPath(pathId);
    const route = getPresentationPath(normalized);
    setPresentationPath(normalized);
    setCount(route.defaultSlideCount);
    setVisualPresetLocal(resolveInitialVisualPreset({
      presets: availableVisualPresets,
      productKind: 'apresentacao',
      defaultVisualPreset: route.suggestedVisualPreset,
      presentationPath: normalized,
    }));
  };

  if (!open) return null;

  const run = async ({ withImages } = { withImages: true }) => {
    if (!resolvedGenerationTopic) {
      setErr(
        isPresentation
          ? 'Informe o tema da apresentação, o contexto ou preencha Marca e Conteúdo.'
          : modoPersonalizado
          ? 'Informe o tema em “Sobre o que é o conteúdo?”, ou o nicho, ou preencha Marca e Conteúdo.'
          : 'Informe o tema em “Sobre o que é o conteúdo?” ou preencha Marca e Conteúdo.',
      );
      return;
    }
    setBusy(true); setErr('');
    try {
      const toneFromBrand = (defaultTone || '').trim() || 'direto e provocativo';
      const narrativeForGenerate = isPresentation
        ? 'editorial'
        : (modoPersonalizado ? mode : (narrativeLockedForPack ?? 'editorial'));
      const creativePresetForGenerate = isPresentation ? APRESENTACAO_PRESET_ID : packCreative;
      // Todas as escolhas ficam locais até a geração terminar. `onGenerate`
      // recebe o pacote completo e é responsável pelo commit atômico do
      // documento; cancelar, fechar ou falhar não pode aplicar um rascunho.
      const result = await onGenerate({
        topic: resolvedGenerationTopic,
        count,
        niche: (modoPersonalizado || isPresentation) ? niche : '',
        tone: toneFromBrand,
        audience: (modoPersonalizado || isPresentation) ? audience : '',
        imgMode: 'dalle',
        imgParams: params,
        mode: narrativeForGenerate,
        creativePreset: creativePresetForGenerate,
        contentObjective: isPresentation ? 'auto' : contentObjective,
        presentationPath: isPresentation ? presentationPath : undefined,
        slideTextDensity: textDensity,
        cardVisualStyle: isPresentation ? 'full' : cardStyle,
        visualPreset,
        fetchImagesNow: !!withImages,
      });
      if (!result?.cancelled) onClose();
    } catch(e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay">
      <div
        ref={dialogRef}
        className="modal-panel vc-modal-scroll"
        role="dialog"
        aria-modal="true"
        aria-label={isPresentation ? 'Configurar apresentação' : 'Configurar carrossel'}
        aria-labelledby="generate-modal-title"
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
        onClick={e=>e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
          flexShrink: 0, background:'var(--bg-sidebar)', zIndex: 2,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:32, height:32, borderRadius:8, background:'var(--accent)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Sparkles size={14} color="var(--text-on-accent)"/>
            </div>
            <div>
              <div id="generate-modal-title" style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>
                {productNarrative.name}
              </div>
              <div className="vc-eyebrow">
                <span>{isPresentation ? 'Configurar apresentação' : 'Configurar carrossel'}</span>
                <span> · {productNarrative.eyebrow} · Passo {step} de {STEPS.length} · {STEPS[step-1].label}</span>
              </div>
            </div>
          </div>
          <button onClick={requestClose} className="vc-icon-btn" aria-label={busy ? 'Cancelar geração' : 'Fechar'}>
            <X size={16}/>
          </button>
        </div>

        {/* Indicador de etapas: apenas etapas já alcançadas são clicáveis;
            Continuar valida os campos obrigatórios antes de avançar. */}
        <div role="tablist" aria-label="Etapas da configuração" style={{
          display:'flex', gap:4, padding:'10px 14px',
          borderBottom:'1px solid var(--border)',
          background:'var(--bg-sidebar)', flexShrink:0, zIndex:1,
          overflowX:'auto',
        }}>
          {STEPS.map((s) => {
            const isActive = s.id === step;
            const isCompleted = s.id < step;
            const isClickable = s.id <= step;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                id={`gen-step-tab-${s.id}`}
                aria-selected={isActive}
                aria-controls={`gen-step-${s.id}`}
                disabled={!isClickable || busy}
                onClick={() => isClickable && setStep(s.id)}
                style={{
                  flex:'1 1 0', minWidth:90, minHeight:44,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  padding:'8px 10px', borderRadius:11,
                  border:`1px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                  background: isActive ? 'var(--accent-surface)' : 'transparent',
                  cursor: isClickable ? 'pointer' : 'not-allowed',
                  fontFamily:'var(--font-ui)',
                  transition:'background-color 0.15s var(--ease-smooth), border-color 0.15s',
                  opacity: !isClickable ? 0.45 : 1,
                }}
              >
                <span style={{
                  width:22, height:22, borderRadius:'50%',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background: (isActive || isCompleted) ? 'var(--accent)' : 'var(--bg-pearl)',
                  color: (isActive || isCompleted) ? 'var(--text-on-accent)' : 'var(--text-muted)',
                  fontSize:11, fontWeight:700, flexShrink:0,
                  border: `1px solid ${(isActive || isCompleted) ? 'var(--accent)' : 'var(--hairline)'}`,
                  fontVariantNumeric:'tabular-nums',
                }}>
                  {isCompleted ? <Check size={12} strokeWidth={3}/> : s.id}
                </span>
                <span style={{
                  fontSize:12,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  letterSpacing:'-0.011em', whiteSpace:'nowrap',
                }}>{s.label}</span>
              </button>
            );
          })}
        </div>

        <div
          ref={stepPanelRef}
          className="vc-modal-scroll-body"
          id={`gen-step-${step}`}
          role="tabpanel"
          aria-labelledby={`gen-step-tab-${step}`}
          tabIndex={-1}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            padding: '16px 20px',
            paddingBottom: 24,
          }}
        >
          {/* ═══════════ ETAPA 1 — IDEIA ═══════════
              Tema, pacote criativo e ganchos salvos. Personalizado expõe modo
              narrativo, nicho, público. Outros pacotes mostram aviso explicando
              estrutura fixa. */}
          {step === 1 && (
            <>
              {onGoToMaterial && (
                <div
                  role="region"
                  aria-label="Conteúdo para geração"
                  style={{
                    borderRadius:11,
                    border:'1px solid var(--hairline)',
                    background:'var(--bg-pearl)',
                    padding:'12px 14px',
                    display:'flex',
                    flexDirection:'column',
                    gap:10,
                  }}
                >
                  <div style={{ fontSize:13, lineHeight:1.47, color:'var(--text-primary)', letterSpacing:'-0.011em' }}>
                    {hasMaterialPack ? (
                      <>
                        <span style={{ fontWeight:600 }}>Conteúdo</span>
                        {' '}já tem base — você pode ajustar matéria-prima, fontes e instruções na aba Conteúdo quando quiser.
                      </>
                    ) : (
                      <>
                        {productFlow}. Para basear {isPresentation ? 'a apresentação' : 'o carrossel'} em{' '}
                        <span style={{ fontWeight:600 }}>texto, links ou notas</span>, preencha primeiro a aba{' '}
                        <span style={{ fontWeight:600 }}>Conteúdo</span> — assim a IA não inventa em cima de um ponto genérico.
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { onGoToMaterial(); onClose(); }}
                    style={{
                      alignSelf:'flex-start', minHeight:44, padding:'0 20px',
                      borderRadius:9999, border:'none', background:'var(--accent)',
                      color:'var(--text-on-accent)', fontSize:13, fontWeight:600,
                      fontFamily:'var(--font-ui)', letterSpacing:'-0.011em',
                      cursor:'pointer', transition:'transform 0.1s var(--ease-smooth)',
                    }}
                    onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                    onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    Ir para a aba Conteúdo
                  </button>
                </div>
              )}

              {/* O pedido vem antes das opções de estrutura para reduzir a carga
                  cognitiva, especialmente em telas pequenas. */}
              <div>
                <label className="vc-label" htmlFor="generation-topic">
                  {isPresentation ? 'Qual ideia precisa avançar?' : 'Qual ideia precisa circular?'}
                </label>
                <textarea
                  id="generation-topic"
                  aria-label={isPresentation ? 'Qual é o tema da apresentação?' : 'Sobre o que é o conteúdo?'}
                  value={topic} onChange={e=>setTopic(e.target.value)} rows={3}
                  placeholder={isPresentation
                    ? 'Ex: proposta de expansão para o mercado brasileiro em 2027'
                    : 'Ex: como freelancers usam IA para triplicar a produtividade sem estresse'}
                  className="vc-input vc-textarea"
                />
                {/* Ganchos salvos para este nicho; um clique preenche o tema. */}
                {!isPresentation && (() => {
                  const suggestions = getHooksForNiche(hookLibrary, niche, 3);
                  if (suggestions.length === 0) return null;
                  return (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Bookmark size={10} aria-hidden/>
                        Ganchos salvos {niche ? `(nicho «${niche}»)` : ''}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {suggestions.map(h => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => setTopic(h.hook)}
                            title={`Usado ${h.usageCount}× · salvo ${new Date(h.savedAt).toLocaleDateString('pt-BR')}`}
                            style={{
                              textAlign: 'left', padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                              background: 'var(--bg-card)', border: '1px solid var(--border)',
                              color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-ui)',
                              letterSpacing: '-0.011em', lineHeight: 1.4,
                              transition: 'border-color 0.12s, color 0.12s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                          >
                            {h.hook}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {hasContextPack && !isPresentation && (
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6, lineHeight:1.47, letterSpacing:'-0.011em' }}>
                    {modoPersonalizado ? (
                      <>Opcional se já houver Marca e Conteúdo: você pode gerar só com esse contexto, ou preencher o nicho abaixo no lugar do tema.</>
                    ) : (
                      <>
                        {isQuickTemplatePreset(packCreative) ? (
                          <>O pacote <span style={{ fontWeight:600 }}>{CREATIVE_PRESET_BY_ID[packCreative]?.label}</span> segue o arco dos Templates prontos — use este campo ou Marca/Conteúdo como fonte do tema.</>
                        ) : (
                          <>O pacote <span style={{ fontWeight:600 }}>Tendência/Cultura</span> já traz estrutura e voz típicas — use este campo ou o material de Marca/Conteúdo como fonte para o tema desejado.</>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {!isPresentation && (
                <>
              <div>
                <label className="vc-label" htmlFor="generation-objective">O que você quer com este conteúdo?</label>
                <select id="generation-objective" className="vc-input" value={contentObjective} onChange={e => setContentObjective(e.target.value)}>
                  {CONTENT_OBJECTIVES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <p style={{ fontSize:12, color:'var(--text-secondary)', marginTop:6 }}>
                  {CONTENT_OBJECTIVES.find(o => o.id === contentObjective)?.desc}
                </p>
                {performanceSettings.account && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                  {performanceSettings.enabled === false ? 'Histórico desativado para este projeto.'
                    : performanceGuidance.preferredStructureId ? 'Seu histórico será considerado na escolha da estrutura. O tema e o pacote continuam prioritários.'
                      : 'Histórico: ainda sem comparação suficiente para este briefing. A geração segue pelo conteúdo.'}
                </p>}
              </div>

              {/* A lista completa continua disponível, mas fechada por padrão para
                  evitar uma rolagem extensa antes de a pessoa informar o pedido. */}
              <div
                data-vc-collapsible="creative-presets"
                style={{
                  border:'1px solid var(--hairline)', borderRadius:11,
                  background:'var(--bg-card)', overflow:'hidden',
                }}
              >
                <button
                  type="button"
                  aria-expanded={creativePresetsOpen}
                  aria-controls="creative-preset-options"
                  aria-label={`Escolher pacote criativo. Selecionado: ${CREATIVE_PRESET_BY_ID[packCreative]?.label}`}
                  onClick={() => setCreativePresetsOpen((current) => !current)}
                  style={{
                    width:'100%', minHeight:64, padding:'11px 14px', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
                    border:0, background:'transparent', textAlign:'left',
                    color:'var(--text-primary)', fontFamily:'var(--font-ui)',
                  }}
                >
                  <span style={{ display:'inline-flex', flexDirection:'column', gap:3, minWidth:0 }}>
                    <span style={{ fontSize:11, color:'var(--text-muted)', letterSpacing:'0.02em' }}>Pacote criativo da IA</span>
                    <span style={{ fontSize:13, fontWeight:600, letterSpacing:'-0.011em' }}>
                      {CREATIVE_PRESET_BY_ID[packCreative]?.label}
                    </span>
                    <span style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.4 }}>
                      Toque para comparar todas as estruturas.
                    </span>
                  </span>
                  <ChevronRight
                    size={17}
                    aria-hidden
                    style={{
                      flexShrink:0, color:'var(--text-muted)',
                      transform: creativePresetsOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition:'transform 0.15s var(--ease-smooth)',
                    }}
                  />
                </button>
                {creativePresetsOpen && (
                  <div
                    id="creative-preset-options"
                    role="radiogroup"
                    aria-label="Pacote criativo da IA"
                    style={{ display:'flex', flexDirection:'column', gap:8, padding:'4px 10px 10px' }}
                  >
                    {CREATIVE_PRESETS.map((p) => {
                      const on = packCreative === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => {
                            setPackCreative(p.id);
                            setCreativePresetsOpen(false);
                          }}
                          style={{
                            textAlign:'left', padding:'12px 14px', borderRadius:11,
                            border:`1px solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
                            background: on ? 'var(--accent-surface)' : 'var(--bg-card)',
                            cursor:'pointer', transition:'border-color 0.12s',
                          }}
                        >
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em' }}>{p.label}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4, lineHeight:1.4 }}>{p.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

                </>
              )}

              {isPresentation && (
                <>
                  <fieldset style={{ margin:0, padding:0, border:0, minWidth:0 }}>
                    <legend className="vc-label">Escolha o caminho da apresentação</legend>
                    <div
                      role="radiogroup"
                      aria-label="Caminho da apresentação"
                      style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:8 }}
                    >
                      {PRESENTATION_PATHS.map((route) => {
                        const selected = presentationPath === route.id;
                        return (
                          <button
                            key={route.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => selectPresentationPath(route.id)}
                            style={{
                              minHeight:88, padding:'11px 12px', borderRadius:11,
                              border:`1px solid ${selected ? 'var(--accent)' : 'var(--hairline)'}`,
                              background:selected ? 'var(--accent-surface)' : 'var(--bg-card)',
                              color:'var(--text-primary)', cursor:'pointer', textAlign:'left',
                              fontFamily:'var(--font-ui)',
                            }}
                          >
                            <span style={{ display:'block', fontSize:13, fontWeight:600, letterSpacing:'-0.011em' }}>
                              {route.label}
                            </span>
                            <span style={{ display:'block', marginTop:4, fontSize:11, lineHeight:1.4, color:'var(--text-muted)' }}>
                              {route.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <label className="vc-label" htmlFor="presentation-context">Contexto ou setor</label>
                      <input
                        id="presentation-context"
                        value={niche}
                        onChange={e => setNiche(e.target.value)}
                        placeholder="Ex: saúde, SaaS, educação"
                        className="vc-input"
                      />
                    </div>
                    <div>
                      <label className="vc-label" htmlFor="presentation-audience">Para quem será apresentada?</label>
                      <input
                        id="presentation-audience"
                        value={audience}
                        onChange={e => setAudience(e.target.value)}
                        placeholder="Ex: diretoria, clientes, turma"
                        className="vc-input"
                      />
                    </div>
                  </div>
                  <div style={{
                    fontSize:11, color:'var(--text-muted)', lineHeight:1.47,
                    padding:'10px 12px', background:'var(--bg-pearl)',
                    borderRadius:11, border:'1px solid var(--hairline)',
                  }}>
                    <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>{selectedPresentationPath.label}:</span>{' '}
                    {selectedPresentationPath.intent}
                  </div>
                </>
              )}

              {/* Modo narrativo, público-alvo, nicho — só fazem parte do fluxo Personalizado */}
              {modoPersonalizado && (
                <>
                  <ModePicker value={mode} onChange={setMode}/>
                  <ReferenceProfilesCuradoria material={material} setMaterial={setMaterial} />
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <label className="vc-label">Nicho</label>
                      <input value={niche} onChange={e=>setNiche(e.target.value)} placeholder="Ex: marketing digital" className="vc-input"/>
                    </div>
                    <div>
                      <label className="vc-label">Para quem?</label>
                      <input value={audience} onChange={e=>setAudience(e.target.value)} placeholder="Ex: empreendedores" className="vc-input"/>
                    </div>
                  </div>
                </>
              )}

              {!isPresentation && !modoPersonalizado && (
                <div
                  aria-live="polite"
                  style={{
                    fontSize:11, color:'var(--text-muted)', lineHeight:1.47, letterSpacing:'-0.011em',
                    padding:'10px 12px', background:'var(--bg-pearl)',
                    borderRadius:11, border:'1px solid var(--hairline)',
                  }}
                >
                  <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>
                    {isQuickTemplatePreset(packCreative)
                      ? `Pacote ${CREATIVE_PRESET_BY_ID[packCreative]?.label}:`
                      : 'Pacote Tendência/Cultura:'}
                  </span>{' '}
                  {isQuickTemplatePreset(packCreative)
                    ? 'estrutura de arco fixa (Templates prontos). Modo narrativo, nicho e público não são escolhidos — ajuste o tema acima, tom na Marca e a densidade nos próximos passos.'
                    : 'estrutura de arco e regras de texto vêm definidas pelo pacote. Modo narrativo, nicho e público-alvo do fluxo Personalizado não são usados aqui — ajuste o tema acima e a densidade de texto no próximo passo.'}
                </div>
              )}
            </>
          )}

          {/* ═══════════ ETAPA 2 — FORMATO ═══════════
              Padrão visual (paleta/fontes/tipografia), número de cards,
              densidade de texto e estilo da foto. Tudo o que afeta a aparência. */}
          {step === 2 && (
            <>
              {/* Padrão visual: 12 opções selecionadas a partir de referências
                  reais (NBA editorial, case study neon, luxury, viral hype...).
                  Altera APENAS cores, fontes e tipografia; não muda o pacote
                  criativo nem o leiaute dos slides. */}
              <VisualStylePicker
                value={visualPreset}
                onChange={setVisualPresetLocal}
                presets={availableVisualPresets}
                title={isPresentation ? 'Escolha um padrão de apresentação 16:9' : 'Escolha um padrão de comunicação 4:5'}
                suggestedId={isPresentation ? selectedPresentationPath.suggestedVisualPreset : null}
                aspectRatio={isPresentation ? '16 / 9' : '4 / 5'}
              />

              {/* Quantidade de cards ou slides. */}
              <div>
                <div className="vc-label" id="generation-card-count-label">
                  {isPresentation ? 'Número de slides' : 'Número de cards'}
                </div>
                <div role="group" aria-labelledby="generation-card-count-label" style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                  {(isPresentation
                    ? Array.from({ length: 11 }, (_, index) => index + 6)
                    : [3,4,5,6,7,8,9,10]
                  ).map(n=>(
                    <button type="button" key={n} aria-pressed={count === n} onClick={()=>setCount(n)} style={{
                      width:44, height:44, borderRadius:11, fontSize:15, fontWeight:600,
                      cursor:'pointer', fontFamily:'var(--font-ui)', letterSpacing:'-0.014em',
                      fontVariantNumeric:'tabular-nums',
                      transition:'background-color 0.15s var(--ease-smooth), color 0.15s var(--ease-smooth)',
                      background: count===n ? 'var(--accent)' : 'var(--bg-pearl)',
                      border: `1px solid ${count===n ? 'var(--accent)' : 'var(--hairline)'}`,
                      color: count===n ? 'var(--text-on-accent)' : 'var(--text-primary)',
                    }}>{n}</button>
                  ))}
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    minHeight: 44, padding: '0 10px', borderRadius: 11,
                    border: `1px solid ${(
                      isPresentation ? (count < 6 || count > 16) : (count < 3 || count > 10)
                    ) ? 'var(--accent)' : 'var(--hairline)'}`,
                    background: (
                      isPresentation ? (count < 6 || count > 16) : (count < 3 || count > 10)
                    ) ? 'var(--accent-surface)' : 'var(--bg-pearl)',
                    color: 'var(--text-primary)', fontSize: 12, fontWeight: 600,
                  }}>
                    Outro
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={count}
                      aria-label={isPresentation ? 'Número personalizado de slides' : 'Número personalizado de cards'}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isInteger(n) && n >= 1 && n <= 24) setCount(n);
                      }}
                      style={{
                        width: 52, height: 32, borderRadius: 8,
                        border: '1px solid var(--hairline)', background: 'var(--bg-base)',
                        color: 'var(--text-primary)', textAlign: 'center',
                        fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    />
                  </label>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Use Outro para qualquer quantidade entre 1 e 24.
                </p>
              </div>

              {/* Densidade de texto com rótulos amigáveis. O identificador interno
                  permanece para manter a compatibilidade com documentos salvos. */}
              <div>
                <label className="vc-label" id="slide-text-density-label">
                  {isPresentation ? 'Texto por slide' : 'Texto por card'}
                </label>
                <div
                  role="group"
                  aria-labelledby="slide-text-density-label"
                  style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}
                >
                  {SLIDE_TEXT_DENSITY_OPTIONS.map((opt) => {
                    const on = textDensity === opt.id;
                    const friendly = DENSITY_FRIENDLY[opt.id] || opt.label;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setTextDensity(opt.id)}
                        style={{
                          minWidth: 86, height: 44, padding: '0 14px',
                          borderRadius: 11, fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'var(--font-ui)',
                          letterSpacing: '-0.011em',
                          transition: 'background-color 0.15s var(--ease-smooth), color 0.15s var(--ease-smooth)',
                          background: on ? 'var(--accent)' : 'var(--bg-pearl)',
                          border: `1px solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
                          color: on ? 'var(--text-on-accent)' : 'var(--text-primary)',
                        }}
                      >
                        {friendly}
                      </button>
                    );
                  })}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.47,
                  letterSpacing: '-0.011em', marginTop: 4,
                }}>
                  {SLIDE_TEXT_DENSITY_OPTIONS.find(o => o.id === textDensity)?.desc}
                  {' '}
                  Valores menores geram menos caracteres nos subtítulos ao usar IA (geração e refinamento).
                </div>
              </div>

              {/* Estilo visual da foto em relação ao texto, no leiaute clássico. */}
              {!isPresentation && <div>
                <label className="vc-label" id="card-visual-style-label">Estilo dos cards</label>
                <div
                  role="group"
                  aria-labelledby="card-visual-style-label"
                  style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}
                >
                  {CARD_VISUAL_STYLE_OPTIONS.map((opt) => {
                    const on = cardStyle === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={on}
                        aria-label={`${opt.short}: ${opt.desc}`} title={`${opt.short}: ${opt.desc}`}
                        onClick={() => setCardStyle(opt.id)}
                        style={{
                          minWidth: 72, minHeight: 76, padding: '8px 6px',
                          borderRadius: 11, cursor: 'pointer',
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', gap: 4,
                          transition: 'background-color 0.15s var(--ease-smooth), color 0.15s var(--ease-smooth)',
                          background: on ? 'var(--accent)' : 'var(--bg-pearl)',
                          border: `1px solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
                          color: on ? 'var(--text-on-accent)' : 'var(--text-primary)',
                        }}
                      >
                        <PhotoRegionMiniIcon regionId={opt.id} active={on} />
                        <span style={{
                          fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-mono)',
                          letterSpacing: '0.06em', textTransform: 'uppercase',
                          textAlign: 'center', lineHeight: 1.15, maxWidth: 68,
                        }}>{opt.short}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.47,
                  letterSpacing: '-0.011em', marginTop: 4,
                }}>
                  {CARD_VISUAL_STYLE_OPTIONS.find((o) => o.id === cardStyle)?.desc}{' '}
                  Aplica-se ao leiaute clássico (sem canvas no card). Pacotes de Cultura podem alterar alguns slides (sanduíche ou tela cheia).
                </div>
              </div>}
            </>
          )}

          {/* ═══════════ ETAPA 3 — IMAGENS ═══════════ */}
          {step === 3 && (
            <>
              <fieldset style={{ margin:0, padding:0, border:0, minWidth:0 }}>
                <legend className="vc-label">O que você quer gerar?</legend>
                {hasOpenAI ? (
                  <div role="radiogroup" aria-label="Escopo da geração" style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {[
                      {
                        id:'text', label:'Só texto', withImages:false,
                        description:isPresentation
                          ? 'Gera o conteúdo do deck agora; você pode criar as imagens depois, slide a slide.'
                          : 'Gera o conteúdo agora; você pode criar as imagens depois, card a card.',
                      },
                      {
                        id:'text_images', label:'Texto e imagens', withImages:true,
                        description:`Gera o conteúdo e as imagens com ${imageProviderLabel}.`,
                      },
                    ].map((option) => {
                      const selected = wantImages === option.withImages;
                      return (
                        <label
                          key={option.id}
                          style={{
                            display:'flex', alignItems:'flex-start', gap:11,
                            padding:'12px 14px', borderRadius:11, cursor:'pointer',
                            border: selected ? '1.5px solid var(--accent)' : '1px solid var(--hairline)',
                            background: selected ? 'var(--accent-surface-strong)' : 'var(--bg-card)',
                            fontFamily:'var(--font-ui)',
                          }}
                        >
                          <input
                            type="radio"
                            name="generate-modal-scope"
                            value={option.id}
                            checked={selected}
                            onChange={() => setWantImages(option.withImages)}
                            aria-label={option.label}
                            style={{ width:18, height:18, margin:'1px 0 0', flexShrink:0, accentColor:'var(--accent)' }}
                          />
                          <span style={{ display:'flex', flexDirection:'column', gap:3, minWidth:0 }}>
                            <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em' }}>
                              {option.label}
                            </span>
                            <span style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.4, letterSpacing:'-0.011em' }}>
                              {option.description}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{
                    fontSize:13, color:'var(--text-secondary)', background:'var(--bg-pearl)',
                    border:'1px solid var(--hairline)', borderRadius:11, padding:'10px 12px',
                    fontFamily:'var(--font-ui)', lineHeight:1.47, letterSpacing:'-0.011em',
                  }}>
                    Só texto está disponível. Depois, envie um arquivo ou informe uma URL em cada {isPresentation ? 'slide' : 'card'} para adicionar imagens, ou configure uma chave OpenAI em ⚙.
                  </div>
                )}
                {!hasOpenAI && (
                  <div style={{
                    marginTop:8, fontSize:13, color:'var(--text-secondary)', background:'var(--accent-surface)',
                    border:'1px solid rgba(0,0,0,0.14)', borderRadius:8, padding:'10px 12px',
                    fontFamily:'var(--font-ui)', letterSpacing:'-0.011em', lineHeight:1.47,
                    display:'flex', flexDirection:'column', gap:8,
                  }}>
                    <div>
                      Em ⚙ → Configuração, escolha <b>OpenAI</b> (GPT Image) e cole a chave.
                    </div>
                    {onOpenKeys && (
                      <button
                        type="button"
                        onClick={() => { onClose(); setTimeout(onOpenKeys, 80); }}
                        style={{
                          alignSelf:'flex-start',
                          background:'var(--accent)', color:'var(--text-on-accent)', border:'none',
                          borderRadius:6, padding:'6px 12px', fontSize:11, fontWeight:600,
                          cursor:'pointer', fontFamily:'var(--font-ui)',
                          display:'flex', alignItems:'center', gap:6,
                        }}
                      >
                        <Settings size={12}/> Configurar chave OpenAI
                      </button>
                    )}
                  </div>
                )}
              </fieldset>

              {/* Eixos só quando vai gerar imagens agora. */}
              {hasOpenAI && wantImages && (
                <ImgParamsPanel value={params} onChange={setAxis} />
              )}
            </>
          )}

          {/* ═══════════ ETAPA 4 — REVISÃO ═══════════
              Resumo das escolhas, contexto aplicado e eventuais erros. */}
          {step === 4 && (
            <>
              {/* Resumo das escolhas antes da ação final. */}
              <div style={{
                padding:'14px 16px', borderRadius:11,
                border:'1px solid var(--hairline)', background:'var(--bg-pearl)',
                display:'flex', flexDirection:'column', gap:10,
              }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', fontFamily:'var(--font-ui)', letterSpacing:'0.04em', textTransform:'uppercase' }}>
                  Pronto para gerar
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'minmax(0,auto) 1fr', columnGap:14, rowGap:8, fontSize:13, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em', alignItems:'center' }}>
                  <span style={{ color:'var(--text-muted)' }}>Produto</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:600 }}>{productNarrative.name} · {productNarrative.format}</span>

                  <span style={{ color:'var(--text-muted)' }}>Tema</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:500 }}>
                    {resolvedGenerationTopic.length > 100
                      ? `${resolvedGenerationTopic.slice(0, 100)}…`
                      : resolvedGenerationTopic}
                  </span>

                  {isPresentation ? (
                    <>
                      <span style={{ color:'var(--text-muted)' }}>Caminho</span>
                      <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{selectedPresentationPath.label}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ color:'var(--text-muted)' }}>Pacote</span>
                      <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{CREATIVE_PRESET_BY_ID[packCreative]?.label}</span>
                    </>
                  )}

                  {modoPersonalizado && (
                    <>
                      <span style={{ color:'var(--text-muted)' }}>Modo narrativo</span>
                      <span style={{ color:'var(--text-primary)', fontWeight:500, display:'inline-flex', alignItems:'center', gap:6 }}>
                        {(() => {
                          const ModeIc = GEN_MODE_BY_ID[mode]?.Icon;
                          return ModeIc ? <ModeIc size={13} strokeWidth={2} style={{ color:'var(--text-secondary)', flexShrink:0 }} /> : null;
                        })()}
                        {genModeUiLabel(mode, GEN_MODE_BY_ID[mode]?.label)}
                      </span>
                    </>
                  )}

                  {!isPresentation && (
                    <>
                      <span style={{ color:'var(--text-muted)' }}>Objetivo</span>
                      <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{CONTENT_OBJECTIVES.find(o => o.id === contentObjective)?.label}</span>
                    </>
                  )}
                  <span style={{ color:'var(--text-muted)' }}>Revisão do texto</span>
                  <span style={{ color:'var(--text-primary)' }}>Incluída — confere clareza, repetição e coerência antes de abrir o editor.</span>
                  <span style={{ color:'var(--text-muted)' }}>{isPresentation ? 'Slides' : 'Cards'}</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:500, fontVariantNumeric:'tabular-nums' }}>{count}</span>

                  <span style={{ color:'var(--text-muted)' }}>Densidade</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{DENSITY_FRIENDLY[textDensity] || textDensity}</span>

                  {!isPresentation && (
                    <>
                      <span style={{ color:'var(--text-muted)' }}>Estilo</span>
                      <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{CARD_VISUAL_STYLE_OPTIONS.find(o=>o.id===cardStyle)?.short}</span>
                    </>
                  )}

                  <span style={{ color:'var(--text-muted)' }}>Escopo</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:500 }}>
                    {hasOpenAI && wantImages ? 'Texto e imagens' : 'Só texto'}
                  </span>
                </div>
              </div>

              {/* Contexto que será incluído no pedido enviado à IA. */}
              {((brandSummary && brandSummary.length) || (materialSummary && materialSummary.length)) && (
                <div style={{
                  fontSize:13, color:'var(--text-secondary)', background:'var(--success-surface)',
                  border:'1px solid var(--success-border)', borderRadius:8, padding:'10px 12px', letterSpacing:'-0.011em',
                  fontFamily:'var(--font-ui)', lineHeight:1.5,
                }}>
                  <div style={{ fontWeight:600, color:'var(--success-text)', marginBottom:6, fontSize:12, letterSpacing:'-0.011em' }}>
                    Contexto aplicado nesta geração
                  </div>
                  {brandSummary && brandSummary.length > 0 && (
                    <div>Marca: {brandSummary.join(', ')}</div>
                  )}
                  {materialSummary && materialSummary.length > 0 && (
                    <div>Conteúdo: {materialSummary.join(', ')}</div>
                  )}
                </div>
              )}

              {/* Explica a escolha da etapa 3 sem oferecer uma segunda decisão. */}
              <div style={{
                fontSize:11, color:'var(--text-muted)', lineHeight:1.47, letterSpacing:'-0.011em',
                padding:'10px 12px', borderRadius:11, border:'1px solid var(--hairline)', background:'var(--bg-card)',
              }}>
                {hasOpenAI && wantImages ? (
                  <>
                    <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>Texto e imagens:</span> a geração leva mais tempo e usa créditos do provedor de imagem.
                  </>
                ) : (
                  <>
                    <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>Só texto:</span> gera o conteúdo agora; as imagens podem ser criadas depois, {isPresentation ? 'slide a slide' : 'card a card'}.
                  </>
                )}
              </div>

              {err && (
                <div role="alert" aria-live="assertive" style={{
                  fontSize:13, color:'var(--danger-text)', background:'rgba(255,59,48,0.10)', letterSpacing:'-0.011em',
                  border:'1px solid #7f1d1d', borderRadius:8, padding:'10px 14px',
                  fontFamily:'var(--font-ui)',
                }}>{err}</div>
              )}
            </>
          )}
        </div>

        {/* ═══════════ RODAPÉ FIXO ═══════════
            Voltar ou Cancelar à esquerda; Continuar nas etapas 1 a 3; e uma
            única ação de geração na etapa 4. */}
        <div style={{
          display:'flex', gap:8, padding:'14px 20px',
          borderTop:'1px solid var(--border)',
          background:'var(--bg-sidebar)', flexShrink:0,
          paddingBottom:'max(14px, env(safe-area-inset-bottom, 0px))',
          alignItems:'center', flexWrap:'wrap',
        }}>
          <button
            onClick={busy ? onCancelGeneration : (step === 1 ? onClose : () => setStep(step - 1))}
            className="vc-btn vc-btn-ghost"
            style={{ height:44, padding:'0 16px', display:'inline-flex', alignItems:'center', gap:6 }}
          >
            {!busy && step > 1 && <ChevronLeft size={15}/>}
            {busy ? 'Cancelar geração' : (step === 1 ? 'Cancelar' : 'Voltar')}
          </button>
          <div style={{ flex:1 }}/>
          {step < 4 && (
            <button
              type="button"
              onClick={() => canProceed && setStep(step + 1)}
              disabled={!canProceed || busy}
              title={!canProceed
                ? `Informe o tema (ou ${isPresentation ? 'contexto' : 'nicho'}, ou contexto Marca/Conteúdo) para continuar`
                : 'Próximo passo'}
              style={{
                height:44, minWidth:160, padding:'0 22px', borderRadius:9999, border:'none',
                cursor: (canProceed && !busy) ? 'pointer' : 'not-allowed',
                background: (canProceed && !busy) ? 'var(--accent)' : 'var(--bg-pearl)',
                color: (canProceed && !busy) ? 'var(--text-on-accent)' : 'var(--text-muted)',
                fontSize:14, fontWeight:600, fontFamily:'var(--font-ui)', letterSpacing:'-0.014em',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                opacity: (canProceed && !busy) ? 1 : 0.6,
                transition: 'background-color 0.15s var(--ease-smooth)',
              }}
            >
              Continuar <ChevronRight size={15}/>
            </button>
          )}
          {step === 4 && (
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              {/* A ação final respeita a única escolha feita na etapa 3. */}
              <button
                type="button"
                aria-label={hasOpenAI && wantImages
                  ? (isPresentation ? 'Gerar apresentação com imagens' : 'Gerar texto e imagens')
                  : (isPresentation ? 'Gerar apresentação' : 'Gerar só texto')}
                onClick={() => run({ withImages: !!(hasOpenAI && wantImages) })}
                disabled={busy || !resolvedGenerationTopic || (wantImages && !hasOpenAI)}
                title={
                  hasOpenAI && wantImages
                    ? `Gera texto e imagens com ${imageProviderLabel}`
                    : `Gera só texto. Você pode criar cada imagem depois, no respectivo ${isPresentation ? 'slide' : 'card'}.`
                }
                style={{
                  height:44, padding:'0 18px', borderRadius:9999, border:'none',
                  cursor: (busy || !resolvedGenerationTopic || (wantImages && !hasOpenAI)) ? 'not-allowed' : 'pointer',
                  background: (busy || !resolvedGenerationTopic || (wantImages && !hasOpenAI)) ? 'var(--bg-pearl)' : 'var(--accent)',
                  color: (busy || !resolvedGenerationTopic || (wantImages && !hasOpenAI)) ? 'var(--text-muted)' : 'var(--text-on-accent)',
                  fontSize:14, fontWeight:600, fontFamily:'var(--font-ui)',
                  letterSpacing:'-0.014em',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  transition:'background-color 0.15s var(--ease-smooth)',
                  opacity: (busy || !resolvedGenerationTopic || (wantImages && !hasOpenAI)) ? 0.6 : 1,
                }}
              >
                {busy
                  ? <><Loader2 size={15} style={{animation:'spin 0.8s linear infinite'}}/>Gerando…</>
                  : hasOpenAI && wantImages
                    ? <><Sparkles size={15}/>{isPresentation ? 'Gerar com Moont Apresenta + imagens' : 'Gerar com Moont Comunica + imagens'}</>
                    : <><Sparkles size={15}/>{isPresentation ? 'Gerar com Moont Apresenta' : 'Gerar com Moont Comunica'}</>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export {
  normalizeCardVisualStyle,
  CARD_VISUAL_STYLE_OPTIONS,
  QUICK_TEMPLATE_NARRATIVE_MODE,
  filterVisualPresetsForProduct,
  resolveInitialVisualPreset,
  GenerateModal,
};
