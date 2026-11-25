import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, BarChart, BookOpen, Briefcase, Calendar, Camera, Check, Clock, DollarSign, Globe, Heart, Leaf,
  Lightbulb, MapPin, MessageCircle, Music, Rocket, Shield, Sparkles, Star, Target, TrendingDown, TrendingUp, User, Users, Zap,
} from 'lucide-react';
import LegacyPresentationBlocks from './LegacyPresentationBlocks.jsx';
import { normalizePresentationBlocks } from '../utils/presentation-quality.js';
import { evidenceDetailInk, familyEvidenceStyle, familyFont, normalizeFamilyKey } from '../utils/presentation-families.js';
import { readTypedText } from '../utils/inline-edit-text.js';
import { accentInkOnSurface } from '../utils/brand-visuals.js';
import { wcagContrast } from '../utils/wcag.js';
import { PRESENTATION_ICON_NAMES } from '../utils/presentation-icons.js';

/** Bloco de ícones (fase 3): a lista fechada de 26 nomes, desenhados como SVG inline. */
const ICON_COMPONENTS = Object.freeze({
  check: Check, 'arrow-right': ArrowRight, 'trending-up': TrendingUp, 'trending-down': TrendingDown, users: Users, user: User,
  calendar: Calendar, clock: Clock, 'map-pin': MapPin, star: Star, heart: Heart, lightbulb: Lightbulb, target: Target,
  shield: Shield, zap: Zap, globe: Globe, music: Music, camera: Camera, 'book-open': BookOpen, briefcase: Briefcase,
  'bar-chart': BarChart, 'dollar-sign': DollarSign, leaf: Leaf, sparkles: Sparkles, 'message-circle': MessageCircle, rocket: Rocket,
});

function EditableCell({ as: Tag = 'span', value, label, onCommit, style = {}, attrs = {} }) {
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  const commit = () => {
    const text = readTypedText(ref.current).trim();
    if (text !== value && onCommit?.(text) === false) {
      setInvalid(true);
      if (ref.current) ref.current.textContent = value;
    } else setInvalid(false);
    setEditing(false);
  };
  return <Tag
    {...attrs}
    ref={ref}
    data-vc-evidence-cell="true"
    data-vc-inline-editable={onCommit ? 'true' : undefined}
    contentEditable={editing}
    suppressContentEditableWarning
    tabIndex={onCommit ? 0 : undefined}
    aria-label={onCommit ? `Editar ${label}` : undefined}
    aria-invalid={invalid || undefined}
    title={invalid ? 'O texto excedeu o limite do quadro. Divida a informação em outro slide e tente novamente.' : onCommit ? 'Duplo clique ou Enter para editar; clique fora para salvar' : undefined}
    onDoubleClick={onCommit ? (event) => { event.stopPropagation(); setEditing(true); } : undefined}
    onPointerDown={editing ? (event) => event.stopPropagation() : undefined}
    onBlur={editing ? commit : undefined}
    onPaste={editing ? (event) => {
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain');
      const selection = window.getSelection?.();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0); range.deleteContents();
      const node = document.createTextNode(text); range.insertNode(node); range.setStartAfter(node); range.collapse(true);
      selection.removeAllRanges(); selection.addRange(range);
    } : undefined}
    onKeyDown={onCommit ? (event) => {
      event.stopPropagation();
      if (!editing && event.key === 'Enter') { event.preventDefault(); setEditing(true); }
      else if (editing && event.key === 'Escape') {
        event.preventDefault(); if (ref.current) ref.current.textContent = value; setEditing(false);
      } else if (editing && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); commit(); }
    } : undefined}
    style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: 'normal', ...style,
      ...(editing ? { outline: '2px solid var(--accent)', outlineOffset: 2, cursor: 'text' } : invalid ? { outline: '2px solid #d14343', outlineOffset: 2 } : {}) }}
  >{value}</Tag>;
}

