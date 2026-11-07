import React from 'react';
import { resolveSlideBrandBg } from '../../utils/brand-helpers.js';
import { sanitizeCustomVisualPresetBrand } from '../../utils/custom-visual-presets.js';
import { brandForFormatDisplay, slideForFormatDisplay } from '../../utils/format-view.js';

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

/**
 * Modelo compartilhado pela faixa do editor e pela Biblioteca.
 *
 * A miniatura antiga da Biblioteca desenhava apenas a cor/foto e o contador;
 * projetos de fundo claro pareciam cartões vazios. Manter este modelo puro
 * também faz a faixa responder imediatamente a undo/redo: o desenho depende
 * somente do slide atual, sem cache ou estado visual próprio.
 */
export function cardThumbnailModel(slide = {}, brand = {}, index = 0) {
  const effectiveBrand = slide?.visualBrand
    ? { ...brand, ...sanitizeCustomVisualPresetBrand(slide.visualBrand) }
    : brand;
  const photo = typeof slide?.bgImage === 'string' && slide.bgImage.trim()
    ? slide.bgImage
    : '';
  const title = slide?.bgImageFailed
    ? 'Imagem pendente'
    : cleanText(slide?.title)
      || cleanText(slide?.subtitle)
      || cleanText(slide?.bodyAfterImage)
      || 'Sem título';
  const background = resolveSlideBrandBg(effectiveBrand, index, slide) || '#fafafc';
  const titleColor = photo
    ? '#fff'
    : (slide?.titleColor || effectiveBrand?.titleColor || effectiveBrand?.textColor || '#111111');

  return {
    background,
    photo,
    title,
    titleColor,
    objectFit: slide?.bgFit === 'contain' ? 'contain' : 'cover',
    objectPosition: `${slide?.bgX ?? 50}% ${slide?.bgY ?? 50}%`,
    transform: `scale(${Math.max(0.5, (slide?.bgZoom ?? 100) / 100)}) scaleX(${slide?.bgMirror ? -1 : 1})`,
  };
}

/** Resolve a capa exatamente na proporção que o projeto guardou. */
export function projectThumbnailView(doc = {}) {
  const slides = Array.isArray(doc?.slides) ? doc.slides : [];
  const first = slides[0] || {};
  const fmt = doc?.fmt || 'carrossel';
  return {
    slide:slideForFormatDisplay(first, fmt, doc?.formatViews, doc?.creativePreset) || first,
    brand:brandForFormatDisplay(doc?.brand || {}, fmt, doc?.formatViews, doc?.creativePreset) || doc?.brand || {},
  };
}

/** Miniatura leve e legível do primeiro card/slide, sem duplicar o canvas. */
export default function CardThumbnail({
  slide = {},
  brand = {},
  index = 0,
  count,
  width,
  height,
  isPresentation = false,
  imageFilter,
  style,
}) {
  const model = cardThumbnailModel(slide, brand, index);
  return (
    <div
      data-vc-card-thumbnail="true"
      data-vc-slide-id={slide?.id || undefined}
      style={{
        width,
        height,
        borderRadius: 4,
        overflow: 'hidden',
        position: 'relative',
        isolation: 'isolate',
        background: model.background,
        ...style,
      }}
    >
      {model.photo ? (
        <div
          data-vc-thumbnail-photo="true"
          style={{ position:'absolute', inset:0, overflow:'hidden', zIndex:0 }}
        >
          <img
            src={model.photo}
            alt=""
            loading="eager"
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
            style={{
              position:'absolute', inset:0, width:'100%', height:'100%',
              objectFit:model.objectFit,
              objectPosition:model.objectPosition,
              transform:model.transform,
              ...(imageFilter ? { filter:imageFilter } : {}),
            }}
          />
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.28)' }}/>
        </div>
      ) : null}
      <span
        data-vc-thumbnail-title="true"
        style={{
          position:'absolute', zIndex:2, left:5, right:5, top:'50%',
          transform:'translateY(-50%)',
          fontSize:isPresentation ? 5.5 : 5,
          lineHeight:1.14,
          fontWeight:700,
          color:model.titleColor,
          textShadow:model.photo ? '0 1px 3px rgba(0,0,0,0.9)' : 'none',
          overflow:'hidden', display:'-webkit-box',
          WebkitLineClamp:isPresentation ? 2 : 3,
          WebkitBoxOrient:'vertical', textAlign:'left', overflowWrap:'anywhere',
        }}
      >
        {model.title}
      </span>
      <span style={{
        position:'absolute', zIndex:2, bottom:3, left:4,
        fontSize:7, fontWeight:700,
        color:model.photo ? 'rgba(255,255,255,0.82)' : model.titleColor,
        opacity:0.72, fontFamily:'var(--font-mono)', letterSpacing:'0.04em',
      }}>
        {String(count ?? (index + 1)).padStart(2, '0')}
      </span>
    </div>
  );
}
