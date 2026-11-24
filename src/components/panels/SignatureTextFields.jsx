import React from 'react';
import { signatureTextSupport } from '../../utils/card-signature-texts.js';

/** Motivo escrito para os campos que o layout atual do card não desenha. */
export function signatureFieldsNotice(support, itemLabel = 'card') {
  const missing = [
    support.eyebrow ? '' : 'Sobrelinha',
    support.strike === 'none' ? 'Riscado' : '',
    support.offer ? '' : 'Depois do título',
  ].filter(Boolean);
  const parts = [];
  if (missing.length === 3) {
    parts.push(`O layout atual deste ${itemLabel} não mostra estes textos. O que estiver escrito fica guardado, mas não sai no ${itemLabel} nem no arquivo.`);
  } else if (missing.length) {
    parts.push(`O layout atual deste ${itemLabel} não mostra: ${missing.join(', ')}.`);
  }
  if (support.strike === 'plain') parts.push('Neste estilo, “Riscado” sai junto de “Depois do título”, sem o traço.');
  return parts.join(' ');
}

/**
 * Sobrelinha, riscado e "depois do título" do card. Só fica editável o que o
 * layout atual desenha; o resto fica desligado, com o motivo escrito, para
 * ninguém digitar um texto que não sai no card nem no arquivo.
 */
export function SignatureTextFields({ slide, creativePreset = 'livre', itemLabel = 'card', updateSlide }) {
  const support = signatureTextSupport(slide, { creativePreset });
  const notice = signatureFieldsNotice(support, itemLabel);
  const offReason = `O layout atual deste ${itemLabel} não mostra este texto`;
  const field = (enabled) => ({
    className: 'vc-input',
    disabled: !enabled,
    title: enabled ? undefined : offReason,
    style: { fontSize: 12, ...(enabled ? null : { opacity: 0.55, cursor: 'not-allowed' }) },
  });
  return (
    <>
      <div>
        <label className="vc-label-sm">Sobrelinha (acima do título)</label>
        <input
          value={slide.eyebrowText ?? ''}
          onChange={e=>updateSlide({ eyebrowText: e.target.value })}
          placeholder="Sua categoria"
          {...field(support.eyebrow)}
        />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div>
          <label className="vc-label-sm">Riscado</label>
          <input
            value={slide.strikethroughText ?? ''}
            onChange={e=>updateSlide({ strikethroughText: e.target.value })}
            placeholder="De R$00"
            {...field(support.strike !== 'none')}
          />
        </div>
        <div>
          <label className="vc-label-sm">Depois do título</label>
          <input
            value={slide.afterTitleText ?? ''}
            onChange={e=>updateSlide({ afterTitleText: e.target.value })}
            placeholder="por R$00"
            {...field(support.offer)}
          />
        </div>
      </div>
      {notice ? (
        <div data-vc-signature-notice="" style={{ fontSize: 11, lineHeight: 1.45, color: 'var(--text-muted)' }}>
          {notice}
        </div>
      ) : null}
    </>
  );
}
