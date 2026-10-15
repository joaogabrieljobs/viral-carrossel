// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { SectionLabel as S } from './SectionLabel.jsx';
import { FONT_PAIRINGS, pairingMatchesBrand } from '../../utils/slide-design-system.js';
import { TITLE_FONTS } from '../../utils/design-data.js';
import { BODY_FONTS } from '../../utils/brand-visuals.js';
import { vcCustomTitleFace } from '../../utils/brand-helpers.js';
import './font-family-select.css';

// Section wrapper
// Agrupador de fontes por categoria com filtro lateral.
// `fonts` é um array de { name, val, cat? }; cats reconhecidas:
// 'sans', 'display', 'serif', 'editorial', 'mono'
const FONT_CAT_LABELS = {
  all:       'Todas',
  sans:      'Sans',
  display:   'Display',
  serif:     'Serif',
  editorial: 'Editorial',
  mono:      'Mono',
  imported:  'Importadas',
};

/** A mesma lista para qualquer texto; a opção vazia volta a herdar o estilo. */
export function FontFamilySelect({ label = 'Fonte do texto selecionado', value = '', onChange, brand = {} }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const panelId = useId();
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const choicesRef = useRef(null);
  const fonts = [...new Map([...TITLE_FONTS, ...BODY_FONTS].map(font => [font.val, font])).values()];
  const custom = [];
  if (brand?.customTitleFont?.dataUrl) custom.push({
    name: brand.customTitleFont.fileName || 'Fonte importada de títulos',
    val: `${vcCustomTitleFace(brand.id)}, ${brand.titleFont}`,
    cat: 'imported',
  });
  if (brand?.customBodyFont?.dataUrl) custom.push({
    name: brand.customBodyFont.fileName || 'Fonte importada de corpo',
    val: `VCBrandBody-${brand.id || 'default'}, ${brand.bodyFont}`,
    cat: 'imported',
  });
  const known = [...fonts, ...custom].some(font => font.val === value);
  const unlisted = value && !known ? [{
    name: value.split(',')[0].replace(/["']/g, '').trim(), val: value, cat: 'imported',
  }] : [];
  const allFonts = [...unlisted, ...custom, ...fonts];
  const selected = allFonts.find(font => font.val === value);
  const categories = ['all', ...['imported', 'sans', 'display', 'serif', 'editorial', 'mono']
    .filter(cat => allFonts.some(font => (font.cat || 'sans') === cat))];
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const visibleFonts = allFonts.filter(font => (
    (category === 'all' || (font.cat || 'sans') === category)
    && (!normalizedQuery || font.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery))
  ));
  const groups = categories.slice(1).map(cat => ({
    cat, fonts: visibleFonts.filter(font => (font.cat || 'sans') === cat),
  })).filter(group => group.fonts.length);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const choose = (fontValue) => {
    onChange(fontValue);
    setOpen(false);
    setCategory('all');
    setQuery('');
    triggerRef.current?.focus();
  };
  const focusChoice = (direction, origin = null) => {
    const choices = [...(choicesRef.current?.querySelectorAll('.vc-font-choice') || [])];
    if (!choices.length) return;
    const index = origin ? choices.indexOf(origin) : -1;
    const next = direction > 0
      ? (index + 1) % choices.length
      : (index < 0 ? choices.length - 1 : (index - 1 + choices.length) % choices.length);
    choices[next]?.focus();
  };
  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setCategory('all');
      setQuery('');
      triggerRef.current?.focus();
    } else if (event.key === 'ArrowDown' && open && (event.target === searchRef.current || event.target.classList?.contains('vc-font-choice'))) {
      event.preventDefault();
      focusChoice(1, event.target.classList?.contains('vc-font-choice') ? event.target : null);
    } else if (event.key === 'ArrowUp' && open && event.target.classList?.contains('vc-font-choice')) {
      event.preventDefault();
      focusChoice(-1, event.target);
    }
  };
  return (
    <div className="vc-font-select" onKeyDown={handleKeyDown}>
      <span className="vc-font-select__label">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className="vc-font-select__trigger"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (open) {
            setCategory('all');
            setQuery('');
          }
          setOpen(!open);
        }}
        onKeyDown={event => {
          if (!open && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="vc-font-select__selected" style={{ fontFamily: value || 'var(--font-ui)' }}>
          {selected?.name || 'Usar fonte do estilo'}
        </span>
        <span className="vc-font-select__chevron" aria-hidden="true">{open ? '⌃' : '⌄'}</span>
      </button>
      {open && <div id={panelId} className="vc-font-select__panel">
        <div className="vc-font-select__search-wrap">
          <input
            ref={searchRef}
            type="search"
            className="vc-font-select__search"
            aria-label="Buscar fonte"
            placeholder="Buscar fonte"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
        <div className="vc-font-select__categories" role="group" aria-label="Categorias de fontes">
          {categories.map(cat => <button
            key={cat}
            type="button"
            className="vc-font-select__category"
            aria-pressed={category === cat}
            onClick={() => setCategory(cat)}
          >{FONT_CAT_LABELS[cat]}</button>)}
        </div>
        <div ref={choicesRef} className="vc-font-select__choices" role="group" aria-label="Fontes disponíveis">
          {category === 'all' && !normalizedQuery && <button
            type="button"
            className="vc-font-choice vc-font-choice--inherit"
            aria-label="Usar fonte do estilo"
            aria-pressed={!value}
            onClick={() => choose('')}
          >
            <span className="vc-font-choice__sample" aria-hidden="true">Moont</span>
            <span className="vc-font-choice__name">Usar fonte do estilo</span>
          </button>}
          {groups.map(({ cat, fonts: groupFonts }) => <div key={cat} className="vc-font-select__group">
            <span className="vc-font-select__group-title">{FONT_CAT_LABELS[cat]}</span>
            {groupFonts.map(font => <button
              key={font.val}
              type="button"
              className="vc-font-choice"
              aria-label={font.name}
              aria-pressed={value === font.val}
              data-font-value={font.val}
              onClick={() => choose(font.val)}
            >
              <span className="vc-font-choice__sample" style={{ fontFamily: font.val }} aria-hidden="true">Moont</span>
              <span className="vc-font-choice__name">{font.name}</span>
            </button>)}
          </div>)}
          {!groups.length && <p className="vc-font-select__empty">Nenhuma fonte encontrada.</p>}
        </div>
      </div>}
    </div>
  );
}
const FontPairingPicker = ({ brand, onApply, children }) => {
  const [showAll, setShowAll] = React.useState(false);
  return (
    <>
      <S title="Fontes do projeto" hint="Combinações para o estilo geral. As fontes escolhidas para cada texto continuam preservadas.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
          {FONT_PAIRINGS.map((p) => {
            const active = pairingMatchesBrand(brand, p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onApply(p)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-surface)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'grid',
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: p.titleFont, color: 'var(--text-primary)' }}>
                  {p.name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                  {p.use} · título + corpo
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          style={{
            marginTop: 8,
            height: 34,
            borderRadius: 9999,
            border: '1px solid var(--border)',
            background: 'var(--bg-pearl)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
        >
          {showAll ? 'Ocultar fontes individuais' : 'Todas as fontes'}
        </button>
      </S>
      {showAll ? children : null}
    </>
  );
};

const FontPicker = ({ title, fonts, active, onChange }) => {
  const [cat, setCat] = React.useState('all');
  const cats = React.useMemo(() => {
    const s = new Set(fonts.map(f => f.cat || 'sans'));
    return ['all', ...['sans','display','serif','editorial','mono'].filter(c => s.has(c))];
  }, [fonts]);
  const filtered = cat === 'all' ? fonts : fonts.filter(f => (f.cat || 'sans') === cat);
  return (
    <S title={title}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:2 }}>
        {cats.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            style={{
              fontSize:11, padding:'4px 12px', borderRadius:9999, cursor:'pointer',
              fontWeight:400, letterSpacing:'-0.011em',
              transition:'background-color 0.15s var(--ease-smooth), color 0.15s var(--ease-smooth)',
              background: cat === c ? 'var(--accent)' : 'var(--bg-pearl)',
              border: `1px solid ${cat === c ? 'var(--accent)' : 'var(--hairline)'}`,
              color: cat === c ? '#fff' : 'var(--text-secondary)',
            }}
          >{FONT_CAT_LABELS[c] || c}</button>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:5, maxHeight:320, overflowY:'auto', paddingRight:4 }}>
        {filtered.map(f => (
          <button
            key={f.val}
            type="button"
            className="vc-font-choice"
            aria-label={f.name}
            aria-pressed={active===f.val}
            onClick={()=>onChange(f.val)}
            title={f.name}
          >
            <span className="vc-font-choice__sample" style={{ fontFamily: f.val }} aria-hidden="true">Moont</span>
            <span className="vc-font-choice__name">{f.name}</span>
          </button>
        ))}
      </div>
    </S>
  );
};

export {
  FONT_CAT_LABELS,
  FontPairingPicker,
  FontPicker,
};
