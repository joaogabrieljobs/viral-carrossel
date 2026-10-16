import React from 'react';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from 'lucide-react';
import { FontFamilySelect } from '../ui/font-pickers.jsx';
import { normalizeOverlays, parseOverlayMoveKey, updateOverlayOnSlide } from '../../utils/card-overlays.js';
import { getTextFont, textFontPatch } from '../../utils/card-text-fonts.js';
import { remapDestaqueSpansOnEdit } from '../../utils/text-spans.js';

const CARD_ALIGN = [
  { id: 'left', label: 'Esquerda', short: 'Esq.', Icon: AlignLeft },
  { id: 'center', label: 'Centro', short: 'Centro', Icon: AlignCenter },
  { id: 'right', label: 'Direita', short: 'Dir.', Icon: AlignRight },
  { id: 'justify', label: 'Justificar', short: 'Just.', Icon: AlignJustify },
];

function clampCardTextWidth(width) {
  return Math.round(Math.min(92, Math.max(24, Number(width) || 62)));
}

function clampTextBox(height) {
  const next = Number(height) || 160;
  return Math.min(640, Math.max(160, next));
}

function hexColor(value, fallback) {
  const color = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return fallback;
}

function keptLines(parts) {
  const values = parts.map(part => part ?? '');
  while (values.length && !String(values[values.length - 1]).trim()) values.pop();
  return values.join('\n');
}

function readDraft(slide, brand, key, overlay) {
  if (overlay) return overlay.text ?? '';
  if (key === 'title') return slide.title ?? '';
  if (key === 'subtitle') return slide.subtitle ?? '';
  if (key === 'bodyAfterImage') return slide.bodyAfterImage ?? '';
  if (key === 'eyebrow') return slide.eyebrowText ?? '';
  if (key === 'offer') return keptLines([slide.strikethroughText, slide.afterTitleText]);
  if (key === 'headerBar') return keptLines([brand?.cultureHeaderLeft, brand?.cultureHeaderCenter, brand?.cultureHeaderYear]);
  if (key === 'handleBadge') return brand?.handle ?? '';
  if (key === 'pill') return brand?.footerPillText ?? '';
  if (key === 'footerBar') return keptLines([brand?.footerBarLeft, brand?.footerBarCenter, brand?.footerBarRight]);
  if (key === 'pageBadge') return String(slide.num || 1);
  return '';
}

function readColor(slide, brand, key, overlay) {
  if (overlay) return hexColor(overlay.type === 'cta' ? (overlay.fg || overlay.color) : overlay.color, '#3A322C');
  if (key === 'title' || key === 'eyebrow') return hexColor(slide.titleColor || brand?.titleColor, '#111111');
  if (key === 'subtitle' || key === 'bodyAfterImage') return hexColor(slide.subtitleColor || brand?.subtitleColor || brand?.textColor, '#363636');
  if (key === 'offer') return hexColor(brand?.accent, '#111111');
  return hexColor(brand?.titleColor, '#111111');
}