// Largura real do texto na fonte do quadro (canvas). Sem canvas (SSR/testes),
// estimativa conservadora de fonte monoespaçada.
const widthCache = new Map();
export function measureMetricText(text, fontFamily, weight = 600) {
  const value = String(text || '');
  const key = `${weight}|${fontFamily}|${value}`;
  if (widthCache.has(key)) return widthCache.get(key);
  let perPx = [...value].length * 0.62;
  try {
    const ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    if (ctx) {
      // Medida em tamanho pequeno: fontes com eixo óptico (Fraunces, no
      // Editorial) ficam mais estreitas em corpo grande; medir a 100 px
      // subestimava a largura real a ~50 px e "Terça a domingo" era cortado.
      ctx.font = `${weight} 32px ${fontFamily || 'sans-serif'}`;
      const measured = ctx.measureText(value).width / 32;
      if (measured > 0) perPx = measured;
    }
  } catch { /* estimativa acima */ }
  widthCache.set(key, perPx);
  return perPx;
}

/**
 * Tamanho do valor da métrica (MF-13): o maior que cabe na coluna, até o teto
 * do layout. Abaixo do mínimo legível, o valor quebra em linhas em vez de ser
 * cortado na borda (o "36 horas" e o horário no quadro de 4 valores).
 */
export function metricValueFit({ value, columnPx, unit, count, fontFamily, weight }) {
  const max = (count > 3 ? 72 : 96) * unit;
  const min = 30 * unit;
  const perPx = measureMetricText(value, fontFamily, weight);
  const fits = perPx > 0 ? (columnPx * 0.92) / perPx : max;
  if (fits >= min) return { fontSize: Math.min(max, fits), wrap: false };
  return { fontSize: min, wrap: true };
}

/**
 * Mesmo tamanho para todos os valores da linha, como num painel: o menor que
 * cabe, com piso legível. Um valor longo demais para o piso ("Ter-Dom,
 * 7h–13h") quebra em linhas no mesmo tamanho dos outros.
 *
 * QA 24/11: a quebra é só entre palavras. No piso, o valor era partido em
 * qualquer letra ("US$ 1.299,9 / 0", "41.20 / 0"); agora a linha desce de
 * tamanho até a maior palavra caber na coluna: número fica inteiro e
 * "US$ 1.299,90" só quebra depois da moeda.
 */
export function metricRowFit({ values, columnPx, unit, fontFamily, weight }) {
  const count = values.length;
  const max = (count > 3 ? 72 : 96) * unit;
  const floor = 44 * unit;
  const limit = columnPx * 0.92;
  const fits = values.map(value => metricValueFit({ value, columnPx, unit, count, fontFamily, weight }));
  let size = Math.min(max, Math.max(floor, Math.min(...fits.map(fit => (fit.wrap ? 0 : fit.fontSize)))));
  const widths = values.map(value => ({
    perPx: measureMetricText(value, fontFamily, weight),
    widestWord: Math.max(0, ...String(value || '').trim().split(/\s+/).filter(Boolean).map(word => measureMetricText(word, fontFamily, weight))),
  }));
  for (const { perPx, widestWord } of widths) {
    if (perPx * size > limit && widestWord > 0) size = Math.min(size, limit / widestWord);
  }
  // Folga de arredondamento: o valor que desceu até caber fica numa linha.
  return widths.map(({ perPx }) => ({ fontSize: size, wrap: perPx * size > limit * 1.0005 }));
}

/**
 * Destaque da marca própria nos blocos (numerais, pílula, fios). A cor ia crua:
 * amarelo claro sumia no Executivo, azul-escuro no Técnico (GA-09). Mede contra
 * o fundo onde o marcador aparece (painel da família ou fundo do slide) e
 * ajusta o mesmo tom até 3:1, como o destaque de texto do card. Destaque que já
 * lê, e família sem marca própria, saem como estavam. O texto da pílula é
 * preto ou branco, o que ler melhor sobre ela.
 */
export function evidenceStyleForBrand(familyStyle, brandAccent, background) {
  let st = familyStyle;
  if (brandAccent) {
    const own = String(familyStyle.accent || '').toLowerCase();
    const accent = accentInkOnSurface(brandAccent, familyStyle.panel ? familyStyle.panelColor : background, 3);
    st = Object.fromEntries(Object.entries(familyStyle)
      .map(([name, value]) => [name, typeof value === 'string' && value.toLowerCase() === own ? accent : value]));
  }
  const pillInk = wcagContrast('#ffffff', st.accent) >= wcagContrast('#000000', st.accent) ? '#ffffff' : '#000000';
  return { ...st, pillInk };
}

