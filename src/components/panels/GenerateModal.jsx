// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, Loader2, Bookmark, X, Upload, ChevronRight, ChevronLeft, Check, Settings } from 'lucide-react';
import { getHooksForNiche } from '../../utils/hooks-library.js';
import VisualStylePicker from '../VisualStylePicker.jsx';
import { VISUAL_PRESETS } from '../../styles/visual-presets.jsx';
import { SectionLabel as S } from '../ui/SectionLabel.jsx';
import { GEN_MODE_BY_ID, CREATIVE_PRESETS, CREATIVE_PRESET_BY_ID, SLIDE_TEXT_DENSITY_OPTIONS, quickTemplateIdFromPreset, isQuickTemplatePreset } from '../../utils/generation-prompts.js';
import { ModePicker, ReferenceProfilesCuradoria, ImgParamsPanel } from './generate-modal-parts.jsx';
import { PhotoRegionMiniIcon } from '../ui/mini-icons.jsx';
import { CARD_VISUAL_STYLE_IDS } from '../../utils/doc-schema.js';

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

/** Modo narrativo interno por arquétipo (template) — utilizador não escolhe (só em Personalizado). */
const QUICK_TEMPLATE_NARRATIVE_MODE = {
  erro_comum: 'editorial',
  tendencia: 'editorial',
  decodificacao: 'deep',
  comportamento: 'storytelling',
};

