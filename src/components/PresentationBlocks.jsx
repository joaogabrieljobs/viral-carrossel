import React, { useEffect, useRef, useState } from 'react';
import { normalizePresentationBlocks } from '../utils/presentation-quality.js';

function EditableCell({ as: Tag = 'span', value, label, onCommit, style = {} }) {
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  const commit = () => {
    const text = String(ref.current?.innerText ?? ref.current?.textContent ?? '').trim();
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

/** A small, allowlisted set of editable primitives shared by preview and export.
 * React escapes every value; generated content never controls markup or CSS. */
export default function PresentationBlocks({ blocks: raw, rect, frame, ink, background, fontFamily, family = 'executive', accent, numericTypography, onChange, forExport = false }) {
  const blocks = normalizePresentationBlocks(raw);
  if (!blocks.length || !rect) return null;
  const block = blocks[0];
  const unit = frame.w / (frame.h >= frame.w ? 1080 : 1920);
  const fontSize = 25 * unit;
  const panel = ['modular', 'premium'].includes(family);
  const technical = ['technical', 'data'].includes(family);
  const ruleColor = accent || ink;
  const numberFont = numericTypography?.fontFamily || fontFamily;
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
      boxSizing: 'border-box', overflow: 'hidden', zIndex: 5, color: ink, backgroundColor: background,
      fontFamily, fontSize, lineHeight: 1.4, textAlign: 'left', textShadow: 'none' }}
  >
    {block.type === 'comparison' ? <table aria-label="Comparação" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 'inherit', color: 'inherit' }}>
      <thead><tr>{block.headers.map((value, col) => <th key={col} scope="col" style={{ textAlign: 'left', verticalAlign: 'top', padding: `${12 * unit}px ${16 * unit}px`, borderBottom: `${2 * unit}px solid ${ruleColor}`, fontWeight: 700, fontSize: 23 * unit, ...(technical ? { fontFamily: numberFont } : {}) }}>
        {cell(value, ['headers', col], `cabeçalho ${col + 1}`)}
      </th>)}</tr></thead>
      <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} style={{ backgroundColor: rowIndex % 2 === 0 ? 'rgba(127,127,127,0.065)' : 'transparent' }}>{row.map((value, col) => <td key={col} style={{ verticalAlign: 'top', padding: `${12 * unit}px ${16 * unit}px`, borderBottom: `${unit}px solid rgba(127,127,127,0.25)`, fontWeight: col === 0 ? 600 : 400 }}>
        {cell(value, ['rows', rowIndex, col], `linha ${rowIndex + 1}, coluna ${col + 1}`)}
      </td>)}</tr>)}</tbody>
    </table> : block.type === 'metrics' ? <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(block.items.length, frame.h > frame.w ? 2 : 4)}, minmax(0, 1fr))`, gap: 28 * unit }}>
      {block.items.map((item, index) => <div key={index} style={{ minWidth: 0, padding: panel ? `${22 * unit}px` : `${20 * unit}px 0 0`, borderTop: `${(family === 'swiss' ? 5 : 2) * unit}px solid ${ruleColor}`, borderRadius: panel ? 14 * unit : 0, backgroundColor: panel ? 'rgba(127,127,127,0.08)' : 'transparent' }}>
        {cell(item.value, ['items', index, 'value'], `valor ${index + 1}`, { display: 'block', fontFamily: numberFont, fontVariantNumeric: 'tabular-nums', fontSize: Math.max(42, (block.items.length > 3 ? 60 : 76) * Math.min(1, 12 / Math.max(12, [...item.value].length))) * unit, letterSpacing: '-0.035em', lineHeight: 1.06, fontWeight: numericTypography?.weight || 700, fontSynthesisWeight: 'none' })}
        {cell(item.label, ['items', index, 'label'], `indicador ${index + 1}`, { display: 'block', fontSize: 25 * unit, marginTop: 18 * unit, fontWeight: 600 })}
        {item.detail && cell(item.detail, ['items', index, 'detail'], `condição ${index + 1}`, { display: 'block', fontSize: 23 * unit, marginTop: 12 * unit })}
      </div>)}
    </div> : <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: frame.h > frame.w ? '1fr' : `repeat(${Math.min(block.items.length, 3)}, minmax(0, 1fr))`, gap: 24 * unit }}>
      {block.items.map((item, index) => <li key={index} style={{ minWidth: 0, borderTop: `${2 * unit}px solid ${ruleColor}`, padding: panel ? `${18 * unit}px` : `${14 * unit}px 0 0`, borderRadius: panel ? 12 * unit : 0, backgroundColor: panel ? 'rgba(127,127,127,0.065)' : 'transparent' }}>
        {!/^[A-Z][.)]?$/.test(item.title) && <span aria-hidden style={{ display: 'block', fontFamily: numberFont, fontSize: 22 * unit, marginBottom: 10 * unit, fontVariantNumeric: 'tabular-nums' }}>{String(index + 1).padStart(2, '0')}</span>}
        {cell(item.title, ['items', index, 'title'], `etapa ${index + 1}`, { display: 'block', fontWeight: 700, fontSize: 29 * unit })}
        {item.body && cell(item.body, ['items', index, 'body'], `explicação da etapa ${index + 1}`, { display: 'block', marginTop: 8 * unit })}
      </li>)}
    </ol>}
  </div>;
}
