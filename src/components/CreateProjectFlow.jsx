import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, X } from 'lucide-react';
import BrandLogo from './BrandLogo.jsx';
import VisualStylePicker from './VisualStylePicker.jsx';
import { ImgParamsPanel } from './panels/generate-modal-parts.jsx';
import { CREATIVE_PRESETS, quickTemplateIdFromPreset } from '../utils/generation-prompts.js';
import { TITLE_FONTS } from '../utils/design-data.js';
import { BODY_FONTS } from '../utils/brand-visuals.js';
import { sanitizeCustomVisualPresetBrand } from '../utils/custom-visual-presets.js';
import { CONTENT_OBJECTIVES } from '../utils/editorial-strategy.js';
import { PRESENTATION_PATHS, getPresentationPath } from '../utils/presentation.js';
import { VISUAL_PRESETS } from '../styles/visual-presets.jsx';
import { PRESENTATION_VISUAL_PRESETS } from '../styles/presentation-presets.jsx';
import { normalizeStyleKit, MAX_REF_IMAGES, CONTEXT_MD_MAX, STYLE_PROMPT_MAX } from '../utils/style-kit.js';
import { storeProjectReference } from '../utils/style-kit-storage.js';
import { projectLogoFromStored, storeSlideLogo } from '../utils/slide-logo.js';
import { CREATION_STEPS, NARRATIVE_CHOICES, CREATION_DENSITIES, cloneCreationBrand, validCreationCount, creationMaterialHasContent, readCreationTextFile, neutralCreationIdentity, creationIdentitySummary, captureCreationVisualIdentity, applyCreationVisualChoice } from '../utils/create-project-flow.js';
import '../styles/create-project-flow.css';