function GenerateModal({
  open, onClose, onGenerate,
  defaultNiche='', defaultTopic='', defaultTone='', defaultAudience='',
  hasOpenAI=false, hasAnthropic=false, onOpenKeys,
  imageProviderLabel = 'GPT Image 2',
  brandSummary, materialSummary,
  onGoToMaterial,
  imgParams = { fidelity:50, creativity:50, irreverence:50, objectivity:50 },
  onImgParamsChange,
  mode: defaultMode = 'editorial',
  onModeChange,
  creativePreset: defaultCreativePreset = 'livre',
  onCreativePresetChange,
  slideTextDensity: defaultSlideTextDensity = '1_1',
  onSlideTextDensityChange,
  cardVisualStyle: defaultCardVisualStyle = 'full',
  onCardVisualStyleChange,
  visualPreset: defaultVisualPreset = null,
  onVisualPresetChange,
  material = { content: '', sources: '', context: '', refProfileId: null },
  setMaterial = () => {},
  hookLibrary = [],
}) {
  const [topic, setTopic] = useState(defaultTopic);
  const [count, setCount] = useState(6);
  const [niche, setNiche] = useState(defaultNiche);
  const [audience, setAudience] = useState(defaultAudience || '');
  const [mode, setMode] = useState(defaultMode);
  const [packCreative, setPackCreative] = useState(defaultCreativePreset || 'livre');
  const [textDensity, setTextDensity] = useState(defaultSlideTextDensity || '1_1');
  useEffect(() => { if (open) setMode(defaultMode); }, [open, defaultMode]);
  useEffect(() => { if (open) setPackCreative(defaultCreativePreset || 'livre'); }, [open, defaultCreativePreset]);
  useEffect(() => { if (open) setTextDensity(defaultSlideTextDensity || '1_1'); }, [open, defaultSlideTextDensity]);
  const [cardStyle, setCardStyle] = useState(() => normalizeCardVisualStyle(defaultCardVisualStyle));
  useEffect(() => {
    if (open) setCardStyle(normalizeCardVisualStyle(defaultCardVisualStyle));
  }, [open, defaultCardVisualStyle]);
  // Padrão visual selecionado (paleta + fontes + tipografia). Null = mantém
  // marca atual sem mudanças. Aplicado ao brand no momento de gerar.
  const [visualPreset, setVisualPresetLocal] = useState(defaultVisualPreset);
  useEffect(() => { if (open) setVisualPresetLocal(defaultVisualPreset); }, [open, defaultVisualPreset]);
  // Cópia local mutável dos eixos da imagem (commit no doc só ao gerar)
  const [params, setParams] = useState(imgParams);
  useEffect(() => { if (open) setParams(imgParams); }, [open, imgParams]);
  const setAxis = (key, val) => setParams(p => ({ ...p, [key]: val }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Wizard multi-step: 1=Ideia, 2=Formato, 3=Imagens, 4=Revisão.
  // Reset pra step 1 sempre que reabre — usuário pega o fluxo limpo.
  const [step, setStep] = useState(1);
  useEffect(() => { if (open) setStep(1); }, [open]);
  const STEPS = useMemo(() => ([
    { id: 1, label: 'Ideia' },
    { id: 2, label: 'Formato' },
    { id: 3, label: 'Imagens' },
    { id: 4, label: 'Revisão' },
  ]), []);
  // Labels amigáveis para densidade (IDs internos preservados pra compatibilidade
  // com docs salvos). "1/1, 1/2..." era abstrato — "Denso/Balanceado/Minimal"
  // comunica intenção direta.
  const DENSITY_FRIENDLY = useMemo(() => ({
    '1_1': 'Denso',
    '1_2': 'Balanceado',
    '1_3': 'Médio',
    '1_4': 'Minimal',
    '1_5': 'Mínimo',
  }), []);

  useEffect(()=>{ if(open){ setErr(''); if(defaultTopic) setTopic(defaultTopic); } },[open,defaultTopic]);
  useEffect(()=>{ if(defaultNiche) setNiche(defaultNiche); },[defaultNiche]);
  useEffect(()=>{ if(defaultAudience) setAudience(defaultAudience); },[defaultAudience]);

  const hasMaterialPack =
    Array.isArray(materialSummary) && materialSummary.length > 0;
  const hasContextPack =
    (Array.isArray(brandSummary) && brandSummary.length > 0) ||
    hasMaterialPack;
  /** Personalizado (`livre`) expõe modo narrativo, nicho e público (tom base vem da Marca). Demais pacotes trazem estrutura fixa. */
  const modoPersonalizado = packCreative === 'livre';
  const narrativeLockedForPack =
    !modoPersonalizado && isQuickTemplatePreset(packCreative)
      ? (QUICK_TEMPLATE_NARRATIVE_MODE[quickTemplateIdFromPreset(packCreative)] || 'editorial')
      : null;
  /** Tema digitado OU nicho OU Marca/Material preenchidos — evita botão morto só com contexto injetado. */
  const resolvedGenerationTopic = (() => {
    const t = topic.trim();
    if (t) return t;
    if (modoPersonalizado && niche.trim()) return `Conteúdo focado no nicho: ${niche.trim()}`;
    if (hasContextPack) return 'Conteúdo baseado no material de referência e na identidade da marca.';
    return '';
  })();

  // Step 1 exige tema válido (resolvedGenerationTopic já cobre fallbacks
  // de nicho/contexto). Demais steps liberados — usuário pode revisar valores
  // default e seguir adiante.
  const canProceed = step === 1 ? !!resolvedGenerationTopic : true;

  if (!open) return null;

  const run = async ({ withImages } = { withImages: true }) => {
    if (!resolvedGenerationTopic) {
      setErr(
        modoPersonalizado
          ? 'Informe o tema em “Sobre o que é o conteúdo?”, ou o nicho, ou preencha Marca e Conteúdo.'
          : 'Informe o tema em “Sobre o que é o conteúdo?” ou preencha Marca e Conteúdo.',
      );
      return;
    }
    setBusy(true); setErr('');
    try {
      const toneFromBrand = (defaultTone || '').trim() || 'direto e provocativo';
      const narrativeForGenerate = modoPersonalizado
        ? mode
        : (narrativeLockedForPack ?? 'editorial');
      onImgParamsChange?.(params);
      onModeChange?.(narrativeForGenerate);
      onCreativePresetChange?.(packCreative);
      onSlideTextDensityChange?.(textDensity);
      onCardVisualStyleChange?.(cardStyle);
      // Aplica padrão visual ao brand ANTES da geração — IA usa as cores
      // novas pra recomendar paleta consistente nos slides.
      if (visualPreset && onVisualPresetChange) onVisualPresetChange(visualPreset);
      await onGenerate({
        topic: resolvedGenerationTopic,
        count,
        niche: modoPersonalizado ? niche : '',
        tone: toneFromBrand,
        audience: modoPersonalizado ? audience : '',
        imgMode: 'dalle',
        imgParams: params,
        mode: narrativeForGenerate,
        creativePreset: packCreative,
        slideTextDensity: textDensity,
        cardVisualStyle: cardStyle,
        fetchImagesNow: !!withImages,
      });
      onClose();
    } catch(e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel vc-modal-scroll" onClick={e=>e.stopPropagation()}>
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
              <Sparkles size={14} color="#fff"/>
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>Configurar carrossel</div>
              <div className="vc-eyebrow">Passo {step} de {STEPS.length} · {STEPS[step-1].label}</div>
            </div>
          </div>
          <button onClick={onClose} className="vc-icon-btn" aria-label="Fechar">
            <X size={16}/>
          </button>
        </div>

        {/* Stepper — clicável apenas pra steps já alcançados; avanço é controlado
            pelo Continuar (que valida campos obrigatórios). */}
        <div role="tablist" aria-label="Etapas do wizard" style={{
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
                  color: (isActive || isCompleted) ? '#fff' : 'var(--text-muted)',
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
          className="vc-modal-scroll-body"
          id={`gen-step-${step}`}
          role="tabpanel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            padding: '16px 20px',
            paddingBottom: 24,
          }}
        >
          {/* ═══════════ STEP 1 — IDEIA ═══════════
              Pacote criativo, tema, hooks salvos. Personalizado expõe modo
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
                        Vai gerar só pelo tema abaixo? Para basear o carrossel em{' '}
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
                      color:'#fff', fontSize:13, fontWeight:600,
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

              {/* Pacote criativo — primeiro: define se há camada editorial fixa ou fluxo personalizado */}
              <div>
                <label className="vc-label">Pacote criativo da IA</label>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {CREATIVE_PRESETS.map((p) => {
                    const on = packCreative === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPackCreative(p.id)}
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
              </div>

              {/* Topic */}
              <div>
                <label className="vc-label">Sobre o que é o conteúdo?</label>
                <textarea
                  value={topic} onChange={e=>setTopic(e.target.value)} rows={3}
                  placeholder="Ex: como freelancers usam IA para triplicar a produtividade sem estresse"
                  className="vc-input vc-textarea"
                />
                {/* B2: Hooks salvos pra este nicho — clicar preenche o tema */}
                {(() => {
                  const suggestions = getHooksForNiche(hookLibrary, niche, 3);
                  if (suggestions.length === 0) return null;
                  return (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Bookmark size={10} aria-hidden/>
                        Hooks salvos {niche ? `(nicho «${niche}»)` : ''}
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
                {hasContextPack && (
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6, lineHeight:1.47, letterSpacing:'-0.011em' }}>
                    {modoPersonalizado ? (
                      <>Opcional se já houver Marca e Conteúdo: você pode gerar só com esse contexto, ou preencher o nicho abaixo no lugar do tema.</>
                    ) : (
                      <>
                        {isQuickTemplatePreset(packCreative) ? (
                          <>O pacote <span style={{ fontWeight:600 }}>{CREATIVE_PRESET_BY_ID[packCreative]?.label}</span> segue o arco dos Templates prontos — use este campo ou Marca/Conteúdo como fonte do tema.</>
                        ) : (
                          <>O pacote <span style={{ fontWeight:600 }}>Tendência/Cultura</span> já traz estrutura e voz típicas — use este campo ou o material de Marca/Conteúdo como fonte para o tema em jogo.</>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

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

              {!modoPersonalizado && (
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

          {/* ═══════════ STEP 2 — FORMATO ═══════════
              Padrão visual (paleta/fontes/tipografia), número de cards,
              densidade de texto, estilo da foto. Tudo que afeta o look. */}
          {step === 2 && (
            <>
              {/* Padrão visual — 12 presets curados extraídos de referências
                  reais (NBA editorial, case study neon, luxury, viral hype...).
                  Override APENAS de cores/fontes/tipografia — não mexe em
                  creativePreset nem layout dos slides. */}
              <VisualStylePicker
                value={visualPreset}
                onChange={setVisualPresetLocal}
                presets={VISUAL_PRESETS}
              />

              {/* Slide count — decisão imediata pro usuário */}
              <div>
                <label className="vc-label">Número de cards</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {[3,4,5,6,7,8,9,10].map(n=>(
                    <button key={n} onClick={()=>setCount(n)} style={{
                      width:44, height:44, borderRadius:11, fontSize:15, fontWeight:600,
                      cursor:'pointer', fontFamily:'var(--font-ui)', letterSpacing:'-0.014em',
                      fontVariantNumeric:'tabular-nums',
                      transition:'background-color 0.15s var(--ease-smooth), color 0.15s var(--ease-smooth)',
                      background: count===n ? 'var(--accent)' : 'var(--bg-pearl)',
                      border: `1px solid ${count===n ? 'var(--accent)' : 'var(--hairline)'}`,
                      color: count===n ? '#fff' : 'var(--text-primary)',
                    }}>{n}</button>
                  ))}
                </div>
              </div>

              {/* Densidade de texto — labels amigáveis (DENSITY_FRIENDLY). ID interno
                  preservado pra compat com docs salvos. */}
              <div>
                <label className="vc-label" id="slide-text-density-label">Texto por card</label>
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
                          color: on ? '#fff' : 'var(--text-primary)',
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

              {/* Estilo visual da foto vs texto (layout clássico) */}
              <div>
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
                        title={`${opt.short}: ${opt.desc}`}
                        onClick={() => setCardStyle(opt.id)}
                        style={{
                          minWidth: 72, minHeight: 76, padding: '8px 6px',
                          borderRadius: 11, cursor: 'pointer',
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', gap: 4,
                          transition: 'background-color 0.15s var(--ease-smooth), color 0.15s var(--ease-smooth)',
                          background: on ? 'var(--accent)' : 'var(--bg-pearl)',
                          border: `1px solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
                          color: on ? '#fff' : 'var(--text-primary)',
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
                  Aplica-se ao layout clássico (sem canvas no card). Pacotes Cultura podem alterar alguns slides (sanduíche / tela cheia).
                </div>
              </div>
            </>
          )}

          {/* ═══════════ STEP 3 — IMAGENS ═══════════ */}
          {step === 3 && (
            <>
              <div>
                <label className="vc-label">Imagens dos Cards</label>
                {hasOpenAI ? (
                  <div style={{
                    padding:'10px 12px', borderRadius:8, border:'1.5px solid var(--accent)',
                    background:'var(--accent-surface-strong)', position:'relative',
                  }}>
                    <span style={{
                      position:'absolute', top:-9, right:8, fontSize:11, fontWeight:600,
                      background:'var(--accent)', color:'#fff', padding:'2px 9px', borderRadius:9999,
                      letterSpacing:'-0.011em',
                    }}>Ativo</span>
                    <div style={{ fontSize:13, fontWeight:600, fontFamily:'var(--font-ui)', color:'var(--text-primary)', marginBottom:3, letterSpacing:'-0.011em' }}>
                      {imageProviderLabel}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>
                      Geração a partir do tema e das palavras-chave de cada slide
                    </div>
                  </div>
                ) : (
                  <div style={{
                    fontSize:13, color:'var(--text-secondary)', background:'var(--bg-pearl)',
                    border:'1px solid var(--hairline)', borderRadius:11, padding:'10px 12px',
                    fontFamily:'var(--font-ui)', lineHeight:1.47, letterSpacing:'-0.011em',
                  }}>
                    Sem provedor de imagem, o carrossel sai com texto e palavras-chave. Depois use Upload/URL em cada card, ou configure OpenAI/Z.ai em ⚙.
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
                      Em ⚙ → Configuração escolha <b>OpenAI</b> (GPT Image) ou <b>Z.ai</b> (CogView/GLM-Image) e cole a chave.
                    </div>
                    {onOpenKeys && (
                      <button
                        type="button"
                        onClick={() => { onClose(); setTimeout(onOpenKeys, 80); }}
                        style={{
                          alignSelf:'flex-start',
                          background:'var(--accent)', color:'#fff', border:'none',
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
              </div>

              {/* Eixos só alteram prompts do GPT Image (geração). */}
              {hasOpenAI && (
                <ImgParamsPanel value={params} onChange={setAxis} />
              )}
            </>
          )}

          {/* ═══════════ STEP 4 — REVISÃO ═══════════
              Recap das escolhas + contexto aplicado + erros. Botões de gerar
              vivem no footer fixo, mas mostramos aqui o hint do que cada um faz. */}
          {step === 4 && (
            <>
              {/* Recap das escolhas — comunicação clara antes do clique final */}
              <div style={{
                padding:'14px 16px', borderRadius:11,
                border:'1px solid var(--hairline)', background:'var(--bg-pearl)',
                display:'flex', flexDirection:'column', gap:10,
              }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', fontFamily:'var(--font-ui)', letterSpacing:'0.04em', textTransform:'uppercase' }}>
                  Pronto pra gerar
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'minmax(0,auto) 1fr', columnGap:14, rowGap:8, fontSize:13, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em', alignItems:'center' }}>
                  <span style={{ color:'var(--text-muted)' }}>Tema</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:500 }}>
                    {resolvedGenerationTopic.length > 100
                      ? `${resolvedGenerationTopic.slice(0, 100)}…`
                      : resolvedGenerationTopic}
                  </span>

                  <span style={{ color:'var(--text-muted)' }}>Pacote</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{CREATIVE_PRESET_BY_ID[packCreative]?.label}</span>

                  {modoPersonalizado && (
                    <>
                      <span style={{ color:'var(--text-muted)' }}>Modo narrativo</span>
                      <span style={{ color:'var(--text-primary)', fontWeight:500, display:'inline-flex', alignItems:'center', gap:6 }}>
                        {(() => {
                          const ModeIc = GEN_MODE_BY_ID[mode]?.Icon;
                          return ModeIc ? <ModeIc size={13} strokeWidth={2} style={{ color:'var(--text-secondary)', flexShrink:0 }} /> : null;
                        })()}
                        {GEN_MODE_BY_ID[mode]?.label}
                      </span>
                    </>
                  )}

                  <span style={{ color:'var(--text-muted)' }}>Cards</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:500, fontVariantNumeric:'tabular-nums' }}>{count}</span>

                  <span style={{ color:'var(--text-muted)' }}>Densidade</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{DENSITY_FRIENDLY[textDensity] || textDensity}</span>

                  <span style={{ color:'var(--text-muted)' }}>Estilo</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{CARD_VISUAL_STYLE_OPTIONS.find(o=>o.id===cardStyle)?.short}</span>

                  <span style={{ color:'var(--text-muted)' }}>Imagens</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:500 }}>
                    {hasOpenAI ? imageProviderLabel : 'Só palavras-chave'}
                  </span>
                </div>
              </div>

              {/* Contexto que será injetado no prompt — feedback claro pro user */}
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

              {/* Hint pros 2 botões do footer */}
              <div style={{
                fontSize:11, color:'var(--text-muted)', lineHeight:1.47, letterSpacing:'-0.011em',
                padding:'10px 12px', borderRadius:11, border:'1px solid var(--hairline)', background:'var(--bg-card)',
              }}>
                <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>Texto + imagem:</span> mais lento, usa créditos do provedor de imagem.
                {' '}
                <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>Só texto:</span> rápido — você gera as imagens depois, card a card.
              </div>

              {err && (
                <div style={{
                  fontSize:13, color:'#c5251c', background:'rgba(255,59,48,0.10)', letterSpacing:'-0.011em',
                  border:'1px solid #7f1d1d', borderRadius:8, padding:'10px 14px',
                  fontFamily:'var(--font-ui)',
                }}>{err}</div>
              )}
            </>
          )}
        </div>

        {/* ═══════════ FOOTER FIXO ═══════════
            Voltar/Cancelar à esquerda, Continuar (steps 1-3) ou Gerar (step 4)
            à direita. Continuar valida canProceed; em step 4 mostra 2 botões
            de geração com mesma lógica de disabled da versão antiga. */}
        <div style={{
          display:'flex', gap:8, padding:'14px 20px',
          borderTop:'1px solid var(--border)',
          background:'var(--bg-sidebar)', flexShrink:0,
          paddingBottom:'max(14px, env(safe-area-inset-bottom, 0px))',
          alignItems:'center', flexWrap:'wrap',
        }}>
          <button
            onClick={step === 1 ? onClose : () => setStep(step - 1)}
            disabled={busy}
            className="vc-btn vc-btn-ghost"
            style={{ height:44, padding:'0 16px', display:'inline-flex', alignItems:'center', gap:6 }}
          >
            {step > 1 && <ChevronLeft size={15}/>}
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>
          <div style={{ flex:1 }}/>
          {step < 4 && (
            <button
              type="button"
              onClick={() => canProceed && setStep(step + 1)}
              disabled={!canProceed || busy}
              title={!canProceed ? 'Informe o tema (ou nicho, ou contexto Marca/Conteúdo) para continuar' : 'Próximo passo'}
              style={{
                height:44, minWidth:160, padding:'0 22px', borderRadius:9999, border:'none',
                cursor: (canProceed && !busy) ? 'pointer' : 'not-allowed',
                background: (canProceed && !busy) ? 'var(--accent)' : 'var(--bg-pearl)',
                color: (canProceed && !busy) ? '#fff' : 'var(--text-muted)',
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
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
              {/* Secundário: só texto + imageQuery. Rápido e barato. */}
              <button
                type="button"
                onClick={() => run({ withImages: false })}
                disabled={busy || !resolvedGenerationTopic}
                title="Gera só texto e palavras-chave da imagem (rápido). Você pode gerar cada imagem depois no botão «Gerar imagem» do card."
                style={{
                  height:44, padding:'0 18px', borderRadius:9999,
                  cursor: (busy || !resolvedGenerationTopic) ? 'not-allowed' : 'pointer',
                  background: 'var(--bg-pearl)', color: 'var(--text-primary)',
                  fontSize:14, fontWeight:600, fontFamily:'var(--font-ui)',
                  letterSpacing:'-0.014em', border:'1px solid var(--border)',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  transition:'border-color 0.15s, background 0.15s',
                  opacity: (busy || !resolvedGenerationTopic) ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (!busy && resolvedGenerationTopic) e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <Sparkles size={15} style={{ color: 'var(--text-muted)' }}/>Só texto
              </button>
              {/* Primário: texto + imagens GPT Image. Disabled se sem OpenAI. */}
              <button
                type="button"
                onClick={() => run({ withImages: true })}
                disabled={busy || !resolvedGenerationTopic || !hasOpenAI}
                title={!hasOpenAI ? 'Configure o provedor de imagem em ⚙' : `Gera texto E imagens (${imageProviderLabel})`}
                style={{
                  height:44, padding:'0 18px', borderRadius:9999, border:'none',
                  cursor: (busy || !resolvedGenerationTopic || !hasOpenAI) ? 'not-allowed' : 'pointer',
                  background: (busy || !resolvedGenerationTopic || !hasOpenAI) ? 'var(--bg-pearl)' : 'var(--accent)',
                  color: (busy || !resolvedGenerationTopic || !hasOpenAI) ? 'var(--text-muted)' : '#fff',
                  fontSize:14, fontWeight:600, fontFamily:'var(--font-ui)',
                  letterSpacing:'-0.014em',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  transition:'background-color 0.15s var(--ease-smooth)',
                  opacity: (busy || !resolvedGenerationTopic || !hasOpenAI) ? 0.6 : 1,
                }}
              >
                {busy
                  ? <><Loader2 size={15} style={{animation:'spin 0.8s linear infinite'}}/>Gerando…</>
                  : <><Sparkles size={15}/>Texto + imagem</>
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
  GenerateModal,
};
