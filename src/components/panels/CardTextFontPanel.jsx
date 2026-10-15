import React from 'react';
import { FontFamilySelect } from '../ui/font-pickers.jsx';
import { normalizeOverlays, parseOverlayMoveKey, updateOverlayOnSlide } from '../../utils/card-overlays.js';
import { getTextFont, textFontPatch } from '../../utils/card-text-fonts.js';

/** Escolhas locais do card, independentes da combinação tipográfica da marca. */
export function CardTextFontPanel({ slide, brand, selectedKey, onSelect, onUpdate }) {
  if (!slide) return null;
  const hidden = new Set(slide.hiddenElements || []);
  const targets = [
    { key: 'title', label: 'Título', text: slide.title },
    { key: 'subtitle', label: 'Subtítulo', text: slide.subtitle },
    { key: 'eyebrow', label: 'Título de apoio', text: slide.eyebrowText },
    { key: 'bodyAfterImage', label: 'Texto abaixo da imagem', text: slide.bodyAfterImage },
    { key: 'offer', label: 'Preço / oferta', text: [slide.strikethroughText, slide.afterTitleText].filter(Boolean).join(' · ') },
    { key: 'headerBar', label: 'Cabeçalho', text: [brand?.cultureHeaderLeft, brand?.cultureHeaderCenter, brand?.cultureHeaderYear].filter(Boolean).join(' · ') },
    { key: 'pageBadge', label: 'Número do card', text: brand?.showPageBadge ? String(slide.num || 1) : '' },
    { key: 'handleBadge', label: 'Assinatura / @', text: brand?.showHandle && slide.showHandle !== false ? (brand.handle || 'Assinatura') : '' },
    { key: 'pill', label: 'Chamada do rodapé', text: brand?.footerPillText },
    { key: 'footerBar', label: 'Rodapé', text: [brand?.footerBarLeft, brand?.footerBarCenter, brand?.footerBarRight].filter(Boolean).join(' · ') },
  ].filter(target => !hidden.has(target.key) && (target.text || ['title', 'subtitle'].includes(target.key)));
  const overlays = normalizeOverlays(slide.overlays);
  overlays.forEach((overlay, index) => {
    if (!['text', 'cta'].includes(overlay.type) || hidden.has(`ov_${overlay.id}`)) return;
    targets.push({ key: `ov_${overlay.id}`, label: `${overlay.type === 'cta' ? 'Chamada extra' : 'Texto extra'} ${index + 1}`, text: overlay.text });
  });
  const target = targets.find(item => item.key === selectedKey) || targets[0];
  if (!target) return null;
  const overlayId = parseOverlayMoveKey(target.key);
  const overlay = overlays.find(item => item.id === overlayId);
  const fontFamily = overlay ? (overlay.fontFamily || '') : getTextFont(slide, target.key, '');
  return (
    <section aria-label="Fonte de cada texto" style={{ display: 'grid', gap: 12, padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
      <div style={{ display: 'grid', gap: 4 }}>
        <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>Fonte de cada texto</strong>
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)' }}>
          Clique em um texto no card ou escolha abaixo. A mudança vale só para ele.
        </p>
      </div>
      <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
        Texto do card
        <select className="vc-input" aria-label="Texto do card" value={target.key} onChange={event => onSelect(event.target.value)} style={{ minHeight: 42, width: '100%', fontSize: 13 }}>
          {targets.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </label>
      <FontFamilySelect
        value={fontFamily}
        brand={brand}
        onChange={value => onUpdate(overlay
          ? { overlays: updateOverlayOnSlide(slide, overlay.id, { fontFamily: value }).overlays }
          : textFontPatch(slide, target.key, value))}
      />
      {target.text && <p style={{ margin: 0, fontSize: 16, lineHeight: 1.4, fontFamily: fontFamily || 'inherit', color: 'var(--text-primary)', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
        {String(target.text).slice(0, 90)}
      </p>}
    </section>
  );
}