const PATH_LABELS = { auto:'Deixar o Moont organizar', pitch:'Apresentar um negócio — Pitch', aula_workshop:'Ensinar — Aula ou workshop', proposta_comercial:'Vender uma solução — Proposta', relatorio_executivo:'Mostrar resultados — Relatório', estudo_de_caso:'Demonstrar uma transformação — Caso', keynote_manifesto:'Defender uma visão — Palestra' };
const PATH_EXAMPLES = { auto:'Transforme meu material em uma apresentação clara.', pitch:'Oportunidade, produto, modelo de negócio e próximo passo.', aula_workshop:'Conceitos, exemplos resolvidos e atividade prática.', proposta_comercial:'Desafio do cliente, escopo, investimento e decisão.', relatorio_executivo:'Indicadores, conclusões e recomendações para a equipe.', estudo_de_caso:'Situação inicial, trabalho realizado e resultados.', keynote_manifesto:'Uma tese, histórias que a sustentam e um chamado à ação.' };
const PACK_LABELS = { tendencia_cultura:'Interpretar uma tendência cultural', quick_erro_comum:'Mostrar um erro comum', quick_tendencia:'Explicar uma tendência de mercado', quick_decodificacao:'Decodificar um assunto', quick_comportamento:'Interpretar um comportamento' };
const PACK_DESCS = { tendencia_cultura:'Parte de um comportamento observado, explica a tensão e o que ele revela.', quick_erro_comum:'Mostra um erro recorrente, por que acontece e uma alternativa.', quick_tendencia:'Apresenta um sinal de mudança e suas consequências no mercado.', quick_decodificacao:'Desmonta um tema complexo em partes compreensíveis.', quick_comportamento:'Conecta uma situação reconhecível à sua causa e consequência.' };
const FORMAT_LABELS = { carrossel:'Feed 4:5', quadrado:'Quadrado', stories:'Stories', apresentacao:'Apresentação 16:9' };
const TITLE = ['O que você quer criar?', 'Quer usar uma identidade para este projeto?', 'Qual é a ideia?', 'Como você quer contar essa ideia?', 'Quantas páginas vamos criar?', 'Que aparência combina com a ideia?', 'Tudo pronto para criar.'];
const INTRO = ['Escolha a entrega e dê um nome ao projeto.', 'Logo, referências, cores e tom de voz são opcionais. Reutilize o que já criou ou siga com o padrão do Moont.', 'Conte o que precisa comunicar. Você também pode trazer textos, links e instruções.', 'Escolha uma forma de conduzir o conteúdo. Cada opção mostra o que muda no resultado.', 'Defina a quantidade, o formato e quanto texto quer em cada página.', 'Escolha o estilo e decida se quer gerar imagens agora.', 'Confira suas escolhas. Depois da geração, as ferramentas de edição ficam disponíveis.'];
function Field({ label, hint, children }) { return <label className="vc-create-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
function navigateChoices(event) {
  if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
  const group = event.currentTarget.closest('[role="radiogroup"]');
  const choices = [...(group?.querySelectorAll('[role="radio"]') || [])].filter(node => !node.matches(':disabled'));
  if (!choices.length) return;
  const current = choices.indexOf(event.currentTarget);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1
    : (current + (['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1) + choices.length) % choices.length;
  event.preventDefault();
  choices[next].focus();
  choices[next].click();
}
function Option({ selected, label, desc, example, onClick, disabled }) { return <button type="button" className="vc-create-option" role="radio" aria-checked={selected} disabled={disabled} onKeyDown={navigateChoices} onClick={onClick}><strong>{label}{selected && <Check size={14} aria-hidden style={{ marginLeft:8 }}/>}</strong>{desc && <span>{desc}</span>}{example && <em>Exemplo: {example}</em>}</button>; }

export default function CreateProjectFlow({
  onCreate, onCancel, onCancelGeneration, onOpenDraft, hasDraft = false,
  brandRoster = [], activeBrandId, defaultBrand = {}, initialName = '', initialProductKind = 'carrossel',
  hasOpenAI = false, hasAnthropic = false, onOpenKeys, visualPresets = [], progress,
}) {
  const initial = useRef(neutralCreationIdentity(defaultBrand));
  const identityVisualBase = useRef(captureCreationVisualIdentity(initial.current.brand));
  const identityBaseOverrides = useRef({});
  const [identityPath, setIdentityPath] = useState('moont');
  const [identityAdjustmentsOpen, setIdentityAdjustmentsOpen] = useState(false);
  const [identityVisualEdited, setIdentityVisualEdited] = useState(false);
  const [brandVisualOverrides, setBrandVisualOverrides] = useState({});
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [productKind, setProductKind] = useState(initialProductKind === 'apresentacao' ? 'apresentacao' : 'carrossel');
  const [name, setName] = useState(initialName);
  const [brandId, setBrandId] = useState('__local__');
  const [brand, setBrand] = useState(initial.current.brand);
  const [styleKit, setStyleKit] = useState(initial.current.styleKit);
  const [topic, setTopic] = useState('');
  const [material, setMaterial] = useState({ content:'', sources:'', context:'', refProfileId:null });
  const [narrative, setNarrative] = useState('editorial');
  const [path, setPath] = useState('auto');
  const [objective, setObjective] = useState('auto');
  const [count, setCount] = useState(initialProductKind === 'apresentacao' ? '10' : '6');
  const [countEdited, setCountEdited] = useState(false);
  const [formatId, setFormatId] = useState(initialProductKind === 'apresentacao' ? 'apresentacao' : 'carrossel');
  const [density, setDensity] = useState('1_2');
  const [visualPreset, setVisualPreset] = useState(null);
  const [cardStyle, setCardStyle] = useState('full');
  const [wantImages, setWantImages] = useState(false);
  const [params, setParams] = useState({ fidelity:50, creativity:50, irreverence:50, objectivity:50 });
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importedNames, setImportedNames] = useState([]);
  const alive = useRef(true);
  const asyncVersion = useRef(0);
  const pendingRef = useRef(false);
  const busyRef = useRef(false);
  const mainRef = useRef(null);
  const isPresentation = productKind === 'apresentacao';
  const item = isPresentation ? 'slides' : 'cards';
  const quantityUnit = !isPresentation && Number(count) === 1 ? 'card' : item;
  const minCount = isPresentation ? 5 : 1;
  const hasTextAI = hasOpenAI || hasAnthropic;
  const countValid = validCreationCount(count, productKind);
  const sourceReady = !!topic.trim() || creationMaterialHasContent(material) || !!styleKit.contextMd.trim();
  const specialPacks = CREATIVE_PRESETS.filter(p => p.id !== 'livre' && p.id !== 'apresentacao');
  const isSpecial = specialPacks.some(p => p.id === narrative);
  const selectedNarrative = isPresentation ? PATH_LABELS[path] : (NARRATIVE_CHOICES.find(c => c.id === narrative)?.label || PACK_LABELS[narrative] || specialPacks.find(p => p.id === narrative)?.label);
  const presets = useMemo(() => {
    const matching = visualPresets.filter(p => p && (isPresentation ? p.productKind === 'apresentacao' : p.productKind !== 'apresentacao'));
    return matching.length ? matching : (isPresentation ? PRESENTATION_VISUAL_PRESETS : VISUAL_PRESETS);
  }, [visualPresets, isPresentation]);
  const customPresets = presets.filter(p => p.isCustom);
  const identitySummary = creationIdentitySummary(brand, styleKit);
  const identityLabel = identityPath === 'moont' ? 'Padrão do Moont' : identityPath === 'saved' ? (brandRoster.find(b => b.id === brandId)?.name || (visualPreset ? presets.find(p => p.id === visualPreset)?.label : 'Preset salvo')) : 'Identidade personalizada';
  const canContinue = step === 0 ? !!name.trim() : step === 1 ? brandId !== '__new__' || !!brand.name?.trim() : step === 2 ? sourceReady : step === 4 ? countValid : true;
  useEffect(() => { alive.current = true; return () => { alive.current = false; asyncVersion.current++; }; }, []);
  useEffect(() => {
    mainRef.current?.focus({ preventScroll:true });
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [step]);
  const go = next => { if (busy || pending) return; setError(''); setNotice(''); setStep(next); setFurthest(v => Math.max(v, next)); };
  const chooseProduct = next => {
    if (next === productKind) return;
    setProductKind(next); setFormatId(next === 'apresentacao' ? 'apresentacao' : 'carrossel');
    setBrand(current => applyCreationVisualChoice(current, identityVisualBase.current));
    setVisualPreset(null); setBrandVisualOverrides({ ...identityBaseOverrides.current });
    setIdentityVisualEdited(Object.keys(identityBaseOverrides.current).length > 0);
    if (!countEdited) setCount(next === 'apresentacao' ? String(getPresentationPath(path).defaultSlideCount) : '6');
  };
  const resetIdentity = () => {
    const next = neutralCreationIdentity(defaultBrand);
    setBrandId(next.brandId); setBrand(next.brand); setStyleKit(next.styleKit);
    identityVisualBase.current = captureCreationVisualIdentity(next.brand); identityBaseOverrides.current = {};
    setVisualPreset(null); setIdentityVisualEdited(false); setBrandVisualOverrides({});
  };
  const chooseBrand = id => {
    asyncVersion.current++;
    const profile = brandRoster.find(b => b.id === id);
    const cloned = profile ? cloneCreationBrand(profile) : neutralCreationIdentity(defaultBrand);
    setBrandId(id); setBrand(cloned.brand); setStyleKit(cloned.styleKit);
    identityVisualBase.current = captureCreationVisualIdentity(cloned.brand); identityBaseOverrides.current = {};
    setVisualPreset(null); setIdentityVisualEdited(false); setBrandVisualOverrides({});
  };
  const chooseIdentityPath = next => {
    if (pending || next === identityPath) return;
    setIdentityPath(next); setIdentityAdjustmentsOpen(false); setError('');
    if (next === 'moont') resetIdentity();
    else if (next === 'saved') {
      const profile = brandRoster.find(b => b.id === activeBrandId) || brandRoster[0];
      chooseBrand(profile?.id || '__local__');
    } else setBrandId('__local__');
  };
  const chooseVisualPreset = id => {
    const preset = presets.find(p => p.id === id);
    setVisualPreset(preset?.id || null);
    setBrand(current => applyCreationVisualChoice(current, identityVisualBase.current, preset));
    setBrandVisualOverrides({ ...identityBaseOverrides.current, ...(preset ? sanitizeCustomVisualPresetBrand(preset.brand) : {}) });
    setIdentityVisualEdited(!preset && Object.keys(identityBaseOverrides.current).length > 0);
  };
  const editIdentityVisual = patch => {
    const next = { ...brand, ...patch };
    const tokens = sanitizeCustomVisualPresetBrand(patch);
    setBrand(next); setIdentityVisualEdited(true);
    setBrandVisualOverrides(current => ({ ...current, ...tokens }));
    if (!visualPreset) {
      identityVisualBase.current = captureCreationVisualIdentity(next);
      identityBaseOverrides.current = { ...identityBaseOverrides.current, ...tokens };
    }
  };
  const changeCount = value => { setCount(String(value)); setCountEdited(true); };
  const runUpload = async work => {
    if (pendingRef.current || busyRef.current) return;
    pendingRef.current = true; setPending(true); setError('');
    const version = ++asyncVersion.current;
    try { await work(() => alive.current && version === asyncVersion.current); }
    catch (e) { if (alive.current && version === asyncVersion.current) setError(e.message || 'Não foi possível importar o arquivo.'); }
    finally { pendingRef.current = false; if (alive.current) setPending(false); }
  };
  const importText = event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    void runUpload(async current => {
      const text = await readCreationTextFile(file);
      if (!current()) return;
      if ((material.content.length + text.length) > 200000) throw new Error('O material completo ultrapassa 200 mil caracteres. Divida o conteúdo; o arquivo não foi adicionado.');
      setMaterial(old => ({ ...old, content:[old.content, text].filter(Boolean).join('\n\n') }));
      setImportedNames(old => [...old, file.name]);
    });
  };
  const importLogo = event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    void runUpload(async current => {
      const stored = await storeSlideLogo(file);
      const logo = projectLogoFromStored(stored, file.name);
      if (stored.logoImage?.startsWith('blob:')) URL.revokeObjectURL(stored.logoImage);
      if (current()) setStyleKit(old => ({ ...old, logo, logoOnGenerate:true }));
    });
  };
  const importRefs = event => {
    const files = Array.from(event.target.files || []); event.target.value = ''; if (!files.length) return;
    void runUpload(async current => {
      if (files.length + styleKit.refImages.length > MAX_REF_IMAGES) throw new Error(`Escolha até ${MAX_REF_IMAGES - styleKit.refImages.length} novas referências. O projeto comporta ${MAX_REF_IMAGES} imagens de referência.`);
      for (const file of files) {
        if (!file.type.startsWith('image/')) throw new Error('Escolha apenas arquivos de imagem.');
        const ref = await storeProjectReference(file);
        if (!current()) return;
        setStyleKit(old => ({ ...old, refImages:[...old.refImages, ref] }));
      }
    });
  };
  const create = async () => {
    if (busyRef.current || pendingRef.current) return;
    if (!hasTextAI) { setError('Configure o acesso à IA para gerar este projeto. Suas escolhas continuam aqui.'); return; }
    if (!name.trim() || !sourceReady || !countValid || (brandId === '__new__' && !brand.name?.trim())) { setError('Revise o nome, o conteúdo e a quantidade antes de gerar.'); return; }
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    const quickModes = { erro_comum:'editorial', tendencia:'editorial', decodificacao:'deep', comportamento:'storytelling' };
    const resolvedTopic = topic.trim() || 'Organize o material fornecido conforme o objetivo deste projeto.';
    try {
      const result = await onCreate({
        name:name.trim(), productKind, formatId, brandId, brand:JSON.parse(JSON.stringify(brand)), styleKit:JSON.parse(JSON.stringify(styleKit)), material:{ ...material },
        generation:{ topic:resolvedTopic, count:Number(count), niche:brand.niche || '', tone:brand.defaultTone || 'claro e direto', audience:brand.defaultAudience || '', imgMode:'dalle', imgParams:{ ...params }, mode:isPresentation ? 'editorial' : isSpecial ? (quickModes[quickTemplateIdFromPreset(narrative)] || 'editorial') : narrative, creativePreset:isPresentation ? 'apresentacao' : isSpecial ? narrative : 'livre', contentObjective:isPresentation ? 'auto' : objective, presentationPath:isPresentation ? path : undefined, slideTextDensity:density, cardVisualStyle:isPresentation ? 'full' : cardStyle, visualPreset, preserveBrandIdentity:visualPreset === null || identityVisualEdited, brandVisualOverrides:{ ...brandVisualOverrides }, fetchImagesNow:hasOpenAI && wantImages },
      });
      if (result?.cancelled && alive.current) setNotice('Geração interrompida. Suas escolhas foram mantidas. Você pode tentar novamente ou abrir o rascunho disponível.');
    } catch (e) { if (alive.current) setError(e.message || 'Não foi possível gerar. Suas escolhas continuam aqui para tentar novamente.'); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  };
  const reviewRow = (label, value, target) => <div key={label}><dt>{label}</dt><dd>{value}</dd><button type="button" disabled={busy || pending} onClick={() => go(target)} aria-label={`Alterar ${label.toLowerCase()}`}>Alterar</button></div>;
  const identityEditor = <div className="vc-create-stack">
    <Field label={brandId === '__new__' ? 'Nome da nova marca' : 'Nome da marca no projeto'} hint={brandId === '__new__' ? 'Dê um nome para guardar esta marca. Se não quiser salvar, escolha Somente neste projeto.' : 'Opcional. Pode ficar vazio.'}><input className="vc-input" value={brand.name || ''} onChange={e => setBrand(b => ({ ...b, name:e.target.value }))} maxLength={80} placeholder="Ex.: Clínica Janine Araújo"/></Field>
    <div className="vc-create-grid"><Field label="Para quem é o conteúdo?" hint="Opcional."><input className="vc-input" value={brand.defaultAudience || ''} onChange={e => setBrand(b => ({ ...b, defaultAudience:e.target.value }))} placeholder="Ex.: profissionais de saúde"/></Field><Field label="Como a marca deve falar?" hint="Opcional. O tom salvo é reutilizado quando disponível."><input className="vc-input" value={brand.defaultTone || ''} onChange={e => setBrand(b => ({ ...b, defaultTone:e.target.value, brandTone:null }))} placeholder="Ex.: acolhedora, clara e profissional"/></Field></div>
    <Field label="O que o Moont precisa saber sobre a marca?" hint="Opcional. Produto, diferencial, público e cuidados com a comunicação."><textarea className="vc-input" rows={4} value={styleKit.contextMd} maxLength={CONTEXT_MD_MAX} onChange={e => setStyleKit(k => ({ ...k, contextMd:e.target.value }))}/></Field>
    <details className="vc-create-details"><summary>Cores e fontes — opcional</summary>{visualPreset && <p className="vc-create-note">Estes ajustes personalizam o preset neste projeto. Ao voltar para a identidade configurada ou trocar o tipo de projeto, as cores e fontes da identidade serão restauradas.</p>}<div className="vc-create-stack"><div className="vc-create-colors">{[{ key:'bg',label:'Cor de fundo' },{ key:'titleColor',label:'Cor dos títulos' },{ key:'textColor',label:'Cor do texto' },{ key:'accent',label:'Cor de destaque' }].map(field => <Field key={field.key} label={field.label}><input type="color" aria-label={field.label} value={/^#[0-9a-f]{6}$/i.test(brand[field.key] || '') ? brand[field.key] : '#000000'} onChange={e => editIdentityVisual(field.key === 'textColor' ? { textColor:e.target.value, subtitleColor:e.target.value } : { [field.key]:e.target.value })}/></Field>)}</div><div className="vc-create-grid"><Field label="Fonte dos títulos"><select className="vc-input" value={brand.titleFont || TITLE_FONTS[0].val} onChange={e => editIdentityVisual({ titleFont:e.target.value, customTitleFont:null })}>{!TITLE_FONTS.some(f => f.val === brand.titleFont) && brand.titleFont && <option value={brand.titleFont}>Fonte da identidade salva</option>}{TITLE_FONTS.map(f => <option key={f.val} value={f.val}>{f.name}</option>)}</select></Field><Field label="Fonte do texto"><select className="vc-input" value={brand.bodyFont || BODY_FONTS[0].val} onChange={e => editIdentityVisual({ bodyFont:e.target.value, customBodyFont:null })}>{!BODY_FONTS.some(f => f.val === brand.bodyFont) && brand.bodyFont && <option value={brand.bodyFont}>Fonte da identidade salva</option>}{BODY_FONTS.map(f => <option key={f.val} value={f.val}>{f.name}</option>)}</select></Field></div></div></details>
    <label className="vc-create-upload">Logo da marca — opcional<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Enviar logo da marca" disabled={pending} onChange={importLogo}/><span className="vc-create-note">Use PNG com fundo transparente. {styleKit.logo?.name || (brand.logoImageId || brand.logo ? 'Logo da marca salva será usada.' : '')}</span></label>
    <label className="vc-create-note"><input type="checkbox" checked={styleKit.logoOnGenerate !== false} onChange={e => setStyleKit(k => ({ ...k, logoOnGenerate:e.target.checked }))}/> Incluir a logo nos novos {item}</label>
    <label className="vc-create-upload">Referências visuais — opcional<input type="file" accept="image/*" multiple aria-label="Adicionar referências visuais" disabled={pending || styleKit.refImages.length >= MAX_REF_IMAGES} onChange={importRefs}/><span className="vc-create-note">Até {MAX_REF_IMAGES} imagens para orientar a aparência. As fotos dos {item} podem ser enviadas depois, no editor.</span></label>
    {styleKit.refImages.length > 0 && <ul className="vc-create-files">{styleKit.refImages.map(ref => <li key={ref.id || ref.imageId}><span>{ref.name}</span><button type="button" disabled={pending} aria-label={`Remover referência ${ref.name}`} onClick={() => setStyleKit(k => ({ ...k, refImages:k.refImages.filter(r => r !== ref) }))}><X size={12}/></button></li>)}</ul>}
  </div>;
  return <section className="vc-create-flow" aria-label="Criar novo projeto">
    <header className="vc-create-header"><BrandLogo height={27}/><button type="button" className="vc-btn vc-btn-ghost" disabled={busy} onClick={onCancel}><X size={15} aria-hidden/> Sair da criação</button></header>
    <nav className="vc-create-progress" aria-label="Etapas da criação">{CREATION_STEPS.map((label, i) => <button type="button" key={label} aria-label={`${i + 1}. ${label}`} aria-current={step === i ? 'step' : undefined} disabled={i > furthest || busy || pending} onClick={() => go(i)}><span className="vc-create-step-number" aria-hidden>{i + 1}</span><span className="vc-create-step-label" aria-hidden>. {label}</span></button>)}</nav>
    <main className="vc-create-main" ref={mainRef} tabIndex={-1} aria-labelledby="vc-create-title">
      <p className="vc-create-kicker">Passo {step + 1} de {CREATION_STEPS.length} · {CREATION_STEPS[step]}</p><h1 id="vc-create-title">{step === 4 ? `Quantos ${item} vamos criar?` : TITLE[step]}</h1><p className="vc-create-intro">{INTRO[step]}</p>
      <fieldset disabled={busy} className="vc-create-group vc-create-stack">
      {step === 0 && <><div className="vc-create-grid" role="radiogroup" aria-label="Tipo de projeto"><Option label="Carrossel para redes" desc="Conteúdo em sequência para feed, quadrado ou Stories." selected={!isPresentation} onClick={() => chooseProduct('carrossel')}/><Option label="Apresentação" desc="Slides para uma reunião, proposta, aula, relatório ou pitch." selected={isPresentation} onClick={() => chooseProduct('apresentacao')}/></div><Field label="Nome do projeto" hint="Um nome para encontrar este trabalho depois."><input className="vc-input" value={name} maxLength={120} onChange={e => setName(e.target.value)} placeholder="Ex.: Campanha de lançamento — outubro" autoComplete="off"/></Field></>}
      {step === 1 && <>
        <div className="vc-create-grid vc-create-identity-paths" role="radiogroup" aria-label="Como começar a identidade">
          <Option label="Usar um preset salvo" desc="Reaproveite uma marca completa ou um padrão visual que você já criou." selected={identityPath === 'saved'} disabled={pending} onClick={() => chooseIdentityPath('saved')}/>
          <Option label="Personalizar agora" desc="Escolha só o que quiser: logo, referências, cores, fontes e tom de voz." selected={identityPath === 'custom'} disabled={pending} onClick={() => chooseIdentityPath('custom')}/>
          <Option label="Seguir com o padrão do Moont" desc="Comece com uma identidade neutra. Você pode personalizar depois." selected={identityPath === 'moont'} disabled={pending} onClick={() => chooseIdentityPath('moont')}/>
        </div>
        {identityPath === 'moont' && <p className="vc-create-note">Tudo pronto para continuar. Não é necessário enviar logo, cadastrar marca ou definir um tom de voz.</p>}
        {identityPath === 'saved' && <>
          <Field label="Marca deste projeto" hint="Reutiliza o que estiver salvo na marca: identidade, logo, referências, briefing e tom de voz. Trocar a marca reinicia os ajustes desta página."><select className="vc-input" value={brandId} disabled={pending} onChange={e => chooseBrand(e.target.value)}><option value="__local__">Sem marca salva</option>{brandRoster.map(b => <option key={b.id} value={b.id}>{b.name || 'Marca sem nome'}</option>)}</select></Field>
          <Field label="Padrão visual salvo" hint="Opcional. Reutiliza cores, fontes e composição dos cards. Logos, referências e tom de voz vêm da marca escolhida acima. Escolher Manter restaura as cores e fontes da identidade, sem os ajustes feitos sobre o preset."><select className="vc-input" value={customPresets.some(p => p.id === visualPreset) ? visualPreset : ''} onChange={e => chooseVisualPreset(e.target.value || null)}><option value="">Manter a identidade escolhida</option>{customPresets.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
          {!customPresets.length && <p className="vc-create-note">Você ainda não tem padrões visuais salvos para este formato. Pode usar uma marca ou explorar os estilos do Moont na etapa Visual.</p>}
          <div className="vc-create-identity-summary"><strong>{identityLabel}</strong><span>{identitySummary.logo} · {identitySummary.references} referências visuais{identitySummary.hasBrief ? ' · briefing incluído' : ''}</span><span>Tom de voz: {identitySummary.tone || 'sem orientação adicional'}.</span>{visualPreset && <span>Padrão visual: {presets.find(p => p.id === visualPreset)?.label}.</span>}<small>As alterações ficam apenas neste projeto. O preset salvo continua disponível como antes.</small></div>
          <details className="vc-create-details" open={identityAdjustmentsOpen} onToggle={e => setIdentityAdjustmentsOpen(e.currentTarget.open)}><summary>Ajustar para este projeto</summary>{identityEditor}</details>
        </>}
        {identityPath === 'custom' && <>
          <Field label="Marca deste projeto" hint="Não precisa cadastrar uma marca para continuar."><select className="vc-input" value={brandId === '__new__' ? '__new__' : '__local__'} disabled={pending} onChange={e => setBrandId(e.target.value)}><option value="__local__">Somente neste projeto</option><option value="__new__">Criar uma nova marca — opcional</option></select></Field>
          {identityEditor}
        </>}
      </>}
      {step === 2 && <>
        <Field label="Sobre o que vamos criar?" hint="Diga o tema, a mensagem principal e o resultado que espera."><textarea className="vc-input" rows={4} value={topic} onChange={e => setTopic(e.target.value)} placeholder={isPresentation ? 'Ex.: um pitch para explicar nosso negócio a investidores.' : 'Ex.: apresentar nossa campanha de Halloween e convidar o público a conhecer a oferta.'}/></Field>
        <Field label="Texto de apoio" hint="Cole o briefing, a pesquisa, as notas ou o texto que já tem. Opcional."><textarea className="vc-input" rows={7} value={material.content} onChange={e => setMaterial(m => ({ ...m, content:e.target.value }))}/></Field>
        <label className="vc-create-upload">Adicionar arquivo de texto (.txt ou .md)<input type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" aria-label="Importar texto de apoio" disabled={pending} onChange={importText}/><span className="vc-create-note">O texto é acrescentado ao apoio. Para PDF ou Word, cole o conteúdo no campo acima.</span>{importedNames.length > 0 && <span>{importedNames.join(' · ')}</span>}</label>
        <Field label="Links e fontes" hint="Cole links e referências que ajudam a sustentar o conteúdo."><textarea className="vc-input" rows={3} value={material.sources} onChange={e => setMaterial(m => ({ ...m, sources:e.target.value }))} placeholder="https://…"/></Field>
        <Field label="Instruções adicionais" hint="Idioma, palavras a evitar, informações obrigatórias ou o convite final."><textarea className="vc-input" rows={3} value={material.context} onChange={e => setMaterial(m => ({ ...m, context:e.target.value }))}/></Field>
      </>}
      {step === 3 && <>{isPresentation ? <div className="vc-create-grid" role="radiogroup" aria-label="Objetivo da apresentação">{PRESENTATION_PATHS.map(route => <Option key={route.id} label={PATH_LABELS[route.id] || route.label} desc={route.description} example={PATH_EXAMPLES[route.id]} selected={path === route.id} onClick={() => { setPath(route.id); if (!countEdited) setCount(String(route.defaultSlideCount)); }}/>)}</div> : <>
        <div className="vc-create-grid" role="radiogroup" aria-label="Como contar sua ideia">{NARRATIVE_CHOICES.map(choice => <Option key={choice.id} {...choice} selected={narrative === choice.id} onClick={() => setNarrative(choice.id)}/>)}</div>
        <details className="vc-create-details" open={isSpecial || undefined}><summary>Outras estruturas prontas</summary><p className="vc-create-note">Escolher uma destas opções substitui a narrativa selecionada acima.</p><div className="vc-create-grid" role="radiogroup" aria-label="Estruturas prontas">{specialPacks.map(p => <Option key={p.id} label={PACK_LABELS[p.id] || p.label} desc={PACK_DESCS[p.id] || p.desc} selected={narrative === p.id} onClick={() => setNarrative(p.id)}/>)}</div></details>
        <details className="vc-create-details"><summary>Qual ação você quer incentivar? — opcional</summary><Field label="Objetivo do conteúdo"><select className="vc-input" value={objective} onChange={e => setObjective(e.target.value)}>{CONTENT_OBJECTIVES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></Field><p className="vc-create-note">{CONTENT_OBJECTIVES.find(o => o.id === objective)?.desc}</p></details>
      </>}</>}
      {step === 4 && <>
        <div><label className="vc-create-field" htmlFor="creation-count">Quantidade de {item}</label><div className="vc-create-count" style={{ marginTop:12 }}><button type="button" aria-label={`Diminuir quantidade de ${item}`} disabled={!countValid || Number(count) <= minCount} onClick={() => changeCount(Number(count) - 1)}>−</button><input id="creation-count" type="number" inputMode="numeric" min={minCount} max={24} step={1} value={count} onChange={e => changeCount(e.target.value)} aria-invalid={!countValid}/><button type="button" aria-label={`Aumentar quantidade de ${item}`} disabled={!countValid || Number(count) >= 24} onClick={() => changeCount(Number(count) + 1)}>+</button></div><div className="vc-create-shortcuts">{(isPresentation ? [8,10,12,16] : [5,6,8,10]).map(n => <button type="button" key={n} aria-pressed={Number(count) === n} onClick={() => changeCount(n)}>{n}</button>)}</div><p className="vc-create-note">Escolha de {minCount} a 24 {item}. A quantidade inclui a abertura e o encerramento.</p>{!countValid && <p role="alert" className="vc-create-note">Digite um número inteiro de {minCount} a 24.</p>}</div>
        <fieldset className="vc-create-group"><legend>Formato do projeto</legend>{isPresentation ? <p className="vc-create-note">Apresentação horizontal 16:9 — pronta para tela e PDF.</p> : <div className="vc-create-grid" role="radiogroup" aria-label="Formato do projeto">{['carrossel','quadrado','stories'].map(id => <Option key={id} label={FORMAT_LABELS[id]} desc={id === 'carrossel' ? 'Vertical · 1080 × 1350' : id === 'quadrado' ? 'Quadrado · 1080 × 1080' : 'Vertical · 1080 × 1920'} selected={formatId === id} onClick={() => setFormatId(id)}/>)}</div>}</fieldset>
        <fieldset className="vc-create-group"><legend>Quanto texto por {isPresentation ? 'slide' : 'card'}?</legend><div className="vc-create-grid" role="radiogroup" aria-label="Quantidade de texto">{CREATION_DENSITIES.map(d => <Option key={d.id} {...d} selected={density === d.id} onClick={() => setDensity(d.id)}/>)}</div></fieldset>
      </>}
      {step === 5 && <>
        <button type="button" className="vc-create-option" aria-pressed={visualPreset === null} onClick={() => chooseVisualPreset(null)}><strong>Manter a identidade configurada</strong><span>Volta às cores e fontes definidas na etapa Marca. Descarta os ajustes visuais feitos sobre um preset.</span></button>
        <details className="vc-create-details"><summary>Explorar estilos visuais{visualPreset ? ` · ${presets.find(p => p.id === visualPreset)?.label || 'Estilo selecionado'}` : ''}</summary><VisualStylePicker value={visualPreset} onChange={chooseVisualPreset} presets={presets} title={isPresentation ? 'Estilos para apresentação' : 'Estilos para redes'} aspectRatio={isPresentation ? '16 / 9' : '4 / 5'}/></details>
        <fieldset className="vc-create-group"><legend>Como quer começar com as imagens?</legend><div className="vc-create-grid" role="radiogroup" aria-label="Imagens do projeto"><Option label="Criar o texto primeiro" desc="Organiza o conteúdo agora. Você pode enviar fotos ou gerar imagens no editor." selected={!wantImages} onClick={() => setWantImages(false)}/><Option label="Gerar texto e imagens" desc={hasOpenAI ? 'Cria imagens junto com o conteúdo. Essa opção leva mais tempo.' : 'Configure o acesso à geração de imagens para usar esta opção.'} selected={wantImages && hasOpenAI} disabled={!hasOpenAI} onClick={() => setWantImages(true)}/></div>{!hasOpenAI && onOpenKeys && <button type="button" className="vc-btn vc-btn-ghost" onClick={onOpenKeys}>Configurar geração de imagens</button>}</fieldset>
        {wantImages && hasOpenAI && <details className="vc-create-details"><summary>Ajustar a direção das imagens — opcional</summary><ImgParamsPanel value={params} onChange={(key, value) => setParams(p => ({ ...p, [key]:value }))}/></details>}
        <Field label="Direção visual adicional" hint="Ex.: fotografia natural, fundo claro, poucas cores e títulos elegantes."><textarea className="vc-input" rows={3} maxLength={STYLE_PROMPT_MAX} value={styleKit.stylePrompt} onChange={e => setStyleKit(k => ({ ...k, stylePrompt:e.target.value }))}/></Field>
        {!isPresentation && <details className="vc-create-details"><summary>Organização da foto e do texto — opcional</summary><div className="vc-create-grid" role="radiogroup" aria-label="Composição dos cards">{[{ id:'full', label:'Imagem no fundo', desc:'Texto sobre a imagem.' },{ id:'inset_h_top', label:'Foto no topo', desc:'Texto abaixo da foto.' },{ id:'inset_h_middle', label:'Foto no meio', desc:'Título acima e apoio abaixo.' },{ id:'inset_h_bottom', label:'Foto embaixo', desc:'Texto acima da foto.' }].map(v => <Option key={v.id} {...v} selected={cardStyle === v.id} onClick={() => setCardStyle(v.id)}/>)}</div></details>}
        <div className="vc-create-identity-summary"><strong>Logo e referências — opcionais</strong><span>{identitySummary.logo} · {identitySummary.references} referências visuais.</span><button type="button" className="vc-btn vc-btn-ghost" onClick={() => { if (identityPath === 'moont') setIdentityPath('custom'); setIdentityAdjustmentsOpen(true); go(1); }}>Ajustar logo e referências</button></div>
      </>}
      {step === 6 && <>
        <dl className="vc-create-review">{reviewRow('Projeto', name, 0)}{reviewRow('Identidade', identityLabel, 1)}{reviewRow('Logo e referências', `${identitySummary.logo} · ${identitySummary.references} referências`, 1)}{reviewRow('Tom de voz', identitySummary.tone || 'Sem orientação adicional', 1)}{reviewRow('Tema', topic || 'Usar o material e o briefing fornecidos', 2)}{reviewRow('Material', `${material.content.length.toLocaleString('pt-BR')} caracteres de apoio${material.sources.trim() ? ' · fontes incluídas' : ''}${material.context.trim() ? ' · instruções incluídas' : ''}`, 2)}{reviewRow('Narrativa', selectedNarrative, 3)}{reviewRow('Quantidade', `${count} ${quantityUnit} · ${FORMAT_LABELS[formatId]}`, 4)}{reviewRow('Texto', CREATION_DENSITIES.find(d => d.id === density)?.label, 4)}{reviewRow('Visual', visualPreset ? `${presets.find(p => p.id === visualPreset)?.label || 'Estilo selecionado'}${identityVisualEdited ? ' · ajustado neste projeto' : ''}` : 'Identidade configurada', 5)}{reviewRow('Imagens', wantImages && hasOpenAI ? 'Gerar texto e imagens' : 'Criar o texto primeiro', 5)}</dl>
        {!hasTextAI && <div className="vc-create-details"><p>Configure o acesso à IA para gerar. Suas escolhas ficam mantidas nesta tela.</p>{onOpenKeys && <button type="button" className="vc-btn vc-btn-ghost" onClick={onOpenKeys}>Configurar acesso à IA</button>}</div>}
        <p className="vc-create-note">O Moont organiza a sequência e revisa o texto. Depois, você pode editar cada detalhe no projeto.</p>
        {!busy && hasDraft && onOpenDraft && <button type="button" className="vc-btn vc-btn-ghost" onClick={onOpenDraft}>Abrir rascunho no editor</button>}
      </>}
      </fieldset>
      {pending && <p role="status" className="vc-create-note" style={{ marginTop:18 }}>Importando arquivo…</p>}
      {busy && <div role="status" aria-live="polite" className="vc-create-stack" style={{ marginTop:24 }}><strong>{progress?.label || 'Preparando seu projeto…'}</strong><div className="vc-create-progressbar" aria-hidden><span/></div><p className="vc-create-note">As ferramentas de edição vão aparecer quando a geração terminar.</p></div>}
      {notice && <p role="status" className="vc-create-note" style={{ marginTop:24 }}>{notice}</p>}
      {error && <div role="alert" className="vc-create-error" style={{ marginTop:24 }}>{error}</div>}
    </main>
    <footer className="vc-create-footer"><button type="button" className="vc-btn vc-btn-ghost" disabled={pending || (busy && !onCancelGeneration)} onClick={busy ? onCancelGeneration : step > 0 ? () => go(step - 1) : onCancel}><ArrowLeft size={15} aria-hidden/>{busy ? 'Cancelar geração' : step > 0 ? 'Voltar' : 'Cancelar'}</button><span className="vc-create-note">{step + 1} de {CREATION_STEPS.length}{step >= 4 && countValid ? ` · ${count} ${quantityUnit}` : ''}</span>{step < 6 ? <button type="button" className="vc-create-primary" disabled={!canContinue || pending || busy} onClick={() => go(step + 1)}>Continuar <ArrowRight size={14} aria-hidden/></button> : <button type="button" className="vc-create-primary" disabled={busy || pending || !countValid || !sourceReady || !hasTextAI} onClick={create}>{busy ? <Loader2 size={15} aria-hidden/> : <Sparkles size={15} aria-hidden/>} {busy ? 'Gerando…' : `Criar e gerar ${count} ${quantityUnit}`}</button>}</footer>
  </section>;
}