/** A small, allowlisted set of editable primitives shared by preview and export.
 * React escapes every value; generated content never controls markup or CSS. */
/** Linhas de um texto quebrado por palavras numa coluna (largura medida por px de fonte). */
function wrappedLines(text, widthPx, sizePx, fontFamily, weight) {
  const space = measureMetricText(' ', fontFamily, weight);
  let lines = 1; let used = 0;
  for (const word of String(text || '').split(/\s+/).filter(Boolean)) {
    const w = measureMetricText(word, fontFamily, weight) * sizePx;
    if (used && used + space * sizePx + w > widthPx) { lines += 1; used = w; } else used += (used ? space * sizePx : 0) + w;
  }
  return lines;
}

/**
 * Tamanho da citação (fase 3): o maior, em passos de 4 px, cuja frase, o sinal
 * de citação e a autoria cabem na zona. Nunca abaixo de 40 px.
 */
export function quoteTextFit({ text, author, widthPx, heightPx, unit, fontFamily, weight }) {
  const markPx = 96 * unit;
  for (let size = 72; size >= 40; size -= 4) {
    const px = size * unit;
    const lines = wrappedLines(text, widthPx, px, fontFamily, weight);
    const total = markPx * 0.62 + lines * px * 1.18 + (author ? 26 * unit * 1.4 + 22 * unit : 0);
    if (total <= heightPx) return { fontSize: px, lines };
  }
  return { fontSize: 40 * unit, lines: wrappedLines(text, widthPx, 40 * unit, fontFamily, weight) };
}

/**
 * Número grande (fase 3): enche a largura da zona numa linha, entre 96 e
 * 400 px (revisão livre-f3: a 260 px o número ficava miúdo na coluna larga).
 */
export function bigNumberFit({ value, widthPx, heightPx, unit, fontFamily, weight }) {
  const perPx = measureMetricText(value, fontFamily, weight);
  const byWidth = perPx > 0 ? (widthPx * 0.95) / perPx : 400 * unit;
  return Math.max(Math.min(96 * unit, byWidth), Math.min(400 * unit, heightPx * 0.5, byWidth));
}

