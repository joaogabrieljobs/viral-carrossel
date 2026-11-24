import React, { useEffect, useRef, useState } from 'react';
import LegacyPresentationBlocks from './LegacyPresentationBlocks.jsx';
import { normalizePresentationBlocks } from '../utils/presentation-quality.js';
import { familyEvidenceStyle, familyFont, normalizeFamilyKey } from '../utils/presentation-families.js';
import { readTypedText } from '../utils/inline-edit-text.js';

function EditableCell({ as: Tag = 'span', value, label, onCommit, style = {} }) {
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
 */
export function metricRowFit({ values, columnPx, unit, fontFamily, weight }) {
  const count = values.length;
  const max = (count > 3 ? 72 : 96) * unit;
  const floor = 44 * unit;
  const fits = values.map(value => metricValueFit({ value, columnPx, unit, count, fontFamily, weight }));
  const size = Math.min(max, Math.max(floor, Math.min(...fits.map(fit => (fit.wrap ? 0 : fit.fontSize)))));
  return values.map(value => {
    const perPx = measureMetricText(value, fontFamily, weight);
    return { fontSize: size, wrap: perPx * size > columnPx * 0.92 };
  });
}

/** A small, allowlisted set of editable primitives shared by preview and export.
 * React escapes every value; generated content never controls markup or CSS. */
export default function PresentationBlocks({ blocks: raw, rect, frame, ink, background, fontFamily, family = 'executive', accent, numericTypography, onChange, forExport = false, artDirectionVersion = 2, paletteOverrides = {} }) {
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
  const familyStyle = familyEvidenceStyle(key);
  const st = paletteOverrides?.accent ? Object.fromEntries(Object.entries(familyStyle)
    .map(([name, value]) => [name, typeof value === 'string' && value.toLowerCase() === String(familyStyle.accent || '').toLowerCase() ? paletteOverrides.accent : value]))
    : familyStyle;
  const panel = st.panel;
  const ruleColor = st.metricRuleColor || accent || ink;
  const headerFont = familyFont(key, st.headerRole === 'display' ? 'display' : st.headerRole === 'label' ? 'label' : 'text');
  const numberFont = numericTypography?.fontFamily || familyFont(key, 'numeric').css || fontFamily;
  const panelInk = panel ? st.ink : ink;
  const roman = ['I', 'II', 'III', 'IV', 'V'];
  // Valor da métrica cabe numa linha da coluna (mesmo cálculo da galeria).
  const metricColumnPx = (count) => {
    const cols = Math.min(count, frame.h > frame.w ? 2 : 4);
    return ((rect.w / 100) * frame.w - (cols - 1) * 28 * unit) / cols - (panel ? 52 * unit : 0);
  };
  const marker = (index) => st.stepMarker === 'roman' ? roman[index] : st.stepMarker === 'code' ? `0${index + 1}/` : String(index + 1).padStart(2, '0');
  const stepColumns = frame.h === frame.w ? Math.min(block.items?.length || 1, 2)
    : frame.h > frame.w ? ((block.items?.length || 0) > 3 ? 2 : 1) : Math.min(block.items?.length || 1, 4);
  const cell = (value, path, label, style) => <EditableCell
    key={path.join('.')}
    value={value}
    label={label}
    style={style}
    onCommit={!forExport && onChange ? (text) => {
      const next = JSON.parse(JSON.stringify(blocks));
      let parent = next[0];
      path.slice(0, -1).forEach((key) => { parent = parent[key]; });
      parent[path[path.length - 1]] = text;
      if (!normalizePresentationBlocks(next).length) return false;
      onChange(next);
      return true;
    } : undefined}
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
          return cell(item.value, ['items', index, 'value'], `valor ${index + 1}`, { display: 'block', whiteSpace: fit.wrap ? 'normal' : 'nowrap', overflowWrap: fit.wrap ? 'anywhere' : 'normal', fontFamily: numberFont, fontVariantNumeric: 'tabular-nums', fontSize: fit.fontSize, letterSpacing: '-0.02em', lineHeight: fit.wrap ? 1.1 : 1.18, fontWeight: weight, fontSynthesisWeight: 'none' });
        })()}
        {cell(item.label, ['items', index, 'label'], `indicador ${index + 1}`, { display: 'block', fontSize: 26 * unit, marginTop: 18 * unit, fontWeight: 600 })}
        {item.detail && cell(item.detail, ['items', index, 'detail'], `condição ${index + 1}`, { display: 'block', fontSize: 23 * unit, marginTop: 8 * unit, opacity: 0.75 })}
      </div>)}
    </div> : <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: `repeat(${stepColumns}, minmax(0, 1fr))`, gap: 24 * unit }}>
      {block.items.map((item, index) => <li key={index} style={{ minWidth: 0, borderTop: st.metricRule ? `${Math.max(1, (st.metricRule > 4 ? 6 : 2) * unit)}px solid ${ruleColor}` : 'none', padding: panel ? `${22 * unit}px` : `${16 * unit}px 0 0`, borderRadius: st.radius * unit, backgroundColor: panel ? st.panelColor : 'transparent', color: panelInk }}>
        {!/^[A-Z][.)]?$/.test(item.title) && <span aria-hidden style={{ display: st.stepMarker === 'pill' ? 'inline-block' : 'block', fontFamily: numberFont, fontSize: (st.stepMarker === 'pill' ? 20 : 40) * unit, lineHeight: 1, marginBottom: 14 * unit, fontVariantNumeric: 'tabular-nums', color: st.accent,
          fontStyle: st.stepMarker === 'roman' ? 'italic' : 'normal',
          ...(st.stepMarker === 'pill' ? { backgroundColor: st.accent, color: '#fff', borderRadius: 40 * unit, padding: `${8 * unit}px ${16 * unit}px` } : {}) }}>{marker(index)}</span>}
        {cell(item.title, ['items', index, 'title'], `etapa ${index + 1}`, { display: 'block', fontWeight: 600, fontSize: 28 * unit, lineHeight: 1.2 })}
        {item.body && cell(item.body, ['items', index, 'body'], `explicação da etapa ${index + 1}`, { display: 'block', marginTop: 8 * unit, opacity: 0.82 })}
      </li>)}
    </ol>}
  </div>;
}
