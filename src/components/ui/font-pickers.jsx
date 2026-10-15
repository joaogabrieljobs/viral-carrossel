// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useState, useMemo } from 'react';
import { SectionLabel as S } from './SectionLabel.jsx';
import { FONT_PAIRINGS, pairingMatchesBrand } from '../../utils/slide-design-system.js';
import { TITLE_FONTS } from '../../utils/design-data.js';
import { BODY_FONTS } from '../../utils/brand-visuals.js';
import { vcCustomTitleFace } from '../../utils/brand-helpers.js';

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
};

/** A mesma lista para qualquer texto; a opção vazia volta a herdar o estilo. */
export function FontFamilySelect({ label = 'Fonte do texto selecionado', value = '', onChange, brand = {} }) {
  const fonts = [...new Map([...TITLE_FONTS, ...BODY_FONTS].map(font => [font.val, font])).values()];
  const custom = [];
  if (brand?.customTitleFont?.dataUrl) custom.push({
    name: brand.customTitleFont.fileName || 'Fonte importada de títulos',
    val: `${vcCustomTitleFace(brand.id)}, ${brand.titleFont}`,
  });
  if (brand?.customBodyFont?.dataUrl) custom.push({
    name: brand.customBodyFont.fileName || 'Fonte importada de corpo',
    val: `VCBrandBody-${brand.id || 'default'}, ${brand.bodyFont}`,
  });
  const known = [...fonts, ...custom].some(font => font.val === value);
  return (
    <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
      {label}
      <select
        className="vc-input"
        aria-label={label}
        value={value}
        onChange={event => onChange(event.target.value)}
        style={{ width: '100%', minWidth: 0, minHeight: 42, fontSize: 13, fontFamily: value || 'var(--font-ui)' }}
      >
        <option value="">Usar fonte do estilo</option>
        {value && !known && <option value={value}>{value.split(',')[0].replace(/["']/g, '')}</option>}
        {custom.length > 0 && <optgroup label="Fontes importadas">
          {custom.map(font => <option key={font.val} value={font.val}>{font.name}</option>)}
        </optgroup>}
        {['sans', 'display', 'serif', 'editorial', 'mono'].map(cat => (
          <optgroup key={cat} label={FONT_CAT_LABELS[cat]}>
            {fonts.filter(font => (font.cat || 'sans') === cat).map(font => (
              <option key={font.val} value={font.val} style={{ fontFamily: font.val }}>{font.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
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
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, maxHeight:240, overflowY:'auto', paddingRight:4 }}>
        {filtered.map(f => (
          <button key={f.name} onClick={()=>onChange(f.val)}
            style={{
              padding:'9px 8px', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer',
              fontFamily:f.val, transition:'all 0.12s', textAlign:'left',
              background: active===f.val ? 'var(--text-primary)' : 'var(--bg-card)',
              border: `1px solid ${active===f.val ? 'transparent' : 'var(--border)'}`,
              color: active===f.val ? 'var(--bg-base)' : 'var(--text-secondary)',
              minHeight:36, display:'flex', alignItems:'center',
            }}
            title={f.name}
          >{f.name}</button>
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