/** Mistura duas cores hex (t = 1 é `a`); cor sólida, que o html2canvas desenha igual à tela. */
function mixSolid(a, b, t) {
  const rgb = hex => [1, 3, 5].map(i => parseInt(String(hex).slice(i, i + 2), 16));
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return b;
  const A = rgb(a); const B = rgb(b);
  return `#${A.map((c, i) => Math.round(c * t + B[i] * (1 - t)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/**
 * Selo dos ícones (revisão da folha livre-f3): o ícone de 60 px ficava pequeno
 * no slide. Círculo de até 160 px na cor de destaque suave, que encolhe com a
 * coluna (no máximo 60% dela), e o desenho a 54% do selo.
 */
export function iconBadgeSize({ zoneWidthPx, columns, gapPx, unit, panelPadPx = 0 }) {
  const column = (zoneWidthPx - (columns - 1) * gapPx) / columns - panelPadPx;
  const badge = Math.round(Math.min(160 * unit, column * 0.6));
  return { badge, glyph: Math.round(badge * 0.54) };
}

export default function PresentationBlocks({ blocks: raw, rect, frame, ink, strongInk, background, fontFamily, family = 'executive', accent, numericTypography, onChange, forExport = false, artDirectionVersion = 2, paletteOverrides = {}, anchor }) {
  // Mede de novo quando as fontes terminam de carregar (a exportação espera
  // por elas; a primeira medida pode usar a fonte de reserva).
  const [, setFontsReady] = useState(0);
  const metricFont = (() => {
    const k = normalizeFamilyKey(family);
    return { family: numericTypography?.fontFamily || familyFont(k, 'numeric').css || fontFamily, weight: numericTypography?.weight || familyFont(k, 'numeric').weight || 600 };
  })();
  useEffect(() => {
    let alive = true;
    const remeasure = () => { if (alive) { widthCache.clear(); setFontsReady(n => n + 1); } };
    // Lote B (21/11): a fonte serifada do Editorial só começa a carregar
    // quando é usada; fonts.ready já estava resolvido e a medida ficava com a
    // fonte de reserva, mais estreita ("Terça a domingo" cortado). Carrega a
    // fonte do valor explicitamente e mede de novo a cada carga concluída.
    document.fonts?.load?.(`${metricFont.weight} 100px ${metricFont.family}`).then(remeasure, () => {});
    document.fonts?.ready?.then(remeasure);
    document.fonts?.addEventListener?.('loadingdone', remeasure);
    return () => { alive = false; document.fonts?.removeEventListener?.('loadingdone', remeasure); };
  }, [metricFont.family, metricFont.weight]);
  if (artDirectionVersion !== 2) return <LegacyPresentationBlocks blocks={raw} rect={rect} frame={frame} ink={ink} background={background} fontFamily={fontFamily} family={family} accent={accent} numericTypography={numericTypography} onChange={onChange} forExport={forExport} />;
  const blocks = normalizePresentationBlocks(raw);
  if (!blocks.length || !rect) return null;
  const block = blocks[0];
  const unit = frame.w / (frame.h >= frame.w ? 1080 : 1920);
  const fontSize = 26 * unit;
  // Tratamento de evidência da família (fios, zebra, painel, numeração).
  const key = normalizeFamilyKey(family);
  // Reteste 22/11: números e fios dos blocos seguem o destaque da marca própria.
  const st = evidenceStyleForBrand(familyEvidenceStyle(key, paletteOverrides), paletteOverrides?.accent, background);
  const panel = st.panel;
  const ruleColor = st.metricRuleColor || accent || ink;
  const headerFont = familyFont(key, st.headerRole === 'display' ? 'display' : st.headerRole === 'label' ? 'label' : 'text');
  const numberFont = numericTypography?.fontFamily || familyFont(key, 'numeric').css || fontFamily;
  const panelInk = panel ? st.ink : ink;
  // Spec 1.1 (entrega 4): descrição das colunas com piso de 25 px e 4,5:1.
  const detailSurface = panel ? st.panelColor : background;
  const metricDetail = evidenceDetailInk(panelInk, detailSurface, st.detailOpacity);
  const stepBody = evidenceDetailInk(panelInk, detailSurface, st.stepBodyOpacity);
  const roman = ['I', 'II', 'III', 'IV', 'V'];
  // Valor da métrica cabe numa linha da coluna (mesmo cálculo da galeria).
  const metricColumnPx = (count) => {
    const cols = Math.min(count, frame.h > frame.w ? 2 : 4);
    return ((rect.w / 100) * frame.w - (cols - 1) * 28 * unit) / cols - (panel ? 52 * unit : 0);
  };
  const marker = (index) => st.stepMarker === 'roman' ? roman[index] : st.stepMarker === 'code' ? `0${index + 1}/` : String(index + 1).padStart(2, '0');
  const stepColumns = frame.h === frame.w ? Math.min(block.items?.length || 1, 2)
    : frame.h > frame.w ? ((block.items?.length || 0) > 3 ? 2 : 1) : Math.min(block.items?.length || 1, 4);
  const editable = !forExport && !!onChange;
  const commitBlock = (path, value) => {
    const next = JSON.parse(JSON.stringify(blocks));
    let parent = next[0];
    path.slice(0, -1).forEach((key) => { parent = parent[key]; });
    parent[path[path.length - 1]] = value;
    if (!normalizePresentationBlocks(next).length) return false;
    onChange(next);
    return true;
  };
  // Blocos da fase 3: tinta forte (título do slide no modo livre) e destaque
  // medidos contra a superfície onde o bloco fica, como os outros blocos.
  const strong = evidenceDetailInk(strongInk || panelInk, detailSurface, 1).color;
  const accentInk = accentInkOnSurface(st.accent, detailSurface, 3);
  const displayFont = numericTypography?.fontFamily || familyFont(key, 'display').css || fontFamily;
  const displayWeight = numericTypography?.weight || familyFont(key, 'display').weight || 600;
  const zonePx = { w: (rect.w / 100) * frame.w, h: (rect.h / 100) * frame.h };
  // Âncora da citação e do número grande (modo livre): começo ou fim da zona.
  const justify = anchor === 'start' ? 'flex-start' : anchor === 'end' ? 'flex-end' : 'center';
  const iconColumns = frame.h > frame.w ? Math.min(block.items?.length || 1, 2) : (block.items?.length || 1);
  const iconGap = 48 * unit;
  const iconSize = iconBadgeSize({ zoneWidthPx: zonePx.w, columns: iconColumns, gapPx: iconGap, unit, panelPadPx: panel ? 52 * unit : 0 });
  const badgeColor = mixSolid(st.accent, detailSurface, 0.14);
  const badgeInk = accentInkOnSurface(st.accent, badgeColor, 3);
  const panelBox = panel ? { backgroundColor: st.panelColor, borderRadius: st.radius * unit, padding: `${36 * unit}px ${40 * unit}px`, boxSizing: 'border-box' } : {};
  const inner = { w: zonePx.w - (panel ? 80 * unit : 0), h: zonePx.h - (panel ? 72 * unit : 0) };
  const cell = (value, path, label, style, attrs) => <EditableCell
    key={path.join('.')}
    value={value}
    label={label}
    style={style}
    attrs={attrs}
    onCommit={editable ? (text) => commitBlock(path, text) : undefined}
  />;
  return <div
    data-vc-quality-zone="evidence"
    data-vc-presentation-block={block.type}
    data-vc-evidence-surface="true"
    data-vc-evidence-design={family}
    style={{ position: 'absolute', left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%`,
      boxSizing: 'border-box', overflow: 'hidden', zIndex: 5, color: ink, backgroundColor: panel ? 'transparent' : background,
      fontFamily, fontSize, lineHeight: 1.4, textAlign: 'left', textShadow: 'none' }}
  >
    {block.type === 'comparison' ? <table aria-label="Comparação" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 'inherit', color: panelInk,
      ...(panel ? { backgroundColor: st.panelColor, borderRadius: st.radius * unit, overflow: 'hidden', boxShadow: st.offsetShadow ? `${10 * unit}px ${10 * unit}px 0 ${st.offsetShadow}` : 'none' } : {}) }}>
      <thead><tr>{block.headers.map((value, col) => <th key={col} scope="col" style={{ textAlign: 'left', verticalAlign: 'bottom', padding: `${14 * unit}px ${18 * unit}px`, borderBottom: `${Math.max(1, st.headerRule * unit)}px solid ${panelInk}`,
        fontFamily: headerFont.css, fontWeight: st.headerRole === 'display' ? headerFont.weight : 600, fontSynthesisWeight: 'none',
        fontSize: (st.headerRole === 'label' ? 19 : st.headerRole === 'display' ? 30 : 23) * unit,
        textTransform: st.headerCase === 'upper' ? 'uppercase' : 'none', letterSpacing: `${st.headerTracking}em` }}>
        {cell(value, ['headers', col], `cabeçalho ${col + 1}`)}
      </th>)}</tr></thead>
      <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} style={{ backgroundColor: rowIndex % 2 === 0 ? st.zebra : 'transparent' }}>{row.map((value, col) => <td key={col} style={{ verticalAlign: 'top', padding: `${14 * unit}px ${18 * unit}px`, borderBottom: `${Math.max(1, unit)}px solid ${panel ? 'rgba(0,0,0,0.12)' : 'rgba(127,127,127,0.3)'}`, fontWeight: col === 0 ? 600 : 400,
        ...(col === 0 && key === 'technical' ? { fontFamily: numberFont, fontSize: 23 * unit } : {}) }}>
        {cell(value, ['rows', rowIndex, col], `linha ${rowIndex + 1}, coluna ${col + 1}`)}
      </td>)}</tr>)}</tbody>
    </table> : block.type === 'metrics' ? <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(block.items.length, frame.h > frame.w ? 2 : 4)}, minmax(0, 1fr))`, gap: 28 * unit }}>
      {block.items.map((item, index) => <div key={index} style={{ minWidth: 0, padding: panel ? `${26 * unit}px` : `${22 * unit}px 0 0`, borderTop: st.metricRule ? `${st.metricRule * unit}px solid ${ruleColor}` : 'none', borderRadius: st.radius * unit, backgroundColor: panel ? st.panelColor : 'transparent', color: panelInk }}>
        {(() => {
          const weight = numericTypography?.weight || familyFont(key, 'numeric').weight || 600;
          const fit = metricRowFit({ values: block.items.map(entry => entry.value), columnPx: metricColumnPx(block.items.length), unit, fontFamily: numberFont, weight })[index];
          return cell(item.value, ['items', index, 'value'], `valor ${index + 1}`, { display: 'block', whiteSpace: fit.wrap ? 'normal' : 'nowrap', overflowWrap: 'normal', fontFamily: numberFont, fontSize: fit.fontSize, letterSpacing: '-0.02em', lineHeight: fit.wrap ? 1.1 : 1.18, fontWeight: weight, fontSynthesisWeight: 'none',
            // QA livre-f2: sobre a superfície o número saía no cinza do apoio.
            // No modo livre ele usa a tinta do título, medida contra o quadro.
            ...(strongInk ? { color: strong } : {}) });
        })()}
        {cell(item.label, ['items', index, 'label'], `indicador ${index + 1}`, { display: 'block', fontSize: 26 * unit, marginTop: 18 * unit, fontWeight: 600 })}
        {item.detail && cell(item.detail, ['items', index, 'detail'], `condição ${index + 1}`, { display: 'block', fontSize: st.detailPx * unit, marginTop: 8 * unit, color: metricDetail.color, opacity: metricDetail.opacity })}
      </div>)}
    </div> : block.type === 'quote' ? (() => {
      const fit = quoteTextFit({ text: block.text, author: block.author, widthPx: inner.w - 8 * unit, heightPx: inner.h, unit, fontFamily: displayFont, weight: displayWeight });
      return <figure style={{ margin: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: justify, color: strong, ...panelBox }}>
        <span aria-hidden style={{ display: 'block', fontFamily: displayFont, fontWeight: displayWeight, fontSize: 96 * unit, lineHeight: 0.62, height: 96 * unit * 0.62, color: accentInk }}>“</span>
        <blockquote style={{ margin: 0 }}>
          {cell(block.text, ['text'], 'citação', { display: 'block', fontFamily: displayFont, fontWeight: displayWeight, fontSynthesisWeight: 'none', fontSize: fit.fontSize, lineHeight: 1.18, letterSpacing: '-0.01em', color: strong }, { 'data-vc-quote-text': 'true' })}
        </blockquote>
        {block.author && <figcaption style={{ display: 'flex', gap: 10 * unit, marginTop: 22 * unit, fontSize: 26 * unit, fontWeight: 600, color: metricDetail.color }}>
          <span aria-hidden>—</span>
          {cell(block.author, ['author'], 'autoria', { display: 'block', fontSize: 26 * unit, fontWeight: 600, color: metricDetail.color, opacity: metricDetail.opacity }, { 'data-vc-quote-author': 'true' })}
        </figcaption>}
      </figure>;
    })() : block.type === 'bignumber' ? (() => {
      const size = bigNumberFit({ value: block.value, widthPx: inner.w, heightPx: inner.h, unit, fontFamily: displayFont, weight: displayWeight });
      return <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: justify, color: strong, ...panelBox }}>
        {cell(block.value, ['value'], 'número', { display: 'block', whiteSpace: 'nowrap', overflowWrap: 'normal', fontFamily: displayFont, fontWeight: displayWeight, fontSynthesisWeight: 'none', fontSize: size, lineHeight: 1.02, letterSpacing: '-0.03em', color: accentInk }, { 'data-vc-bignumber-value': 'true' })}
        {cell(block.label, ['label'], 'rótulo do número', { display: 'block', marginTop: 18 * unit, fontSize: 36 * unit, lineHeight: 1.2, fontWeight: 600, color: strong }, { 'data-vc-bignumber-label': 'true' })}
        {block.detail && cell(block.detail, ['detail'], 'apoio do número', { display: 'block', marginTop: 10 * unit, fontSize: Math.max(26, st.detailPx) * unit, lineHeight: 1.35, color: metricDetail.color, opacity: metricDetail.opacity }, { 'data-vc-bignumber-detail': 'true' })}
      </div>;
    })() : block.type === 'icons' ? <ul style={{ margin: 0, padding: 0, listStyle: 'none', height: '100%', alignContent: anchor === 'start' ? 'start' : 'center', display: 'grid',
      gridTemplateColumns: `repeat(${iconColumns}, minmax(0, 1fr))`, gap: iconGap }}>
      {block.items.map((item, index) => {
        const Icon = ICON_COMPONENTS[item.icon] || Check;
        const next = PRESENTATION_ICON_NAMES[(PRESENTATION_ICON_NAMES.indexOf(item.icon) + 1) % PRESENTATION_ICON_NAMES.length];
        return <li key={index} style={{ minWidth: 0, color: strong, ...(panel ? { backgroundColor: st.panelColor, borderRadius: st.radius * unit, padding: `${26 * unit}px` } : {}) }}>
          <span
            data-vc-icon={item.icon}
            role={editable ? 'button' : undefined}
            tabIndex={editable ? 0 : undefined}
            aria-label={editable ? `Trocar ícone ${index + 1}` : undefined}
            title={editable ? 'Clique para trocar o ícone' : undefined}
            onClick={editable ? (event) => { event.stopPropagation(); commitBlock(['items', index, 'icon'], next); } : undefined}
            onKeyDown={editable ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); commitBlock(['items', index, 'icon'], next); } } : undefined}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: iconSize.badge, height: iconSize.badge, borderRadius: '50%', backgroundColor: badgeColor, marginBottom: 28 * unit, cursor: editable ? 'pointer' : undefined }}
          ><Icon aria-hidden="true" size={iconSize.glyph} color={badgeInk} strokeWidth={1.75} /></span>
          {cell(item.title, ['items', index, 'title'], `título do item ${index + 1}`, { display: 'block', fontWeight: 600, fontSize: 38 * unit, lineHeight: 1.18, color: strong }, { 'data-vc-icons-title': 'true' })}
          {item.body && cell(item.body, ['items', index, 'body'], `linha do item ${index + 1}`, { display: 'block', marginTop: 12 * unit, fontSize: Math.max(28, st.detailPx) * unit, lineHeight: 1.4, color: stepBody.color, opacity: stepBody.opacity }, { 'data-vc-icons-body': 'true' })}
        </li>;
      })}
    </ul> : <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: `repeat(${stepColumns}, minmax(0, 1fr))`, gap: 24 * unit }}>
      {block.items.map((item, index) => <li key={index} style={{ minWidth: 0, borderTop: st.metricRule ? `${Math.max(1, (st.metricRule > 4 ? 6 : 2) * unit)}px solid ${ruleColor}` : 'none', padding: panel ? `${22 * unit}px` : `${16 * unit}px 0 0`, borderRadius: st.radius * unit, backgroundColor: panel ? st.panelColor : 'transparent', color: panelInk }}>
        {!/^[A-Z][.)]?$/.test(item.title) && <span aria-hidden style={{ display: st.stepMarker === 'pill' ? 'inline-block' : 'block', fontFamily: numberFont, fontSize: (st.stepMarker === 'pill' ? 20 : 40) * unit, lineHeight: 1, marginBottom: 14 * unit, color: st.accent,
          fontStyle: st.stepMarker === 'roman' ? 'italic' : 'normal',
          ...(st.stepMarker === 'pill' ? { backgroundColor: st.accent, color: st.pillInk, borderRadius: 40 * unit, padding: `${8 * unit}px ${16 * unit}px` } : {}) }}>{marker(index)}</span>}
        {cell(item.title, ['items', index, 'title'], `etapa ${index + 1}`, { display: 'block', fontWeight: 600, fontSize: 28 * unit, lineHeight: 1.2 })}
        {item.body && cell(item.body, ['items', index, 'body'], `explicação da etapa ${index + 1}`, { display: 'block', fontSize: Math.max(26, st.detailPx) * unit, marginTop: 8 * unit, color: stepBody.color, opacity: stepBody.opacity })}
      </li>)}
    </ol>}
  </div>;
}