/** Escolhas locais do card, independentes da combinação tipográfica da marca. */
export function CardTextFontPanel({ slide, brand, selectedKey, onSelect, onUpdate, onUpdateBrand, onApplyAll, cardCount = 1 }) {
  const hidden = new Set(slide?.hiddenElements || []);
  const targets = !slide ? [] : [
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
  const overlays = normalizeOverlays(slide?.overlays);
  overlays.forEach((overlay, index) => {
    if (!['text', 'cta'].includes(overlay.type) || hidden.has(`ov_${overlay.id}`)) return;
    targets.push({ key: `ov_${overlay.id}`, label: `${overlay.type === 'cta' ? 'Chamada extra' : 'Texto extra'} ${index + 1}`, text: overlay.text });
  });
  const target = targets.find(item => item.key === selectedKey) || targets[0];
  const overlayId = target ? parseOverlayMoveKey(target.key) : null;
  const overlay = overlays.find(item => item.id === overlayId);
  const color = slide && target ? readColor(slide, brand, target.key, overlay) : '#111111';
  const [boxHeight, setBoxHeight] = React.useState(160);
  const [colorDraft, setColorDraft] = React.useState(color);
  React.useEffect(() => { setColorDraft(color); }, [color, target?.key]);
  if (!slide || !target) return null;
  const fontFamily = overlay ? (overlay.fontFamily || '') : getTextFont(slide, target.key, '');
  const draft = readDraft(slide, brand, target.key, overlay);
  const align = overlay ? (overlay.align || 'left') : (slide.align || 'left');
  const alignOptions = overlay ? CARD_ALIGN.filter(item => item.id !== 'justify') : CARD_ALIGN;
  const canEdit = target.key !== 'pageBadge';

  const writeDraft = (value) => {
    if (overlay) {
      onUpdate({ overlays: updateOverlayOnSlide(slide, overlay.id, { text: value }).overlays });
      return;
    }
    const ds = slide.destaqueSpans && typeof slide.destaqueSpans === 'object' ? slide.destaqueSpans : {};
    if (target.key === 'title' || target.key === 'subtitle' || target.key === 'bodyAfterImage') {
      const previous = slide[target.key] ?? '';
      onUpdate({
        [target.key]: value,
        destaqueSpans: { ...ds, [target.key]: remapDestaqueSpansOnEdit(previous, value, ds[target.key] ?? []) },
      });
      return;
    }
    if (target.key === 'eyebrow') {
      onUpdate({ eyebrowText: value });
      return;
    }
    if (target.key === 'offer') {
      const [strike, ...rest] = String(value).split('\n');
      onUpdate({
        strikethroughText: rest.length ? strike : '',
        afterTitleText: rest.length ? rest.join('\n') : strike,
      });
      return;
    }
    if (!onUpdateBrand) return;
    if (target.key === 'handleBadge') onUpdateBrand({ ...brand, handle: value });
    else if (target.key === 'pill') onUpdateBrand({ ...brand, footerPillText: value });
    else if (target.key === 'headerBar') {
      const [left = '', center = '', year = ''] = String(value).split('\n');
      onUpdateBrand({ ...brand, cultureHeaderLeft: left, cultureHeaderCenter: center, cultureHeaderYear: year });
    } else if (target.key === 'footerBar') {
      const [left = '', center = '', right = ''] = String(value).split('\n');
      onUpdateBrand({ ...brand, footerBarLeft: left, footerBarCenter: center, footerBarRight: right });
    }
  };

  const writeColor = (hex) => {
    if (overlay) {
      const patch = overlay.type === 'cta' ? { fg: hex } : { color: hex };
      onUpdate({ overlays: updateOverlayOnSlide(slide, overlay.id, patch).overlays });
      return;
    }
    if (target.key === 'title' || target.key === 'eyebrow') onUpdate({ titleColor: hex });
    else if (target.key === 'subtitle' || target.key === 'bodyAfterImage') onUpdate({ subtitleColor: hex });
    else if (target.key === 'offer') onUpdateBrand?.({ ...brand, accent: hex, visualIdentityLocked: true });
    else onUpdateBrand?.({ ...brand, titleColor: hex, visualIdentityLocked: true });
  };

  const writeAlign = (id) => {
    if (overlay) onUpdate({ overlays: updateOverlayOnSlide(slide, overlay.id, { align: id }).overlays });
    else onUpdate({ align: id });
  };

  return (
    <section className="vc-type-inspector" aria-label="Tipografia do card">
      <div style={{ display: 'grid', gap: 4 }}>
        <strong className="vc-type-inspector__heading">Tipografia do card</strong>
        <p className="vc-type-inspector__help">
          Escolha o texto e edite na caixa. Maior abre mais espaço. Alinhamento e cor ficam aqui.
        </p>
      </div>
      <label className="vc-type-inspector__label">
        Texto que você quer editar
        <select className="vc-input" aria-label="Texto do card" value={target.key} onChange={event => onSelect(event.target.value)}>
          {targets.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </label>
      <div className="vc-type-inspector__label">
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <label htmlFor="vc-card-text-box">{canEdit ? 'Caixa de texto' : 'Número do card'}</label>
          {canEdit ? (
            <span style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="vc-text-box-size" onClick={() => setBoxHeight(height => clampTextBox(height - 80))} aria-label="Diminuir a caixa de texto">Menor</button>
              <button type="button" className="vc-text-box-size" onClick={() => setBoxHeight(height => clampTextBox(height + 120))} aria-label="Aumentar a caixa de texto">Maior</button>
            </span>
          ) : null}
        </span>
        <textarea
          id="vc-card-text-box"
          className="vc-input vc-textarea"
          aria-label={canEdit ? 'Caixa de texto' : 'Número do card'}
          value={draft}
          readOnly={!canEdit}
          rows={6}
          onChange={event => writeDraft(event.target.value)}
          onMouseUp={event => setBoxHeight(clampTextBox(event.currentTarget.offsetHeight))}
          style={{
            minHeight: 160,
            height: boxHeight,
            resize: canEdit ? 'vertical' : 'none',
            fontFamily: fontFamily || 'inherit',
            fontSize: 16,
            lineHeight: 1.45,
          }}
        />
      </div>
      <div>
        <span className="vc-type-inspector__label">Alinhamento</span>
        <div role="group" aria-label="Alinhamento" style={{ display: 'grid', gridTemplateColumns: `repeat(${alignOptions.length}, 1fr)`, gap: 4, marginTop: 7 }}>
          {alignOptions.map((item) => {
            const active = align === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                aria-pressed={active}
                onClick={() => writeAlign(item.id)}
                style={{
                  minHeight: 52,
                  borderRadius: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent)' : 'var(--bg-card)',
                  color: active ? 'var(--accent-on-dark, #fff)' : 'var(--text-primary)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <item.Icon size={14} aria-hidden />
                {item.short}
              </button>
            );
          })}
        </div>
      </div>
      <div className="vc-type-inspector__label">
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          Área no card
          <span style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="vc-text-box-size" aria-label="Diminuir a área do texto no card" onClick={() => onUpdate({ textBlockWidth: clampCardTextWidth((slide.textBlockWidth ?? 62) - 8) })}>Estreito</button>
            <button type="button" className="vc-text-box-size" aria-label="Aumentar a área do texto no card" onClick={() => onUpdate({ textBlockWidth: clampCardTextWidth((slide.textBlockWidth ?? 62) + 8) })}>Largo</button>
          </span>
        </span>
      </div>
      <label className="vc-type-inspector__label">
        Cor do texto
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color"
            aria-label="Cor do texto"
            value={color}
            onChange={event => writeColor(event.target.value)}
            style={{
              width: 44, height: 36, padding: 2, borderRadius: 8, flexShrink: 0,
              border: '1px solid var(--hairline)', background: 'var(--bg-card)', cursor: 'pointer',
            }}
          />
          <input
            className="vc-input"
            aria-label="Código da cor do texto"
            value={colorDraft}
            onChange={event => {
              const next = event.target.value;
              setColorDraft(next);
              if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(next.trim())) writeColor(hexColor(next, color));
            }}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
          />
        </span>
      </label>
      <FontFamilySelect
        value={fontFamily}
        brand={brand}
        onChange={value => onUpdate(overlay
          ? { overlays: updateOverlayOnSlide(slide, overlay.id, { fontFamily: value }).overlays }
          : textFontPatch(slide, target.key, value))}
      />
      {target.text && <div className="vc-type-inspector__preview" aria-label="Prévia da fonte selecionada">
        <span className="vc-type-inspector__caption">PRÉVIA · {target.label}</span>
        <p style={{ fontFamily: fontFamily || 'inherit' }}>{String(target.text).slice(0, 90)}</p>
      </div>}
      <div className="vc-type-inspector__scope">
        <button
          type="button"
          className="vc-btn vc-btn-ghost"
          disabled={cardCount < 2}
          onClick={() => onApplyAll?.(target.key, fontFamily, slide.id)}
          title={`Usar esta fonte em ${target.label.toLowerCase()} de todos os cards`}
        >
          Aplicar em todos
        </button>
        <span>{cardCount < 2 ? 'Adicione outro card para repetir esta fonte.' : `Repete só “${target.label.toLowerCase()}” nos ${cardCount} cards.`}</span>
      </div>
    </section>
  );
}
