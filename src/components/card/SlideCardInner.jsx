// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, Video, User } from 'lucide-react';
import { getVideoUrl } from '../../utils/video-store.js';
import AutoFitText from '../AutoFitText.jsx';
import { hydrateBrandTextColors, effectiveTitleFontFamily } from '../../utils/brand-helpers.js';
import { SectionLabel as S } from '../ui/SectionLabel.jsx';
import { resolveSlideBrandBg } from '../../utils/brand-helpers.js';
import { FORMATS } from '../../utils/formats.js';
import { AUTOFIT_MIN_SCALE, DARK_CREAM, getComposition } from '../../utils/slide-design-system.js';
import { normalizePresentationImgAdjust, buildPresentationImageFilter, presentationAdjustIsNeutral } from './FullscreenViewer.jsx';
import { pctBox, CanvasZonesOverlay } from './CanvasZonesOverlay.jsx';
import { VcBgPatternLayer, CultureInlineRich, CultureRichParagraphs, OverflowScaler } from './render-primitives.jsx';
import { vcHexToRgb, vcNormalizeHex, vcRelLuminance01, cultureReadableInks } from '../../utils/brand-visuals.js';
import { resolvePresetText, PLACEHOLDER_HANDLE } from '../../utils/preset-tokens.js';
import { elementOffsetStyle, hasElementOffset, getElementOffset, clampPct0a100 } from '../../utils/card-elements.js';
import { useElementDrag } from './useElementDrag.js';
import { slideHasPendingPhotoIntent, inferCanvasDefaults, sandwichPhotoZoneImgStyle } from '../../utils/canvas-zones.js';
import { DEFAULT_SLIDE_TEXT_INSET, SANDWICH_PHOTO_ZONE_MIN_H_PCT, clampRect, DEFAULT_CANVAS_ZONES_CLASSIC, CANVAS_AUTO_EDGE_PCT } from '../../utils/canvas-layout.js';

/**
 * Nos slides Cultura/Tendência, a superfície «dark» alternada usava sempre #272729, ignorando
 * paletas tipo Coral/Carbon onde `brand.bg` já é escuro. Se o utilizador define fundo escuro na marca,
 * essa cor passa ao card em modo «dark». Fundos claros mantêm uma telha fixa institucional.
 */
function cultureDarkBackdropFromBrand(brandBg) {
  const fb = vcNormalizeHex('#272729');
  const n = vcNormalizeHex(brandBg || fb || '#272729');
  const rgb = n ? vcHexToRgb(n) : null;
  if (!rgb) return fb || '#272729';
  const L = vcRelLuminance01(rgb);
  if (L <= 0.2) return n;
  const tile = vcHexToRgb('#272729');
  if (!tile) return fb || '#272729';
  const out = ['r', 'g', 'b'].map((k) => Math.round(rgb[k] * 0.32 + tile[k] * 0.68));
  return `#${out.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/** Face CSS única por perfil de marca pro corpo de texto (evita colisão entre perfis e Google Fonts). */
const vcCustomBodyFace = (brandId) => `VCBrandBody-${brandId || 'default'}`;

function effectiveBodyFontFamily(brand) {
  if (!brand) return '"Inter Tight", sans-serif';
  return brand.customBodyFont?.dataUrl
    ? `${vcCustomBodyFace(brand.id)}, ${brand.bodyFont}`
    : brand.bodyFont;
}

const LAYOUT_POS_LAB_ROWS = [
  ['SUP.', 'ESQ.'], ['SUP.', 'CENTRO'], ['SUP.', 'DIR.'],
  ['MEIO', 'ESQ.'], ['MEIO', 'CENTRO'], ['MEIO', 'DIR.'],
  ['INF.', 'ESQ.'], ['INF.', 'CENTRO'], ['INF.', 'DIR.'],
];

const LAYOUTS = [
  { id:'tl', jc:'flex-start', ai:'flex-start', label:'↖', posLab: LAYOUT_POS_LAB_ROWS[0] },
  { id:'tc', jc:'flex-start', ai:'center',     label:'↑', posLab: LAYOUT_POS_LAB_ROWS[1] },
  { id:'tr', jc:'flex-start', ai:'flex-end',   label:'↗', posLab: LAYOUT_POS_LAB_ROWS[2] },
  { id:'ml', jc:'center',     ai:'flex-start', label:'←', posLab: LAYOUT_POS_LAB_ROWS[3] },
  { id:'mc', jc:'center',     ai:'center',     label:'⊕', posLab: LAYOUT_POS_LAB_ROWS[4] },
  { id:'mr', jc:'center',     ai:'flex-end',   label:'→', posLab: LAYOUT_POS_LAB_ROWS[5] },
  { id:'bl', jc:'flex-end',   ai:'flex-start', label:'↙', posLab: LAYOUT_POS_LAB_ROWS[6] },
  { id:'bc', jc:'flex-end',   ai:'center',     label:'↓', posLab: LAYOUT_POS_LAB_ROWS[7] },
  { id:'br', jc:'flex-end',   ai:'flex-end',   label:'↘', posLab: LAYOUT_POS_LAB_ROWS[8] },
];
/** Fallback de layout quando o slide tem id inválido / legacy — middle-center é o mais neutro. */
const DEFAULT_LAYOUT = LAYOUTS.find(l => l.id === 'mc') || LAYOUTS[4];

/** Região da foto no layout clássico (sem canvas / sem sanduíche cultura). */
const PHOTO_REGION_IDS = new Set(['full', 'inset_h_top', 'inset_h_middle', 'inset_h_bottom', 'inset_h_narrow_mid']);

function normalizePhotoRegion(slide) {
  const r = slide?.photoRegion ?? 'full';
  return PHOTO_REGION_IDS.has(r) ? r : 'full';
}

/** Cobre a zona foto: toque direto no `<input>` (WebKit/iOS). Opacidade > 0 — alguns motores ignoram camada totalmente invisível. */
const VC_PHOTO_ZONE_HIT_LAYER_STYLE = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  margin: 0,
  padding: 0,
  border: 'none',
  opacity: 0.03,
  cursor: 'pointer',
  fontSize: 28,
  zIndex: 4,
  display: 'block',
  boxSizing: 'border-box',
};

/** Migra modos antigos e `web_trend` (desativado na UI) → GPT Image. */
const normalizeSlideImgMode = (m) => {
  void m;
  return 'dalle';
};

/** Filtro CSS dos ajustes gravados (`presentationImgAdjust`), ou undefined se neutro ou sem imagem. */
function slideStoredPresentationCssFilter(slide) {
  if (!slide?.bgImage) return undefined;
  const n = normalizePresentationImgAdjust(slide.presentationImgAdjust);
  if (presentationAdjustIsNeutral(n)) return undefined;
  return buildPresentationImageFilter(n);
}

function cultureResolveSurface(slide, num) {
  const t = (slide.cultureTone || '').trim();
  if (t === 'light' || t === 'dark' || t === 'accent') return t;
  return num % 2 === 0 ? 'light' : 'dark';
}

/** Quebra de linha segura em zonas estreitas (mobile / canvas).
 *
 *  NÃO hifenizar e NÃO quebrar palavra em ponto arbitrário: título de carrossel
 *  é a peça mais visível do produto e "VOCÊ ESTÁ FA-ZENDO ERRADO" destrói a
 *  credibilidade da peça. `overflowWrap: break-word` ainda protege do estouro —
 *  só quebra quando a palavra sozinha não cabe na linha — e o auto-fit reduz a
 *  fonte antes disso. */
const VC_TEXT_ZONE_STYLE = {
  wordBreak: 'normal',
  overflowWrap: 'break-word',
  hyphens: 'manual',
  boxSizing: 'border-box',
};

/**
 * Deslocamento visual para o "overshoot" das fontes display.
 *
 * Archivo Black, Anton e Big Shoulders desenham glyphs mais altos que a caixa de
 * linha; `getBoundingClientRect` mede a caixa, não a tinta. Com o leading apertado
 * dos presets (~1.0, que é o que dá o visual denso) a primeira linha sangra acima
 * do line box e a zona `overflow:hidden` corta o topo das letras.
 *
 * A correção é `position:relative; top:N` — desloca a TINTA para dentro da zona
 * sem mudar a altura de layout do bloco. Padding no bloco não serve: em layouts
 * `flex-end` (bl/bc/br) engordar o bloco empurra o topo para cima e piora o corte.
 * Há folga na base (medida: ~12px) para absorver o deslocamento.
 */
function vcTitleOvershootShift(fontSizePx, leadingPct) {
  const lh = (leadingPct ?? 105) / 100;
  if (lh >= 1.15) return 0;
  return Math.round(fontSizePx * 0.17);
}

/**
 * Faixa do rodapé ocupada pelos ornamentos de preset — pill de CTA/hashtag e
 * footer bar de 3 colunas.
 *
 * Os dois são `position:absolute` com `zIndex:25`, então não empurram nada: o
 * bloco de texto (que em bl/bc/br é `justify-content:flex-end`) encosta a base
 * do título no padding e passa por baixo do ornamento. Aqui devolvemos a altura
 * em px que o padding inferior precisa reservar, já com respiro.
 */
function vcFooterOrnamentReservePx(brand, f) {
  let reserva = 0;
  if (String(brand.footerPillText || '').trim()) {
    const alturaPill = f.h * 0.024 + f.w * 0.026 * 1.25;
    reserva = Math.max(reserva, f.h * 0.058 + alturaPill);
  }
  const colunas = [brand.footerBarLeft, brand.footerBarCenter, brand.footerBarRight];
  if (colunas.some((c) => String(c || '').trim())) {
    // `label|valor` renderiza duas linhas; só label, uma.
    const temValor = colunas.some((c) => String(c || '').includes('|'));
    const alturaBar = f.w * 0.020 * 1.3 + (temValor ? f.h * 0.004 + f.w * 0.022 * 1.3 : 0);
    reserva = Math.max(reserva, f.h * 0.038 + alturaBar);
  }
  return reserva > 0 ? reserva + f.h * 0.018 : 0;
}

/** Reforço de padding lateral em zonas texto canvas — tracking negativo + fontes grandes “comem” a margem antes do padding nominal. */
function canvasClassicTitlePaddingXPx(f, slide) {
  const insetZn = slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
  const base = f.w * (0.012 + insetZn * 0.004);
  const gutter = (f.w * CANVAS_AUTO_EDGE_PCT) / 100 * 0.34;
  const lsEm = ((-3 + (slide.titleTracking ?? 0)) / 100);
  const fsPx = f.w * 0.084 * ((slide.titleSize ?? 100) / 100);
  const bleed = lsEm < 0 ? (-lsEm) * fsPx * 1.75 : fsPx * 0.048;
  return Math.max(base, gutter + base * 0.12, base + bleed, f.w * 0.024);
}

function canvasClassicSubtitlePaddingXPx(f, slide) {
  const insetZn = slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
  const base = f.w * (0.012 + insetZn * 0.004);
  const gutter = (f.w * CANVAS_AUTO_EDGE_PCT) / 100 * 0.3;
  const lsEm = ((-1 + (slide.subTracking ?? 0)) / 100);
  const fsPx = f.w * 0.028 * ((slide.subSize ?? 100) / 100);
  const bleed = lsEm < 0 ? (-lsEm) * fsPx * 1.6 : fsPx * 0.058;
  return Math.max(base, gutter + base * 0.1, base + bleed, f.w * 0.021);
}

function canvasCultureSandwichPaddingXPx(f, slide) {
  const insetZn = slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
  const base = f.w * (0.012 + insetZn * 0.004);
  const tLs = ((-2.4 + (slide.titleTracking ?? 0)) / 100);
  const tFs = f.w * 0.036 * ((slide.titleSize ?? 100) / 100);
  const sLs = ((-1 + (slide.subTracking ?? 0)) / 100);
  const sFs = f.w * 0.031 * ((slide.subSize ?? 100) / 100);
  const bT = tLs < 0 ? (-tLs) * tFs * 1.55 + tFs * 0.05 : tFs * 0.048;
  const bS = sLs < 0 ? (-sLs) * sFs * 1.35 + sFs * 0.052 : sFs * 0.048;
  return Math.max(base, (f.w * CANVAS_AUTO_EDGE_PCT) / 100 * 0.32, base + Math.max(bT, bS * 0.75), f.w * 0.022);
}

function canvasCultureSandwichBottomPaddingXPx(f, slide) {
  const insetZn = slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
  const base = f.w * (0.012 + insetZn * 0.004);
  const ls = ((-1 + (slide.subTracking ?? 0)) / 100);
  const fsPx = f.w * 0.029 * (((slide.bodyAfterSize ?? slide.subSize) ?? 100) / 100);
  const bleed = ls < 0 ? (-ls) * fsPx * 1.45 : fsPx * 0.055;
  return Math.max(base, (f.w * CANVAS_AUTO_EDGE_PCT) / 100 * 0.28, base + bleed, f.w * 0.021);
}

/** Layout canvas (variant classic): zonas foto + título + subtítulo em %. */
const ClassicCanvasInner = React.forwardRef(({
  f,
  slide,
  brand,
  bg,
  titleFF,
  bodyFF,
  isBebas,
  culture,
  cultureAccentCol,
  cultureCoverOnly,
  showCultureIdx,
  num,
  total,
  hideInstaBadge,
  /** Cor do campo título (1.º / último vs meio já resolvida no pai). */
  titleInk,
  /** Corpo: subtítulo «texto», parágrafos, etc. */
  bodyInk,
  imgModeNorm,
  effectivePresentationFilter,
  bgFit,
  bgPos,
  bgScale,
  imgReady,
  imgErr,
  imgLoading,
  showCanvasChrome,
  onCanvasPatch,
  onPhotoZoneClick,
  onPhotoZoneFileChange = null,
  swapSlideIdx = null,
  swapZoneKeys,
  interactionScale = 1,
  /** Arrasto livre; vem do SlideCardInner. Ausente quando o chrome de zonas
   *  esta ligado — aí quem posiciona e o overlay de zonas. */
  mov = null,
}, ref) => {
  const movOu = React.useCallback(
    (chave, estilo) => (mov ? mov(chave, estilo) : { style: estilo }),
    [mov],
  );
  const zcv = slide.canvas.zones;
  const Lzn = LAYOUTS.find((l) => l.id === slide.layout) || DEFAULT_LAYOUT;
  const insetZn = slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
  const padTitleXp = canvasClassicTitlePaddingXPx(f, slide);
  const padSubtitleXp = canvasClassicSubtitlePaddingXPx(f, slide);
  const padYZn = f.h * (0.006 + insetZn * 0.002);
  const pr = clampRect(zcv.photo || DEFAULT_CANVAS_ZONES_CLASSIC.photo);
  const tr = clampRect(zcv.title || DEFAULT_CANVAS_ZONES_CLASSIC.title);
  const sr = clampRect(zcv.subtitle || DEFAULT_CANVAS_ZONES_CLASSIC.subtitle);
  const shadow = slide.textShadow !== false
    ? '0 2px 24px rgba(0,0,0,0.85), 0 1px 6px rgba(0,0,0,0.95)'
    : 'none';
  const textBgColor = slide.textBg
    ? `rgba(0,0,0,${(slide.textBgOpacity ?? 55) / 100 * 0.75})`
    : 'transparent';
  const alignInner =
    slide.align === 'center' ? 'center' :
    slide.align === 'right' ? 'flex-end' :
    slide.align === 'justify' ? 'stretch' : 'flex-start';
  const pendingPhotoZone = slideHasPendingPhotoIntent(slide) && !slide.bgImage;
  const photoZoneInteractive = !!(onPhotoZoneClick && (showCanvasChrome || pendingPhotoZone));
  const photoZoneNativeHit = !!(photoZoneInteractive && onPhotoZoneFileChange);
  const photoZoneBoxStyle = { ...pctBox(pr, f), zIndex: 2, overflow: 'hidden', position: 'relative' };
  const photoZoneChildren = (
    <>
        {slide.bgImage && imgReady && !imgErr && (
          <div style={{ position:'absolute', inset:0, overflow:'hidden' }}>
            <div style={{
              position:'absolute', inset:0,
              backgroundImage:`url(${slide.bgImage})`,
              backgroundPosition:bgPos,
              backgroundRepeat:'no-repeat',
              opacity:slide.bgOpacity/100,
              ...(bgFit === 'custom'
                ? {
                    backgroundSize:`${slide.bgZoom}%`,
                    transform: slide.bgMirror ? 'scaleX(-1)' : 'none',
                  }
                : {
                    backgroundSize: bgFit === 'contain' ? 'contain' : 'cover',
                    transform: `${slide.bgMirror ? 'scaleX(-1) ' : ''}scale(${bgScale})`,
                    transformOrigin: bgPos,
                  }),
              ...(effectivePresentationFilter ? { filter: effectivePresentationFilter } : {}),
            }}/>
          </div>
        )}
        {slide.bgImage && imgReady && !imgErr && slide.overlay > 0 && (
          <div style={{
            position:'absolute', inset:0, pointerEvents:'none',
            background: cultureCoverOnly
              ? `linear-gradient(to top, rgba(0,0,0,${Math.min(0.92, slide.overlay/100 * 1.05)}) 0%, rgba(0,0,0,${slide.overlay/100*0.35}) 45%, transparent 72%)`
              : `linear-gradient(175deg, rgba(0,0,0,${slide.overlay/100*0.4}) 0%, rgba(0,0,0,${slide.overlay/100}) 100%)`,
          }}/>
        )}
        <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 2 }} />
        {imgLoading && (
          <div style={{
            position:'absolute', inset:0, zIndex:5,
            background:'rgba(10,9,8,0.92)',
            display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:f.h*0.018,
          }}>
            <div style={{
              width:f.w*0.07, height:f.w*0.07,
              borderRadius:'50%',
              border:`${f.w*0.006}px solid rgba(255,255,255,0.1)`,
              borderTopColor:'var(--accent)',
              animation:'spin 0.9s linear infinite',
            }}/>
            <span style={{ color:'rgba(255,255,255,0.55)', fontSize:f.w*0.026, fontWeight:600, letterSpacing:'-0.011em' }}>
              {imgModeNorm === 'dalle' ? 'Gerando com GPT Image 2…' : 'Carregando…'}
            </span>
          </div>
        )}
        {(showCanvasChrome || pendingPhotoZone) && !slide.bgImage && (
          <div style={{
            position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            color:'rgba(255,255,255,0.45)', fontSize:f.w*0.026, fontWeight:600, textAlign:'center', padding:f.w*0.06,
          }}>
            {pendingPhotoZone ? 'Toque para inserir foto' : 'Clique para inserir foto'}
          </div>
        )}
    </>
  );

  return (
    <div
      ref={ref}
      style={{ width:f.w, height:f.h, background:bg, position:'relative', overflow:'hidden', fontFamily: bodyFF }}
    >
      <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 1 }} />
      <div
        {...movOu('photo', photoZoneBoxStyle)}
        onClick={photoZoneInteractive && !photoZoneNativeHit ? (e) => { e.stopPropagation(); onPhotoZoneClick(); } : undefined}
        role={photoZoneInteractive && !photoZoneNativeHit ? 'button' : undefined}
      >
        {photoZoneChildren}
        {photoZoneNativeHit ? (
          <input
            type="file"
            accept="image/*"
            onChange={onPhotoZoneFileChange}
            onTouchStart={(e) => e.stopPropagation()}
            style={VC_PHOTO_ZONE_HIT_LAYER_STYLE}
            aria-label="Importar imagem na zona da foto"
          />
        ) : null}
      </div>

      <OverflowScaler
        containerProps={movOu('title')}
        containerStyle={{
          ...pctBox(tr, f),
          ...VC_TEXT_ZONE_STYLE,
          zIndex: 4,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: Lzn.jc,
          alignItems: Lzn.ai,
          textAlign: slide.align,
          background: textBgColor,
          backdropFilter: slide.textBg ? 'blur(8px)' : 'none',
          borderRadius: slide.textBg ? f.w * 0.022 : 0,
          padding: slide.textBg ? `${f.h * 0.018}px ${f.w * 0.03}px` : `${padYZn}px ${padTitleXp}px`,
        }}
        deps={[slide.title, slide.titleSize, tr.w, tr.h, f.w, f.h, slide.titleLeading]}
        minScale={0.45}
      >
        {(titleScale) => (
        <div
          style={{
            width: '100%',
            minWidth: 0,
            alignSelf: 'stretch',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: alignInner,
          }}
        >
        <h1 style={{
          color: titleInk,
          fontFamily: titleFF,
          fontSize: f.w * 0.084 * (slide.titleSize / 100) * titleScale,
          lineHeight: (slide.titleLeading ?? 105) / 100,
          position: 'relative',
          top: vcTitleOvershootShift(f.w * 0.084 * (slide.titleSize / 100) * titleScale, slide.titleLeading),
          fontWeight: slide.titleWeight ?? 800,
          letterSpacing: `${(-3 + (slide.titleTracking ?? 0)) / 100}em`,
          margin: 0,
          overflowWrap: 'break-word',
          wordBreak: 'normal',
          maxWidth: '100%',
          width: '100%',
          boxSizing: 'border-box',
          textTransform:
            slide.titleCase === 'upper' ? 'uppercase' :
            slide.titleCase === 'lower' ? 'lowercase' :
            isBebas ? 'uppercase' : 'none',
          textShadow: shadow,
        }}>{culture ? (
          <CultureInlineRich
            text={slide.title || ''}
            destaqueSpans={slide.destaqueSpans?.title}
            baseColor={titleInk}
            accentColor={cultureAccentCol}
            fontFamily={titleFF}
            fontSize={f.w * 0.084 * (slide.titleSize / 100) * titleScale}
            lineHeight={(slide.titleLeading ?? 105) / 100}
            fontWeight={slide.titleWeight ?? 800}
            letterSpacing={`${(-3 + (slide.titleTracking ?? 0)) / 100}em`}
          />
        ) : slide.title}</h1>
        </div>
        )}
      </OverflowScaler>

      <OverflowScaler
        containerProps={movOu('subtitle')}
        containerStyle={{
          ...pctBox(sr, f),
          ...VC_TEXT_ZONE_STYLE,
          zIndex: 4,
          overflow: 'hidden',
          background: textBgColor,
          backdropFilter: slide.textBg ? 'blur(8px)' : 'none',
          borderRadius: slide.textBg ? f.w * 0.022 : 0,
          padding: slide.textBg ? `${f.h * 0.018}px ${f.w * 0.03}px` : `${padYZn}px ${padSubtitleXp}px`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: Lzn.jc,
          alignItems: Lzn.ai,
          textAlign: slide.align,
        }}
        deps={[slide.subtitle, slide.subSize, sr.w, sr.h, f.w, f.h, slide.subLeading]}
        minScale={0.78}
      >
        {(subScale) => (
        <div
          style={{
            width: '100%',
            minWidth: 0,
            alignSelf: 'stretch',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: alignInner,
          }}
        >
        {slide.subtitle && brand.subtitleVisible !== false && (
          culture ? (
            <div style={{ letterSpacing: `${(-1 + (slide.subTracking ?? 0)) / 100}em`, textShadow: shadow, width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
              <CultureRichParagraphs
                text={slide.subtitle}
                destaqueSpans={slide.destaqueSpans?.subtitle}
                ink={bodyInk}
                accentColor={cultureAccentCol}
                fontFamily={bodyFF}
                fontSize={f.w * 0.028 * (slide.subSize / 100) * subScale}
                lineHeight={(slide.subLeading ?? 150) / 100}
                fontWeight={400}
                letterSpacing={`${(-1 + (slide.subTracking ?? 0)) / 100}em`}
                paraGap={f.h * 0.010 * subScale}
              />
            </div>
          ) : (
            <p style={{
              color: bodyInk,
              fontFamily: bodyFF,
              fontSize: f.w * 0.028 * (slide.subSize / 100) * subScale,
              lineHeight: (slide.subLeading ?? 150) / 100,
              fontWeight: 400,
              margin: 0,
              overflowWrap: 'break-word',
              wordBreak: 'normal',
              maxWidth: '100%',
              width: '100%',
              boxSizing: 'border-box',
              letterSpacing: `${(-1 + (slide.subTracking ?? 0)) / 100}em`,
              textShadow: shadow,
            }}>{slide.subtitle}</p>
          )
        )}
        </div>
        )}
      </OverflowScaler>

      {culture && (() => {
        const hasHdr = !!(brand.cultureHeaderLeft || '').trim() || !!(brand.cultureHeaderYear || '').trim();
        const onPhoto = !!(slide.bgImage && imgReady && !imgErr);
        const barMuted = onPhoto ? 'rgba(255,255,255,0.62)' : 'rgba(29,29,31,0.45)';
        return (
          <>
            {hasHdr && (
              <div style={{
                position:'absolute', top:f.h*0.028, left:f.w*0.05, right:f.w*0.16, zIndex:24,
                display:'flex', justifyContent:'space-between', alignItems:'center', gap:f.w*0.02,
              }}>
                <span style={{
                  fontSize:f.w*0.022, color:barMuted, fontFamily:bodyFF, fontWeight:400, letterSpacing:'-0.011em',
                  maxWidth:'34%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                }}>{(brand.cultureHeaderLeft || '').trim()}</span>
                <span style={{
                  flex:1, textAlign:'center', fontSize:f.w*0.022, color:barMuted, fontFamily:bodyFF, fontWeight:600,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                }}>{brand.handle}</span>
                <span style={{ fontSize:f.w*0.022, color:barMuted, fontFamily:bodyFF }}>
                  {(brand.cultureHeaderYear || '').trim()}{(brand.cultureHeaderYear || '').trim() ? ' //' : ''}
                </span>
              </div>
            )}
            {showCultureIdx && (
              <div style={{
                position:'absolute', top:f.h*0.032, right:f.w*0.05, zIndex:26,
                background: onPhoto ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.07)',
                color: onPhoto ? '#fff' : '#1d1d1f',
                padding:`${f.h*0.006}px ${f.w*0.022}px`, borderRadius:999,
                fontSize:f.w*0.026, fontWeight:600, fontFamily:bodyFF, letterSpacing:'-0.02em',
              }}>{num}/{total}</div>
            )}
          </>
        );
      })()}

      {brand.showHandle && slide.showHandle && !hideInstaBadge && (
        <div style={{
          ...vcHandleBadgeBoxPositionStyle(brand),
          display:'flex', alignItems:'center', gap:f.w*0.012,
          background:'rgba(255,255,255,0.08)',
          backdropFilter:'blur(12px)',
          padding:`${f.h*0.01}px ${f.w*0.022}px`,
          borderRadius:999,
          border:'1px solid rgba(255,255,255,0.12)',
        }}>
          <div style={{
            width:f.w*0.034, height:f.w*0.034, borderRadius:'50%',
            background:'conic-gradient(from 45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
            display:'flex', alignItems:'center', justifyContent:'center',
            flexShrink: 0,
          }}>
            <div style={{
              width:'76%', height:'76%', borderRadius:'50%',
              overflow:'hidden',
              background: brand.handleAvatar ? '#0a0a0a' : bg,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {brand.handleAvatar ? (
                <img
                  src={brand.handleAvatar}
                  alt=""
                  draggable={false}
                  style={vcHandleAvatarImgStyle(brand)}
                />
              ) : (
                <VcHandleAvatarFallback f={f} bg={bg} />
              )}
            </div>
          </div>
          <span style={{ color:brand.titleColor, fontSize:f.w*0.022, fontWeight:600, fontFamily: bodyFF, letterSpacing:'-0.01em' }}>
            {vcHandleLabel(brand)}
          </span>
        </div>
      )}

      {brand.logo && (() => {
        const handleAtTop = brand.showHandle;
        const pos = brand.logoPosition || 'tr';
        const margin = f.w * 0.045;
        const sizePx = (brand.logoSize ?? 30) * (f.w / 1080);
        const topOffset = handleAtTop && pos.startsWith('t') && pos.endsWith('r') ? margin + f.h * 0.05 : margin;
        const style = {
          position:'absolute',
          width: sizePx, height: sizePx,
          opacity: (brand.logoOpacity ?? 90) / 100,
          backgroundImage: `url(${brand.logo})`,
          backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
          zIndex: 23,
        };
        if (pos === 'tl') Object.assign(style, { top: margin,    left: margin });
        if (pos === 'tr') Object.assign(style, { top: topOffset, right: margin });
        if (pos === 'bl') Object.assign(style, { bottom: margin, left: margin });
        if (pos === 'br') Object.assign(style, { bottom: margin, right: margin });
        return <div style={style} aria-hidden/>;
      })()}

      {showCanvasChrome && onCanvasPatch && (
        <CanvasZonesOverlay
          f={f}
          zones={slide.canvas.zones}
          keys={['photo', 'title', 'subtitle']}
          onPatch={onCanvasPatch}
          swapSlideIdx={swapSlideIdx}
          swapZoneKeys={swapZoneKeys}
          photoZoneTap={onPhotoZoneFileChange ? null : (onPhotoZoneClick || null)}
          photoZoneFileChange={onPhotoZoneFileChange}
          interactionScale={interactionScale}
        />
      )}
    </div>
  );
});

/** Clássico: foto em faixa horizontal com margens (sem canvas / sem sanduíche cultura no card). */
const ClassicLegadoInsetPhotoColumn = React.forwardRef(({
  f,
  slide,
  brand,
  bg,
  L,
  isBebas,
  titleFF,
  bodyFF,
  displayTitleInk,
  displayBodyInk,
  cultureRichText,
  cultureAccentCol,
  sandwichSkin,
  showCultureIdx,
  num,
  total,
  hideInstaBadge,
  imgReady,
  imgErr,
  imgLoading,
  imgModeNorm,
  effectivePresentationFilter,
  bgFit,
  bgPos,
  bgScale,
  photoRegionId,
  onPhotoZoneClick,
  showCanvasChrome,
  /** `(chave, estiloBase) => props` do arrasto livre; vem do SlideCardInner. */
  mov = null,
}, ref) => {
  const movOu = React.useCallback(
    (chave, estilo) => (mov ? mov(chave, estilo) : { style: estilo }),
    [mov],
  );
  const pr = photoRegionId;
  const bandFrac = pr === 'inset_h_narrow_mid' ? 0.28 : 0.36;
  const sideM = f.w * 0.06;
  const rad = f.w * 0.022;
  const bandH = f.h * bandFrac;
  const inset = slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
  const padH = f.w * (0.04 + inset * 0.004);
  const shadow = slide.textShadow !== false
    ? '0 2px 24px rgba(0,0,0,0.85), 0 1px 6px rgba(0,0,0,0.95)'
    : 'none';
  const textBgColor = slide.textBg
    ? `rgba(0,0,0,${(slide.textBgOpacity ?? 55) / 100 * 0.75})`
    : 'transparent';
  const alignItemsBox =
    slide.align === 'center' ? 'center' :
    slide.align === 'right' ? 'flex-end' :
    slide.align === 'justify' ? 'stretch' : 'flex-start';

  const textGlass = (children) => (
    <div style={{
      background: textBgColor,
      backdropFilter: slide.textBg ? 'blur(8px)' : 'none',
      borderRadius: slide.textBg ? f.w * 0.025 : 0,
      padding: slide.textBg ? `${f.h * 0.022}px ${f.w * 0.04}px` : 0,
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: alignItemsBox,
      gap: f.h * 0.018,
      maxWidth: '100%',
    }}>{children}</div>
  );

  const titleEl = (
    <h1 style={{
      color: displayTitleInk, fontFamily: titleFF,
      fontSize: f.w * 0.084 * (slide.titleSize / 100),
      lineHeight: (slide.titleLeading ?? 105) / 100,
      position: 'relative',
      top: vcTitleOvershootShift(f.w * 0.084 * (slide.titleSize / 100), slide.titleLeading),
      fontWeight: slide.titleWeight ?? 800,
      letterSpacing: `${(-3 + (slide.titleTracking ?? 0)) / 100}em`,
      margin: 0,
      textTransform:
        slide.titleCase === 'upper' ? 'uppercase' :
        slide.titleCase === 'lower' ? 'lowercase' :
        isBebas ? 'uppercase' : 'none',
      textShadow: shadow,
    }}>{cultureRichText ? (
      <CultureInlineRich
        text={slide.title || ''}
        destaqueSpans={slide.destaqueSpans?.title}
        baseColor={displayTitleInk}
        accentColor={cultureAccentCol}
        fontFamily={titleFF}
        fontSize={f.w * 0.084 * (slide.titleSize / 100)}
        lineHeight={(slide.titleLeading ?? 105) / 100}
        fontWeight={slide.titleWeight ?? 800}
        letterSpacing={`${(-3 + (slide.titleTracking ?? 0)) / 100}em`}
      />
    ) : slide.title}</h1>
  );

  // `brand.subtitleVisible === false` é assinatura de preset (ex.: Sports
  // Editorial e Case Study Neon escondem o subtítulo para o título dominar).
  // Este caminho ignorava a flag, então o mesmo preset mostrava subtítulo fora
  // do modo composição e escondia dentro dele.
  const subtitleEl = slide.subtitle && brand.subtitleVisible !== false ? (
    cultureRichText ? (
      <div style={{
        margin: 0,
        maxWidth: '100%',
        letterSpacing: `${(-1 + (slide.subTracking ?? 0)) / 100}em`,
        textShadow: shadow,
      }}>
        <CultureRichParagraphs
          text={slide.subtitle}
          destaqueSpans={slide.destaqueSpans?.subtitle}
          ink={displayBodyInk}
          accentColor={cultureAccentCol}
          fontFamily={bodyFF}
          fontSize={f.w * 0.028 * (slide.subSize / 100)}
          lineHeight={(slide.subLeading ?? 150) / 100}
          fontWeight={400}
          letterSpacing={`${(-1 + (slide.subTracking ?? 0)) / 100}em`}
          paraGap={f.h * 0.010}
        />
      </div>
    ) : (
      <p style={{
        color: displayBodyInk, fontFamily: bodyFF,
        fontSize: f.w * 0.028 * (slide.subSize / 100),
        lineHeight: (slide.subLeading ?? 150) / 100,
        fontWeight: 400, margin: 0,
        letterSpacing: `${(-1 + (slide.subTracking ?? 0)) / 100}em`,
        textShadow: shadow,
      }}>{slide.subtitle}</p>
    )
  ) : null;

  const bothText = textGlass(<>{titleEl}{subtitleEl}</>);
  const titleOnlyWrapped = textGlass(<>{titleEl}</>);
  const subOnlyWrapped = textGlass(<>{subtitleEl}</>);

  const bandClickable = !!(onPhotoZoneClick && (showCanvasChrome || slideHasPendingPhotoIntent(slide)) && !slide.bgImage);

  const photoBand = (
    <div
      role={bandClickable ? 'button' : undefined}
      onClick={bandClickable ? (e) => { e.stopPropagation(); onPhotoZoneClick(); } : undefined}
      {...movOu('photo', {
        flex: '0 0 auto',
        height: bandH,
        marginLeft: sideM,
        marginRight: sideM,
        borderRadius: rad,
        overflow: 'hidden',
        position: 'relative',
        background: bg,
        zIndex: 2,
        boxShadow: 'var(--shadow-product)',
        cursor: bandClickable ? 'pointer' : undefined,
      })}
    >
      {slide.bgImage && imgReady && !imgErr ? (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${slide.bgImage})`,
            backgroundPosition: bgPos,
            backgroundRepeat: 'no-repeat',
            opacity: slide.bgOpacity / 100,
            ...(bgFit === 'custom'
              ? {
                  backgroundSize: `${slide.bgZoom}%`,
                  transform: slide.bgMirror ? 'scaleX(-1)' : 'none',
                }
              : {
                  backgroundSize: bgFit === 'contain' ? 'contain' : 'cover',
                  transform: `${slide.bgMirror ? 'scaleX(-1) ' : ''}scale(${bgScale})`,
                  transformOrigin: bgPos,
                }),
            ...(effectivePresentationFilter ? { filter: effectivePresentationFilter } : {}),
          }}/>
          {slide.overlay > 0 ? (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
              background: `linear-gradient(175deg, rgba(0,0,0,${slide.overlay / 100 * 0.35}) 0%, rgba(0,0,0,${slide.overlay / 100 * 0.88}) 100%)`,
            }}/>
          ) : null}
        </>
      ) : slideHasPendingPhotoIntent(slide) ? (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: f.w * 0.024, fontWeight: 600, textAlign: 'center', padding: f.w * 0.04,
        }}>Toque para inserir foto</div>
      ) : null}
    </div>
  );

  const textColBase = {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: L.jc,
    alignItems: L.ai,
    // Deslocado, quem recorta passa a ser a borda do card — senão arrastar o
    // texto para fora da coluna só o cortava.
    overflow: (hasElementOffset(slide, 'text') || hasElementOffset(slide, 'subtitle'))
      ? 'visible' : 'hidden',
    textAlign: slide.align,
    ...VC_TEXT_ZONE_STYLE,
  };

  let mainColumn = null;
  if (pr === 'inset_h_top') {
    mainColumn = (
      <>
        {photoBand}
        <div {...movOu('text', { ...textColBase, padding: `${f.h * 0.014}px ${padH}px ${f.h * 0.02}px`, gap: f.h * 0.01 })}>
          {bothText}
        </div>
      </>
    );
  } else if (pr === 'inset_h_bottom') {
    mainColumn = (
      <>
        <div {...movOu('text', { ...textColBase, padding: `${f.h * 0.04}px ${padH}px ${f.h * 0.012}px` })}>
          {bothText}
        </div>
        {photoBand}
      </>
    );
  } else {
    mainColumn = (
      <>
        <div {...movOu('text', {
          ...textColBase,
          flex: '1 1 0',
          justifyContent: 'center',
          padding: `${f.h * 0.02}px ${padH}px ${f.h * 0.01}px`,
        })}>
          {titleOnlyWrapped}
        </div>
        {photoBand}
        <div {...movOu('subtitle', {
          ...textColBase,
          flex: '1 1 0',
          justifyContent: 'center',
          padding: `${f.h * 0.01}px ${padH}px ${f.h * 0.02}px`,
        })}>
          {subOnlyWrapped}
        </div>
      </>
    );
  }

  return (
    <div
      ref={ref}
      style={{
        width: f.w,
        height: f.h,
        background: bg,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: bodyFF,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 1 }} />

      {imgLoading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5,
          background: 'rgba(10,9,8,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: f.h * 0.018,
        }}>
          <div style={{
            width: f.w * 0.07, height: f.w * 0.07,
            borderRadius: '50%',
            border: `${f.w * 0.006}px solid rgba(255,255,255,0.1)`,
            borderTopColor: 'var(--accent)',
            animation: 'spin 0.9s linear infinite',
          }}/>
          <span style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: f.w * 0.026,
            fontWeight: 600,
            letterSpacing: '-0.011em',
          }}>
            {imgModeNorm === 'dalle' ? 'Gerando com GPT Image 2…' : 'Carregando…'}
          </span>
          {imgModeNorm === 'dalle' && (
            <span style={{
              color: 'rgba(255,255,255,0.32)',
              fontSize: f.w * 0.02,
              letterSpacing: '-0.011em',
            }}>GPT Image 2 · OpenAI · ~30s por slide</span>
          )}
        </div>
      )}

      {sandwichSkin && (() => {
        const hasHdr = !!(brand.cultureHeaderLeft || '').trim() || !!(brand.cultureHeaderYear || '').trim();
        const onPhoto = !!(slide.bgImage && imgReady && !imgErr);
        const barMuted = onPhoto ? 'rgba(255,255,255,0.62)' : 'rgba(29,29,31,0.45)';
        return (
          <>
            {hasHdr && (
              <div style={{
                position: 'absolute', top: f.h * 0.028, left: f.w * 0.05, right: f.w * 0.16, zIndex: 24,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: f.w * 0.02,
              }}>
                <span style={{
                  fontSize: f.w * 0.022, color: barMuted, fontFamily: bodyFF, fontWeight: 400, letterSpacing: '-0.011em',
                  maxWidth: '34%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{(brand.cultureHeaderLeft || '').trim()}</span>
                <span style={{
                  flex: 1, textAlign: 'center', fontSize: f.w * 0.022, color: barMuted, fontFamily: bodyFF, fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{brand.handle}</span>
                <span style={{ fontSize: f.w * 0.022, color: barMuted, fontFamily: bodyFF }}>
                  {(brand.cultureHeaderYear || '').trim()}{(brand.cultureHeaderYear || '').trim() ? ' //' : ''}
                </span>
              </div>
            )}
            {showCultureIdx && (
              <div style={{
                position: 'absolute', top: f.h * 0.032, right: f.w * 0.05, zIndex: 26,
                background: onPhoto ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.07)',
                color: onPhoto ? '#fff' : '#1d1d1f',
                padding: `${f.h * 0.006}px ${f.w * 0.022}px`, borderRadius: 999,
                fontSize: f.w * 0.026, fontWeight: 600, fontFamily: bodyFF, letterSpacing: '-0.02em',
              }}>{num}/{total}</div>
            )}
          </>
        );
      })()}

      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 3,
        paddingTop: sandwichSkin ? f.h * 0.052 : f.h * 0.02,
        gap: f.h * 0.012,
      }}>
        {mainColumn}
      </div>

      {brand.showHandle && slide.showHandle && !hideInstaBadge && (
        <div style={{
          ...vcHandleBadgeBoxPositionStyle(brand),
          display: 'flex', alignItems: 'center', gap: f.w * 0.012,
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
          padding: `${f.h * 0.01}px ${f.w * 0.022}px`,
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.12)',
        }}>
          <div style={{
            width: f.w * 0.034, height: f.w * 0.034, borderRadius: '50%',
            background: 'conic-gradient(from 45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <div style={{
              width: '76%', height: '76%', borderRadius: '50%',
              overflow: 'hidden',
              background: brand.handleAvatar ? '#0a0a0a' : bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {brand.handleAvatar ? (
                <img
                  src={brand.handleAvatar}
                  alt=""
                  draggable={false}
                  style={vcHandleAvatarImgStyle(brand)}
                />
              ) : (
                <VcHandleAvatarFallback f={f} bg={bg} />
              )}
            </div>
          </div>
          <span style={{ color: brand.titleColor, fontSize: f.w * 0.022, fontWeight: 600, fontFamily: bodyFF, letterSpacing: '-0.01em' }}>
            {vcHandleLabel(brand)}
          </span>
        </div>
      )}

      {brand.logo && (() => {
        const handleAtTop = brand.showHandle;
        const pos = brand.logoPosition || 'tr';
        const margin = f.w * 0.045;
        const sizePx = (brand.logoSize ?? 30) * (f.w / 1080);
        const topOffset = handleAtTop && pos.startsWith('t') && pos.endsWith('r') ? margin + f.h * 0.05 : margin;
        const style = {
          position: 'absolute',
          width: sizePx, height: sizePx,
          opacity: (brand.logoOpacity ?? 90) / 100,
          backgroundImage: `url(${brand.logo})`,
          backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
          zIndex: 23,
        };
        if (pos === 'tl') Object.assign(style, { top: margin, left: margin });
        if (pos === 'tr') Object.assign(style, { top: topOffset, right: margin });
        if (pos === 'bl') Object.assign(style, { bottom: margin, left: margin });
        if (pos === 'br') Object.assign(style, { bottom: margin, right: margin });
        return <div style={style} aria-hidden />;
      })()}
    </div>
  );
});

const SlideCardInner = React.forwardRef(({
  slide, fmt, brand, num, total, scale = 1, presentationImgFilter, creativePreset = 'livre',
  slideIndex: slideIndexProp,
  showCanvasChrome = false,
  onCanvasZonePatch = null,
  onPhotoZoneRequest = null,
  /** `(slideIdx, ev) => void` — `<input type=file>` sobre a zona (WebKit/iOS). */
  onPhotoZoneNativeFile = null,
  enableZoneSwapDrag = false,
  /** Arrastar elementos soltos (texto, ornamentos) com o ponteiro. */
  movableElements = false,
  /** `(chave, {x, y}) => void` — novo deslocamento, em % do card. */
  onElementOffsetChange = null,
}, ref) => {
  // Textos de preset trazem tokens ({handle}, {marca}, {ano}) em vez de nomes
  // de marca de terceiros. Resolve UMA vez aqui — assim o card acompanha o
  // handle mesmo que o usuário configure depois de aplicar o padrão visual.
  const brandRaw = brand;
  brand = React.useMemo(() => {
    const campos = ['cultureHeaderLeft', 'cultureHeaderCenter', 'cultureHeaderYear',
      'footerPillText', 'footerBarLeft', 'footerBarCenter', 'footerBarRight'];
    if (!brandRaw || !campos.some((k) => String(brandRaw[k] || '').includes('{'))) return brandRaw;
    const out = { ...brandRaw };
    for (const k of campos) out[k] = resolvePresetText(brandRaw[k], brandRaw);
    return out;
  }, [brandRaw]);

  const f = FORMATS[fmt] || FORMATS.carrossel;
  const slideIdx = slideIndexProp != null ? slideIndexProp : num - 1;
  const zonePatchRef = React.useRef(onCanvasZonePatch);
  const brandPal = hydrateBrandTextColors(brand);
  const carouselEdgeSlide = total >= 1 && (slideIdx === 0 || slideIdx === total - 1);
  const carouselTitleInk = carouselEdgeSlide ? brandPal.titleColor : brandPal.subtitleColor;
  const carouselBodyInk = brandPal.textColor;
  zonePatchRef.current = onCanvasZonePatch;
  const photoReqRef = React.useRef(onPhotoZoneRequest);
  photoReqRef.current = onPhotoZoneRequest;
  const photoNativeRef = React.useRef(onPhotoZoneNativeFile);
  photoNativeRef.current = onPhotoZoneNativeFile;
  const onCanvasPatch = React.useCallback((p) => {
    zonePatchRef.current?.(slideIdx, p);
  }, [slideIdx]);

  // Arrastar elemento solto. `mov(chave)` devolve as props do elemento (ou null
  // quando o modo está desligado, e aí espalhar `{...null}` é inofensivo).
  const offsetRef = React.useRef(onElementOffsetChange);
  offsetRef.current = onElementOffsetChange;
  const aoMover = React.useCallback((chave, off) => {
    offsetRef.current?.(slideIdx, chave, off);
  }, [slideIdx]);
  const bindDrag = useElementDrag({
    f, slide, onOffsetChange: aoMover,
    enabled: !!(movableElements && onElementOffsetChange),
    interactionScale: scale,
  });
  /** Props de arrasto + deslocamento gravado, prontas para espalhar. */
  const mov = React.useCallback((chave, estiloBase) => {
    const off = elementOffsetStyle(slide, chave, f);
    const drag = bindDrag(chave);
    if (!off && !drag) return estiloBase ? { style: estiloBase } : null;
    // O selo do rodapé já usa translateX(-50%) para centrar; sobrescrever o
    // transform mandava-o para a esquerda no primeiro pixel de arrasto.
    const transformBase = estiloBase?.transform;
    const style = { ...(estiloBase || {}), ...(drag?.style || {}), ...(off || {}) };
    if (transformBase && off) style.transform = `${transformBase} ${off.transform}`;
    return { ...(drag || {}), 'data-vc-movable': chave, style };
  }, [slide, f, bindDrag]);

  /**
   * Só os handlers, sem aplicar `translate`. É o caso da foto em tela cheia:
   * ela cobre o card, e empurrá-la deixaria faixa vazia na borda — o
   * deslocamento dela entra no `background-position` (reenquadra).
   */
  const movArrasto = React.useCallback((chave, estiloBase) => {
    const drag = bindDrag(chave);
    if (!drag) return { style: estiloBase };
    return { ...drag, 'data-vc-movable': chave, style: { ...estiloBase, ...drag.style } };
  }, [bindDrag]);
  const onPhotoZoneClick = React.useCallback(() => {
    photoReqRef.current?.(slideIdx);
  }, [slideIdx]);
  const onPhotoZoneFileInputChange = React.useCallback((e) => {
    photoNativeRef.current?.(slideIdx, e);
  }, [slideIdx]);
  const L = LAYOUTS.find(l=>l.id===slide.layout) || DEFAULT_LAYOUT;
  const bg = resolveSlideBrandBg(brand, slideIdx, slide);
  const isBebas = brand.titleFont?.includes('Bebas');
  const imgModeNorm = normalizeSlideImgMode(slide.imgMode);
  const bgFit = slide.bgFit ?? 'custom';
  // Arrastar a foto reenquadra em vez de deslocar a camada: um fundo `inset:0`
  // empurrado para o lado deixaria faixa vazia na borda. O offset de `photo`
  // entra no background-position, que é o mesmo que os sliders de enquadramento
  // mexem — e o sinal é invertido porque puxar a imagem para a direita mostra
  // o lado esquerdo dela.
  const photoOff = getElementOffset(slide, 'photo');
  const bgPos = `${clampPct0a100((slide.bgX ?? 50) - photoOff.x)}% ${clampPct0a100((slide.bgY ?? 50) - photoOff.y)}%`;
  const bgScale = (slide.bgZoom ?? 100) / 100;

  const [imgReady, setImgReady] = React.useState(false);
  const [imgErr, setImgErr] = React.useState(false);

  React.useEffect(() => {
    if (!slide.bgImage) { setImgReady(false); setImgErr(false); return; }
    setImgReady(false); setImgErr(false);
    const img = new window.Image();
    img.onload  = () => setImgReady(true);
    img.onerror = () => { setImgErr(true); setImgReady(true); };
    img.src = slide.bgImage;
    return () => { img.onload = null; img.onerror = null; };
  }, [slide.bgImage]);

  const imgLoading = !!slide.bgImage && !imgReady;

  const derivedStoredPresentationFilter = slideStoredPresentationCssFilter(slide);

  let effectivePresentationFilter;
  if (presentationImgFilter === undefined) {
    effectivePresentationFilter = derivedStoredPresentationFilter;
  } else if (presentationImgFilter == null || presentationImgFilter === '') {
    effectivePresentationFilter = undefined;
  } else {
    effectivePresentationFilter = presentationImgFilter;
  }

  const titleFF = effectiveTitleFontFamily(brand);
  const bodyFF = effectiveBodyFontFamily(brand);

  const culturePack = creativePreset === 'tendencia_cultura';
  const sandwichSkin = culturePack || !!slide.useCultureLayout;
  const cultureRichText = culturePack || !!slide.useCultureLayout;
  const bodyAfterCulture = (slide.bodyAfterImage || '').trim();
  const sandwich =
    sandwichSkin &&
    !!bodyAfterCulture &&
    (!!slide.bgImage || slideHasPendingPhotoIntent(slide));
  const cultureStatFlat =
    sandwichSkin &&
    !slide.bgImage &&
    !slideHasPendingPhotoIntent(slide) &&
    !!bodyAfterCulture &&
    !!(slide.subtitle || '').trim();
  const cultureCoverOnly =
    culturePack &&
    num === 1 &&
    (!!slide.bgImage || slideHasPendingPhotoIntent(slide)) &&
    !sandwich &&
    !cultureStatFlat;
  // Badge classic (com avatar circular + handle) deve aparecer em TODOS os modos —
  // o usuário controla via toggle "Mostrar @ nos slides" e posição via sliders handleBadgeX/Y.
  // (Antes era escondido em culturePack assumindo que o handle iria na editorial bar,
  // mas isso ignorava os sliders de posição.)
  const hideInstaBadge = false;
  // Desligado: contador "N/M" no canto superior direito do card foi removido a pedido.
  // (UI já mostra o número do card via tabs/navegação fora do canvas.)
  // Badge "N/M" canto sup direito — ativado por brand.showPageBadge
  // (era hardcoded false; agora opt-in via preset visual Sports Editorial etc).
  const showCultureIdx = !!brand.showPageBadge;
  const cultureAccentCol = brand.accent || '#000000';

  const slideCardBg = resolveSlideBrandBg(brand, slideIdx, slide) || '#fafafc';
  let displayTitleInk = carouselTitleInk;
  let displayBodyInk = carouselBodyInk;
  if (culturePack || sandwichSkin) {
    const cr = cultureReadableInks(slideCardBg, carouselTitleInk, carouselBodyInk, cultureAccentCol);
    displayTitleInk = cr.titleInk;
    displayBodyInk = cr.bodyInk;
    if (
      cultureCoverOnly &&
      (slide.bgImage || slideHasPendingPhotoIntent(slide)) &&
      (slide.overlay ?? 0) >= 38
    ) {
      const rgbBg = vcHexToRgb(vcNormalizeHex(slideCardBg) || '#fafafc');
      const Lbg = rgbBg ? vcRelLuminance01(rgbBg) : 0.96;
      if (Lbg >= 0.55) {
        displayTitleInk = DARK_CREAM.title;
        displayBodyInk = 'rgba(245,245,247,0.92)';
      }
    }
  }

  let inner;
  const cvEnabled = !!(slide.canvas && slide.canvas.enabled && slide.canvas.zones);
  const cvVar = slide.canvas?.variant;
  const cultureLayoutInferred = inferCanvasDefaults(slide, creativePreset);
  const cultureVariantForLayout = slide.canvas?.variant ?? cultureLayoutInferred.variant;
  const cultureZonesForLayout =
    slide.canvas?.zones && typeof slide.canvas.zones === 'object'
      ? slide.canvas.zones
      : cultureLayoutInferred.zones;
  const useCultureCanvasZones =
    (sandwich || cultureStatFlat) &&
    (cultureVariantForLayout === 'sandwich' || cultureVariantForLayout === 'stat');

  if (useCultureCanvasZones) {
    const z = cultureZonesForLayout;
    const surface = cultureResolveSurface(slide, num);
    const lightCultureBg = resolveSlideBrandBg(brand, slideIdx, slide) || '#fafafc';
    const bgSolid = surface === 'dark' ? cultureDarkBackdropFromBrand(brand.bg) : surface === 'accent' ? (brand.accent || '#000000') : lightCultureBg;
    const cr = cultureReadableInks(bgSolid, carouselTitleInk, carouselBodyInk, cultureAccentCol);
    const hasBar = !!(brand.cultureHeaderLeft || '').trim() || !!(brand.cultureHeaderYear || '').trim();
    const Lzn = LAYOUTS.find((l) => l.id === slide.layout) || DEFAULT_LAYOUT;
    const alignInner =
      slide.align === 'center' ? 'center' :
      slide.align === 'right' ? 'flex-end' :
      slide.align === 'justify' ? 'stretch' : 'flex-start';
    const insetZn = slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
    const padXCvTop = canvasCultureSandwichPaddingXPx(f, slide);
    const padXCvBottom = canvasCultureSandwichBottomPaddingXPx(f, slide);
    const padYCv = f.h * (0.004 + insetZn * 0.002);
    const topR = z.top ? clampRect(z.top) : { x: 6, y: 8, w: 88, h: 28 };
    const photoR = z.photo ? clampRect(z.photo) : { x: 6, y: 30, w: 88, h: 42 };
    const botR = z.bottom ? clampRect(z.bottom) : { x: 6, y: 74, w: 88, h: 23 };
    const sandwichPhotoInteractive = !!((showCanvasChrome || (sandwich && slideHasPendingPhotoIntent(slide))) && onPhotoZoneClick);
    const sandwichPhotoNativeHit = !!(sandwichPhotoInteractive && onPhotoZoneNativeFile);
    const sandwichPhotoBoxStyle = {
      ...pctBox(photoR, f),
      zIndex: 2,
      overflow: 'hidden',
      borderRadius: f.w * 0.017,
      background: cr.solidBgIsLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
      boxShadow: 'var(--shadow-product)',
    };
    inner = (
      <div
        ref={ref}
        style={{ width:f.w, height:f.h, background:bgSolid, position:'relative', overflow:'hidden', fontFamily: bodyFF }}
      >
        <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 1 }} />
        {hasBar && (
          <div {...mov('headerBar', {
            position:'absolute', top:f.h*0.028, left:f.w*0.05, right:f.w*0.16, zIndex:25,
            display:'flex', justifyContent:'space-between', alignItems:'center', gap:f.w*0.02,
          })}>
            <span style={{
              fontSize:f.w*0.022, color:cr.inkMuted, fontFamily:bodyFF, fontWeight:400, letterSpacing:'-0.011em',
              maxWidth:'32%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>{(brand.cultureHeaderLeft || '').trim()}</span>
            <span style={{
              flex:1, textAlign:'center', fontSize:f.w*0.022, color:cr.inkMuted, fontFamily:bodyFF, fontWeight:600,
              letterSpacing:'-0.011em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>{brand.handle}</span>
            <span style={{ fontSize:f.w*0.022, color:cr.inkMuted, fontFamily:bodyFF, letterSpacing:'-0.011em' }}>
              {(brand.cultureHeaderYear || '').trim()}{(brand.cultureHeaderYear || '').trim() ? ' //' : ''}
            </span>
          </div>
        )}
        {showCultureIdx && (
          <div style={{
            position:'absolute', top:f.h*0.032, right:f.w*0.05, zIndex:30,
            background: cr.solidBgIsLight ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.28)',
            color: cr.solidBgIsLight ? '#1d1d1f' : '#ffffff',
            padding:`${f.h*0.006}px ${f.w*0.022}px`, borderRadius:999,
            fontSize:f.w*0.026, fontWeight:600, fontFamily:bodyFF, letterSpacing:'-0.02em',
          }}>{num}/{total}</div>
        )}

        <OverflowScaler
          containerProps={mov('text')}
          containerStyle={{
            ...pctBox(topR, f),
            ...VC_TEXT_ZONE_STYLE,
            zIndex: 4,
            overflow: 'hidden',
            padding: `${padYCv}px ${padXCvTop}px`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: Lzn.ai,
            textAlign: slide.align === 'justify' ? 'left' : slide.align,
          }}
          deps={[slide.title, slide.subtitle, slide.titleSize, slide.subSize, topR.w, topR.h, f.w, f.h]}
          minScale={AUTOFIT_MIN_SCALE}
        >
          {(topScale) => (
          <div
            style={{
              width: '100%',
              minWidth: 0,
              alignSelf: 'stretch',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              alignItems: alignInner,
              gap: f.h * 0.012 * topScale,
            }}
          >
          {(slide.title || '').trim() ? (
            <h2 style={{
              margin: 0,
              fontFamily: titleFF,
              overflowWrap: 'break-word',
              wordBreak: 'normal',
              maxWidth: '100%',
              width: '100%',
              boxSizing: 'border-box',
              textTransform:
                slide.titleCase === 'upper' ? 'uppercase' :
                slide.titleCase === 'lower' ? 'lowercase' : 'none',
            }}>
              <CultureInlineRich
                text={slide.title || ''}
                destaqueSpans={slide.destaqueSpans?.title}
                baseColor={cr.titleInk}
                accentColor={cr.accentInk}
                fontFamily={titleFF}
                fontSize={f.w * 0.036 * (slide.titleSize / 100) * topScale}
                lineHeight={(slide.titleLeading ?? 105) / 100}
                fontWeight={slide.titleWeight ?? 600}
                letterSpacing={`${(-2.4 + (slide.titleTracking ?? 0)) / 100}em`}
              />
            </h2>
          ) : null}
          <CultureRichParagraphs
            text={slide.subtitle}
            destaqueSpans={slide.destaqueSpans?.subtitle}
            ink={cr.subtitleInk}
            accentColor={cr.accentInk}
            fontFamily={bodyFF}
            fontSize={f.w * 0.031 * (slide.subSize / 100) * topScale}
            lineHeight={(slide.subLeading ?? 142) / 100}
            fontWeight={600}
            letterSpacing={`${(-1 + (slide.subTracking ?? 0)) / 100}em`}
            paraGap={f.h * 0.012 * topScale}
          />
          </div>
          )}
        </OverflowScaler>

        {cultureVariantForLayout === 'sandwich' && (
          <div
            {...mov('photo', {
              ...sandwichPhotoBoxStyle,
              cursor: sandwichPhotoInteractive ? 'pointer' : undefined,
            })}
            onClick={sandwichPhotoInteractive && !sandwichPhotoNativeHit ? (e) => { e.stopPropagation(); onPhotoZoneClick(); } : undefined}
            role={sandwichPhotoInteractive && !sandwichPhotoNativeHit ? 'button' : undefined}
          >
            {sandwich && imgLoading && (
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.2)' }}>
                <div style={{
                  width:f.w*0.065, height:f.w*0.065, borderRadius:'50%',
                  border:`${f.w*0.005}px solid rgba(255,255,255,0.2)`,
                  borderTopColor: cr.accentInk, animation:'spin 0.9s linear infinite',
                }}/>
              </div>
            )}
            {sandwich && slide.videoId && getVideoUrl(slide.videoId) && (
              <>
                <video
                  src={getVideoUrl(slide.videoId)}
                  autoPlay loop muted playsInline
                  style={sandwichPhotoZoneImgStyle(slide, effectivePresentationFilter)}
                />
                {slide.overlay > 0 ? (
                  <div
                    style={{
                      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
                      background: `linear-gradient(175deg, rgba(0,0,0,${slide.overlay / 100 * 0.4}) 0%, rgba(0,0,0,${slide.overlay / 100}) 100%)`,
                    }}
                  />
                ) : null}
                <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 2 }} />
              </>
            )}
            {sandwich && !slide.videoId && imgReady && !imgErr && slide.bgImage && (
              <>
                <img
                  src={slide.bgImage}
                  alt=""
                  draggable={false}
                  style={sandwichPhotoZoneImgStyle(slide, effectivePresentationFilter)}
                />
                {slide.overlay > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                      zIndex: 1,
                      background: `linear-gradient(175deg, rgba(0,0,0,${slide.overlay / 100 * 0.4}) 0%, rgba(0,0,0,${slide.overlay / 100}) 100%)`,
                    }}
                  />
                ) : null}
                <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 2 }} />
              </>
            )}
            {sandwich && !slide.videoId && !slide.bgImage && (
              <div style={{
                position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
                color:cr.inkMuted, fontSize:f.w*0.024, fontWeight:600, textAlign:'center', padding:f.w*0.04,
              }}>
                {slideHasPendingPhotoIntent(slide) ? 'Toque para inserir foto' : 'Área da imagem'}
              </div>
            )}
            {sandwichPhotoNativeHit ? (
              <input
                type="file"
                accept="image/*"
                onChange={onPhotoZoneFileInputChange}
                onTouchStart={(e) => e.stopPropagation()}
                style={VC_PHOTO_ZONE_HIT_LAYER_STYLE}
                aria-label="Importar imagem na zona da foto"
              />
            ) : null}
          </div>
        )}

        <OverflowScaler
          containerProps={mov('subtitle')}
          containerStyle={{
            ...pctBox(botR, f),
            ...VC_TEXT_ZONE_STYLE,
            zIndex: 4,
            overflow: 'hidden',
            padding: `${padYCv}px ${padXCvBottom}px`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: Lzn.ai,
            textAlign: slide.align === 'justify' ? 'left' : slide.align,
          }}
          deps={[bodyAfterCulture, slide.bodyAfterSize, slide.subSize, botR.w, botR.h, f.w, f.h]}
          minScale={AUTOFIT_MIN_SCALE}
        >
          {(botScale) => (
          <CultureRichParagraphs
            text={bodyAfterCulture}
            destaqueSpans={slide.destaqueSpans?.bodyAfterImage}
            ink={cr.bodyInk}
            accentColor={cr.accentInk}
            fontFamily={bodyFF}
            fontSize={f.w * 0.029 * ((slide.bodyAfterSize ?? slide.subSize ?? 100) / 100) * botScale}
            lineHeight={(slide.subLeading ?? 145) / 100}
            fontWeight={600}
            letterSpacing={`${(-1 + (slide.subTracking ?? 0)) / 100}em`}
            paraGap={f.h * 0.01 * botScale}
          />
          )}
        </OverflowScaler>

        {showCanvasChrome && onCanvasPatch && cvEnabled && (
          <CanvasZonesOverlay
            f={f}
            zones={slide.canvas.zones}
            keys={cultureVariantForLayout === 'stat' ? ['top', 'bottom'] : ['top', 'photo', 'bottom']}
            onPatch={onCanvasPatch}
            swapSlideIdx={enableZoneSwapDrag && showCanvasChrome ? slideIdx : null}
            swapZoneKeys={cultureVariantForLayout === 'stat' ? ['top', 'bottom'] : ['top', 'photo', 'bottom']}
            photoZoneTap={onPhotoZoneNativeFile ? null : (onPhotoZoneClick || null)}
            photoZoneFileChange={onPhotoZoneNativeFile ? onPhotoZoneFileInputChange : null}
            interactionScale={scale}
          />
        )}

        {brand.logo && (() => {
          const pos = brand.logoPosition || 'tr';
          const margin = f.w * 0.045;
          const sizePx = (brand.logoSize ?? 30) * (f.w / 1080);
          const topOffset = hasBar && pos.startsWith('t') && pos.endsWith('r') ? margin + f.h * 0.072 : margin;
          const st = {
            position:'absolute',
            width: sizePx, height: sizePx,
            opacity: (brand.logoOpacity ?? 90) / 100,
            backgroundImage: `url(${brand.logo})`,
            backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
            zIndex: 20,
          };
          if (pos === 'tl') Object.assign(st, { top: margin, left: margin });
          if (pos === 'tr') Object.assign(st, { top: topOffset, right: margin });
          if (pos === 'bl') Object.assign(st, { bottom: margin, left: margin });
          if (pos === 'br') Object.assign(st, { bottom: margin, right: margin });
          return <div style={st} aria-hidden/>;
        })()}
      </div>
    );
  } else if (sandwich || cultureStatFlat) {
    const surface = cultureResolveSurface(slide, num);
    const lightCultureBg = resolveSlideBrandBg(brand, slideIdx, slide) || '#fafafc';
    const bgSolid = surface === 'dark' ? cultureDarkBackdropFromBrand(brand.bg) : surface === 'accent' ? (brand.accent || '#000000') : lightCultureBg;
    const cr = cultureReadableInks(bgSolid, carouselTitleInk, carouselBodyInk, cultureAccentCol);
    const hasBar = !!(brand.cultureHeaderLeft || '').trim() || !!(brand.cultureHeaderYear || '').trim();
    const flatPhotoNativeHit = !!(
      sandwich &&
      !slide.bgImage &&
      slideHasPendingPhotoIntent(slide) &&
      onPhotoZoneClick &&
      onPhotoZoneNativeFile
    );
    const flatPhotoPlaceholderStyle = {
      width: '100%',
      borderRadius: f.w * 0.017,
      height: f.h * (SANDWICH_PHOTO_ZONE_MIN_H_PCT / 100),
      minHeight: f.h * 0.22,
      maxHeight: f.h * 0.32,
      flex: '0 1 auto',
      flexShrink: 1,
      background: cr.solidBgIsLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)',
      border: cr.solidBgIsLight ? `1px dashed ${cr.inkMuted}` : '1px dashed rgba(255,255,255,0.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: cr.inkMuted,
      fontWeight: 600,
      fontSize: f.w * 0.024,
      textAlign: 'center',
      padding: f.w * 0.04,
    };
    inner = (
      <div
        ref={ref}
        style={{ width:f.w, height:f.h, background:bgSolid, position:'relative', overflow:'hidden', fontFamily: bodyFF }}
      >
        <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 1 }} />
        {hasBar && (
          <div {...mov('headerBar', {
            position:'absolute', top:f.h*0.028, left:f.w*0.05, right:f.w*0.16, zIndex:25,
            display:'flex', justifyContent:'space-between', alignItems:'center', gap:f.w*0.02,
          })}>
            <span style={{
              fontSize:f.w*0.022, color:cr.inkMuted, fontFamily:bodyFF, fontWeight:400, letterSpacing:'-0.011em',
              maxWidth:'32%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>{(brand.cultureHeaderLeft || '').trim()}</span>
            <span style={{
              flex:1, textAlign:'center', fontSize:f.w*0.022, color:cr.inkMuted, fontFamily:bodyFF, fontWeight:600,
              letterSpacing:'-0.011em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>{brand.handle}</span>
            <span style={{ fontSize:f.w*0.022, color:cr.inkMuted, fontFamily:bodyFF, letterSpacing:'-0.011em' }}>
              {(brand.cultureHeaderYear || '').trim()}{(brand.cultureHeaderYear || '').trim() ? ' //' : ''}
            </span>
          </div>
        )}
        {showCultureIdx && (
          <div style={{
            position:'absolute', top:f.h*0.032, right:f.w*0.05, zIndex:30,
            background: cr.solidBgIsLight ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.28)',
            color: cr.solidBgIsLight ? '#1d1d1f' : '#ffffff',
            padding:`${f.h*0.006}px ${f.w*0.022}px`, borderRadius:999,
            fontSize:f.w*0.026, fontWeight:600, fontFamily:bodyFF, letterSpacing:'-0.02em',
          }}>{num}/{total}</div>
        )}
        {sandwich && imgLoading && (
          <div style={{
            position:'absolute', inset:0, zIndex:6, display:'flex', alignItems:'center', justifyContent:'center',
            background: cr.solidBgIsLight ? 'rgba(250,250,252,0.92)' : 'rgba(10,10,12,0.88)',
          }}>
            <div style={{
              width:f.w*0.065, height:f.w*0.065, borderRadius:'50%',
              border:`${f.w*0.005}px solid ${cr.solidBgIsLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'}`,
              borderTopColor: cr.accentInk, animation:'spin 0.9s linear infinite',
            }}/>
          </div>
        )}
        <OverflowScaler
          containerProps={mov('text')}
          containerStyle={{
            position:'absolute',
            top: f.h * (hasBar ? 0.09 : 0.065),
            left: f.w * 0.05,
            right: f.w * 0.05,
            bottom: f.h * 0.05,
            display:'flex',
            flexDirection:'column',
            gap: f.h * 0.024,
            // Sempre flex-start: space-between empurrava o primeiro item PRA CIMA quando havia
            // overflow (causa do bug "texto cortado no topo"). Com flex-start, overflow vai pra
            // baixo onde overflow:hidden corta sem comprometer leitura do começo.
            justifyContent: 'flex-start',
            ...VC_TEXT_ZONE_STYLE,
            overflow: 'hidden',
            minWidth: 0,
            minHeight: 0,
          }}
          deps={[
            slide.title, slide.subtitle, bodyAfterCulture,
            f.w, f.h, slide.titleSize, slide.subSize, slide.bodyAfterSize,
            sandwich, !!slide.bgImage,
          ]}
          minScale={0.78}
        >
          {(scale) => (<>
          {(slide.title || '').trim() ? (
            <h2 style={{
              margin: 0,
              fontFamily: titleFF,
              overflowWrap: 'break-word',
              wordBreak: 'normal',
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
            }}>
              <CultureInlineRich
                text={slide.title || ''}
                destaqueSpans={slide.destaqueSpans?.title}
                baseColor={cr.titleInk}
                accentColor={cr.accentInk}
                fontFamily={titleFF}
                fontSize={f.w * 0.036 * ((slide.titleSize ?? 100) / 100) * scale}
                lineHeight={1.14}
                fontWeight={600}
                letterSpacing="-0.024em"
              />
            </h2>
          ) : null}
          <CultureRichParagraphs
            text={slide.subtitle}
            destaqueSpans={slide.destaqueSpans?.subtitle}
            ink={cr.subtitleInk}
            accentColor={cr.accentInk}
            fontFamily={bodyFF}
            fontSize={f.w * 0.031 * ((slide.subSize ?? 100) / 100) * scale}
            lineHeight={1.42}
            fontWeight={600}
            letterSpacing="-0.018em"
            paraGap={f.h*0.012}
          />
          {sandwich && !slide.bgImage && slideHasPendingPhotoIntent(slide) && (
            <div
              data-vc-photo-zone="1"
              style={{
                ...flatPhotoPlaceholderStyle,
                position: 'relative',
                cursor: onPhotoZoneClick ? 'pointer' : undefined,
                ...(slide.bgImageFailed ? {
                  borderColor: cr.accentInk,
                  color: cr.accentInk,
                } : null),
              }}
              role={onPhotoZoneClick && !flatPhotoNativeHit ? 'button' : undefined}
              onClick={
                onPhotoZoneClick && !flatPhotoNativeHit
                  ? (ev) => {
                    ev.stopPropagation();
                    onPhotoZoneClick();
                  }
                  : undefined
              }
            >
              {slide.bgImageFailed ? 'Falha ao gerar — toque para tentar de novo' : 'Toque para inserir foto'}
              {flatPhotoNativeHit ? (
                <input
                  type="file"
                  accept="image/*"
                  onChange={onPhotoZoneFileInputChange}
                  onTouchStart={(e) => e.stopPropagation()}
                  style={{
                    ...VC_PHOTO_ZONE_HIT_LAYER_STYLE,
                    borderRadius: f.w * 0.017,
                  }}
                  aria-label="Importar imagem na zona da foto"
                />
              ) : null}
            </div>
          )}
          {sandwich && slide.videoId && getVideoUrl(slide.videoId) && (
            <div data-vc-photo-zone="1" style={{
              width:'100%', flex: '0 1 auto',
              height: f.h * (SANDWICH_PHOTO_ZONE_MIN_H_PCT / 100),
              minHeight: f.h * 0.22, maxHeight: f.h * 0.32,
              borderRadius: f.w * 0.017, overflow:'hidden', flexShrink:1, position:'relative',
              background: cr.solidBgIsLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
              boxShadow: 'var(--shadow-product)',
            }}>
              <video
                src={getVideoUrl(slide.videoId)}
                autoPlay loop muted playsInline
                style={sandwichPhotoZoneImgStyle(slide, effectivePresentationFilter)}
              />
              {slide.overlay > 0 ? (
                <div style={{
                  position:'absolute', inset:0, pointerEvents:'none', zIndex:1,
                  background: `linear-gradient(175deg, rgba(0,0,0,${slide.overlay/100*0.4}) 0%, rgba(0,0,0,${slide.overlay/100}) 100%)`,
                }}/>
              ) : null}
              <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 2 }} />
              <span
                title="Vídeo importado"
                style={{
                  position: 'absolute', top: f.h * 0.012, right: f.w * 0.018, zIndex: 3,
                  fontSize: f.w * 0.018, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em', color: '#ffffff', background: 'rgba(0,0,0,0.48)',
                  padding: `${f.h * 0.004}px ${f.w * 0.012}px`, borderRadius: 9999,
                  backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', pointerEvents: 'none',
                  display:'inline-flex', alignItems:'center', gap:4,
                }}
              ><Video size={Math.max(8, f.w * 0.018)} aria-hidden/> VÍDEO</span>
            </div>
          )}
          {sandwich && !slide.videoId && imgReady && !imgErr && slide.bgImage && (
            <div data-vc-photo-zone="1" style={{
              width:'100%',
              flex: '0 1 auto',
              height: f.h * (SANDWICH_PHOTO_ZONE_MIN_H_PCT / 100),
              minHeight: f.h * 0.22,
              maxHeight: f.h * 0.32,
              borderRadius: f.w * 0.017,
              overflow:'hidden',
              flexShrink:1,
              position:'relative',
              background: cr.solidBgIsLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
              boxShadow: 'var(--shadow-product)',
            }}>
              <img
                src={slide.bgImage}
                alt=""
                draggable={false}
                style={sandwichPhotoZoneImgStyle(slide, effectivePresentationFilter)}
              />
              {slide.overlay > 0 ? (
                <div style={{
                  position:'absolute', inset:0, pointerEvents:'none', zIndex:1,
                  background: `linear-gradient(175deg, rgba(0,0,0,${slide.overlay/100*0.4}) 0%, rgba(0,0,0,${slide.overlay/100}) 100%)`,
                }}/>
              ) : null}
              <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 2 }} />
              {slide.bgImageSource === 'ai' ? (
                <span
                  title="Imagem gerada por IA"
                  style={{
                    position: 'absolute',
                    top: f.h * 0.012,
                    right: f.w * 0.018,
                    zIndex: 3,
                    fontSize: f.w * 0.018,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.04em',
                    color: '#ffffff',
                    background: 'rgba(0,0,0,0.48)',
                    padding: `${f.h * 0.004}px ${f.w * 0.012}px`,
                    borderRadius: 9999,
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    pointerEvents: 'none',
                  }}
                >✨ IA</span>
              ) : null}
            </div>
          )}
          {/* Body sem AutoFitText: deixa OverflowScaler medir a altura real e escalar
              uniformemente. Wrapper com width 100% pro CultureRichParagraphs ocupar a largura. */}
          <div style={{ width: '100%' }}>
            <CultureRichParagraphs
              text={bodyAfterCulture}
              destaqueSpans={slide.destaqueSpans?.bodyAfterImage}
              ink={cr.bodyInk}
              accentColor={cr.accentInk}
              fontFamily={bodyFF}
              fontSize={f.w * 0.029 * ((slide.bodyAfterSize ?? slide.subSize ?? 100) / 100) * scale}
              lineHeight={1.45}
              fontWeight={600}
              letterSpacing="-0.016em"
              paraGap={f.h*0.01}
            />
          </div>
          </>)}
        </OverflowScaler>
        {brand.logo && (() => {
          const pos = brand.logoPosition || 'tr';
          const margin = f.w * 0.045;
          const sizePx = (brand.logoSize ?? 30) * (f.w / 1080);
          const topOffset = hasBar && pos.startsWith('t') && pos.endsWith('r') ? margin + f.h * 0.072 : margin;
          const style = {
            position:'absolute',
            width: sizePx, height: sizePx,
            opacity: (brand.logoOpacity ?? 90) / 100,
            backgroundImage: `url(${brand.logo})`,
            backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
            zIndex: 20,
          };
          if (pos === 'tl') Object.assign(style, { top: margin,    left: margin });
          if (pos === 'tr') Object.assign(style, { top: topOffset, right: margin });
          if (pos === 'bl') Object.assign(style, { bottom: margin, left: margin });
          if (pos === 'br') Object.assign(style, { bottom: margin, right: margin });
          return <div style={style} aria-hidden/>;
        })()}
        {brand.showHandle && slide.showHandle && !hideInstaBadge && (brand.handle || '').trim() && (
          <div style={{
            ...vcHandleBadgeBoxPositionStyle(brand),
            display:'flex', alignItems:'center', gap:f.w*0.012,
            background: cr.solidBgIsLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
            backdropFilter:'blur(12px)',
            padding:`${f.h*0.01}px ${f.w*0.022}px`,
            borderRadius:999,
            border: cr.solidBgIsLight ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.12)',
          }}>
            <div style={{
              width:f.w*0.034, height:f.w*0.034, borderRadius:'50%',
              background:'conic-gradient(from 45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
              display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink: 0,
            }}>
              <div style={{
                width:'76%', height:'76%', borderRadius:'50%',
                overflow:'hidden',
                background: brand.handleAvatar ? '#0a0a0a' : bgSolid,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                {brand.handleAvatar ? (
                  <img
                    src={brand.handleAvatar}
                    alt=""
                    draggable={false}
                    style={vcHandleAvatarImgStyle(brand)}
                  />
                ) : (
                  <VcHandleAvatarFallback f={f} bg={bgSolid} />
                )}
              </div>
            </div>
            <span style={{ color: cr.titleInk, fontSize:f.w*0.022, fontWeight:600, fontFamily: bodyFF, letterSpacing:'-0.01em' }}>
              {vcHandleLabel(brand)}
            </span>
          </div>
        )}
      </div>
    );
  } else if (cvEnabled && cvVar === 'classic') {
    inner = (
      <ClassicCanvasInner
        ref={ref}
        f={f}
        slide={slide}
        brand={brand}
        bg={bg}
        titleFF={titleFF}
        bodyFF={bodyFF}
        isBebas={isBebas}
        culture={cultureRichText}
        cultureAccentCol={cultureAccentCol}
        cultureCoverOnly={cultureCoverOnly}
        showCultureIdx={showCultureIdx}
        num={num}
        total={total}
        hideInstaBadge={hideInstaBadge}
        titleInk={displayTitleInk}
        bodyInk={displayBodyInk}
        imgModeNorm={imgModeNorm}
        effectivePresentationFilter={effectivePresentationFilter}
        bgFit={bgFit}
        bgPos={bgPos}
        bgScale={bgScale}
        imgReady={imgReady}
        imgErr={imgErr}
        imgLoading={imgLoading}
        showCanvasChrome={showCanvasChrome}
        onCanvasPatch={onCanvasPatch}
        onPhotoZoneClick={onPhotoZoneClick}
        onPhotoZoneFileChange={onPhotoZoneNativeFile ? onPhotoZoneFileInputChange : undefined}
        swapSlideIdx={enableZoneSwapDrag && showCanvasChrome ? slideIdx : null}
        swapZoneKeys={undefined}
        interactionScale={scale}
        mov={showCanvasChrome ? null : mov}
      />
    );
  } else if (normalizePhotoRegion(slide) !== 'full' && !cvEnabled && !(sandwich || cultureStatFlat)) {
    inner = (
      <ClassicLegadoInsetPhotoColumn
        ref={ref}
        f={f}
        slide={slide}
        brand={brand}
        bg={bg}
        L={L}
        isBebas={isBebas}
        titleFF={titleFF}
        bodyFF={bodyFF}
        displayTitleInk={displayTitleInk}
        displayBodyInk={displayBodyInk}
        cultureRichText={cultureRichText}
        cultureAccentCol={cultureAccentCol}
        sandwichSkin={sandwichSkin}
        showCultureIdx={showCultureIdx}
        num={num}
        total={total}
        hideInstaBadge={hideInstaBadge}
        imgReady={imgReady}
        imgErr={imgErr}
        imgLoading={imgLoading}
        imgModeNorm={imgModeNorm}
        effectivePresentationFilter={effectivePresentationFilter}
        bgFit={bgFit}
        bgPos={bgPos}
        bgScale={bgScale}
        photoRegionId={normalizePhotoRegion(slide)}
        onPhotoZoneClick={onPhotoZoneClick}
        showCanvasChrome={showCanvasChrome}
        mov={mov}
      />
    );
  } else {
    inner = (
    <div
      ref={ref}
      style={{ width:f.w, height:f.h, background:bg, position:'relative', overflow:'hidden', fontFamily: bodyFF }}
    >
      {/* BG Image — bgFit: cover (preenche) | contain (inteira) | custom (zoom % legado) */}
      {slide.bgImage && imgReady && !imgErr && (
        <div {...movArrasto('photo', { position:'absolute', inset:0, overflow:'hidden' })}>
          <div style={{
            position:'absolute', inset:0,
            backgroundImage:`url(${slide.bgImage})`,
            backgroundPosition:bgPos,
            backgroundRepeat:'no-repeat',
            opacity:slide.bgOpacity/100,
            ...(bgFit === 'custom'
              ? {
                  backgroundSize:`${slide.bgZoom}%`,
                  transform: slide.bgMirror ? 'scaleX(-1)' : 'none',
                }
              : {
                  backgroundSize: bgFit === 'contain' ? 'contain' : 'cover',
                  transform: `${slide.bgMirror ? 'scaleX(-1) ' : ''}scale(${bgScale})`,
                  transformOrigin: bgPos,
                }),
            ...(effectivePresentationFilter ? { filter: effectivePresentationFilter } : {}),
          }}/>
        </div>
      )}
      {slide.bgImage && imgReady && !imgErr && slide.overlay > 0 && (
        <div style={{
          // Decorativo: sem `pointer-events:none` este gradiente cobre o card
          // inteiro e engole o ponteiro — era o motivo de o arrasto "so
          // funcionar em alguns cards" (os sem foto, ou nos ornamentos, que
          // ficam num zIndex acima dele).
          position:'absolute', inset:0, pointerEvents:'none',
          background: cultureCoverOnly
            ? `linear-gradient(to top, rgba(0,0,0,${Math.min(0.92, slide.overlay/100 * 1.05)}) 0%, rgba(0,0,0,${slide.overlay/100*0.35}) 45%, transparent 72%)`
            : `linear-gradient(175deg, rgba(0,0,0,${slide.overlay/100*0.4}) 0%, rgba(0,0,0,${slide.overlay/100}) 100%)`,
        }}/>
      )}
      <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 1 }} />

      {/* Header bar 3-col + badge "N/M" — usado por presets visuais editoriais
          (Sports Editorial etc) em modo full-bleed (não-Cultura). Já existe
          variante no renderer Cultura; aqui é versão simplificada pra classic. */}
      {(() => {
        const hLeft  = (brand.cultureHeaderLeft  || '').trim();
        // Centro: se preset setar explicitamente (mesmo ''), respeita.
        // Senão (undefined/null), fallback pro handle do user.
        const hCenter = (typeof brand.cultureHeaderCenter === 'string'
          ? brand.cultureHeaderCenter
          : (brand.handle || '')).trim();
        const hRight = (brand.cultureHeaderYear  || '').trim();
        const hasHeaderBar = !!(hLeft || hRight) || (!!hCenter && brand.cultureHeaderLeft);
        const hasPageBadge = !!brand.showPageBadge;
        if (!hasHeaderBar && !hasPageBadge) return null;
        // Cor branca translúcida quando há foto BG; senão tom da marca.
        const headerColor = slide.bgImage ? 'rgba(255,255,255,0.85)' : (displayBodyInk || '#555');
        const badgeBg = slide.bgImage ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.12)';
        const badgeColor = slide.bgImage ? '#fff' : (displayBodyInk || '#222');
        return (
          <>
            {hasHeaderBar && (
              <div {...mov('headerBar', {
                position:'absolute', top:f.h*0.028, left:f.w*0.05,
                right: hasPageBadge ? f.w*0.16 : f.w*0.05,
                zIndex:25,
                display:'flex', justifyContent:'space-between', alignItems:'center',
                gap:f.w*0.02,
                pointerEvents: movableElements ? 'auto' : 'none',
              })}>
                <span style={{
                  fontSize:f.w*0.020, color:headerColor, fontFamily:bodyFF,
                  fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase',
                  maxWidth:'32%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                }}>{hLeft}</span>
                <span style={{
                  flex:1, textAlign:'center',
                  fontSize:f.w*0.020, color:headerColor, fontFamily:bodyFF,
                  fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                }}>{hCenter}</span>
                <span style={{
                  fontSize:f.w*0.020, color:headerColor, fontFamily:bodyFF,
                  fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase',
                  maxWidth:'32%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'right',
                }}>{hRight}</span>
              </div>
            )}
            {hasPageBadge && (
              <div {...mov('pageBadge', {
                position:'absolute', top:f.h*0.024, right:f.w*0.05, zIndex:30,
                background: badgeBg, color: badgeColor,
                padding:`${f.h*0.006}px ${f.w*0.022}px`, borderRadius:9999,
                fontSize:f.w*0.024, fontWeight:600, fontFamily:bodyFF,
                letterSpacing:'-0.011em', fontVariantNumeric:'tabular-nums',
                backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)',
                pointerEvents: movableElements ? 'auto' : 'none',
              })}>{num}/{total}</div>
            )}
          </>
        );
      })()}

      {/* Loading até a URL da imagem terminar de baixar */}
      {imgLoading && (
        <div style={{
          position:'absolute', inset:0, zIndex:5,
          background:'rgba(10,9,8,0.92)',
          display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:f.h*0.018,
        }}>
          <div style={{
            width:f.w*0.07, height:f.w*0.07,
            borderRadius:'50%',
            border:`${f.w*0.006}px solid rgba(255,255,255,0.1)`,
            borderTopColor:'var(--accent)',
            animation:'spin 0.9s linear infinite',
          }}/>
          <span style={{
            color:'rgba(255,255,255,0.55)',
            fontSize:f.w*0.026,
            fontWeight:600,
            letterSpacing:'-0.011em',
          }}>
            {imgModeNorm === 'dalle' ? 'Gerando com GPT Image 2…' : 'Carregando…'}
          </span>
          {imgModeNorm === 'dalle' && (
          <span style={{
            color:'rgba(255,255,255,0.32)',
            fontSize:f.w*0.02,
            letterSpacing:'-0.011em',
          }}>GPT Image 2 · OpenAI · ~30s por slide</span>
          )}
        </div>
      )}

      {sandwichSkin && (() => {
        const hasHdr = !!(brand.cultureHeaderLeft || '').trim() || !!(brand.cultureHeaderYear || '').trim();
        const onPhoto = !!(slide.bgImage && imgReady && !imgErr);
        const barMuted = onPhoto ? 'rgba(255,255,255,0.62)' : 'rgba(29,29,31,0.45)';
        return (
          <>
            {hasHdr && (
              <div style={{
                position:'absolute', top:f.h*0.028, left:f.w*0.05, right:f.w*0.16, zIndex:24,
                display:'flex', justifyContent:'space-between', alignItems:'center', gap:f.w*0.02,
              }}>
                <span style={{
                  fontSize:f.w*0.022, color:barMuted, fontFamily:bodyFF, fontWeight:400, letterSpacing:'-0.011em',
                  maxWidth:'34%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                }}>{(brand.cultureHeaderLeft || '').trim()}</span>
                <span style={{
                  flex:1, textAlign:'center', fontSize:f.w*0.022, color:barMuted, fontFamily:bodyFF, fontWeight:600,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                }}>{brand.handle}</span>
                <span style={{ fontSize:f.w*0.022, color:barMuted, fontFamily:bodyFF }}>
                  {(brand.cultureHeaderYear || '').trim()}{(brand.cultureHeaderYear || '').trim() ? ' //' : ''}
                </span>
              </div>
            )}
            {showCultureIdx && (
              <div style={{
                position:'absolute', top:f.h*0.032, right:f.w*0.05, zIndex:26,
                background: onPhoto ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.07)',
                color: onPhoto ? '#fff' : '#1d1d1f',
                padding:`${f.h*0.006}px ${f.w*0.022}px`, borderRadius:999,
                fontSize:f.w*0.026, fontWeight:600, fontFamily:bodyFF, letterSpacing:'-0.02em',
              }}>{num}/{total}</div>
            )}
          </>
        );
      })()}

      {/* Handle badge */}
      {brand.showHandle && slide.showHandle && !hideInstaBadge && (
        <div {...mov('handleBadge', {
          ...vcHandleBadgeBoxPositionStyle(brand),
          display:'flex', alignItems:'center', gap:f.w*0.012,
          background:'rgba(255,255,255,0.08)',
          backdropFilter:'blur(12px)',
          padding:`${f.h*0.01}px ${f.w*0.022}px`,
          borderRadius:999,
          border:'1px solid rgba(255,255,255,0.12)',
        })}>
          <div style={{
            width:f.w*0.034, height:f.w*0.034, borderRadius:'50%',
            background:'conic-gradient(from 45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
            display:'flex', alignItems:'center', justifyContent:'center',
            flexShrink: 0,
          }}>
            <div style={{
              width:'76%', height:'76%', borderRadius:'50%',
              overflow:'hidden',
              background: brand.handleAvatar ? '#0a0a0a' : bg,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {brand.handleAvatar ? (
                <img
                  src={brand.handleAvatar}
                  alt=""
                  draggable={false}
                  style={vcHandleAvatarImgStyle(brand)}
                />
              ) : (
                <VcHandleAvatarFallback f={f} bg={bg} />
              )}
            </div>
          </div>
          <span style={{ color:brand.titleColor, fontSize:f.w*0.022, fontWeight:600, fontFamily: bodyFF, letterSpacing:'-0.01em' }}>
            {vcHandleLabel(brand)}
          </span>
        </div>
      )}

      {/* Main content */}
      {(() => {
        const inset = (slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET);
        const padH = f.w * (0.04 + inset * 0.004);
        const padVTop = f.h * (0.09 + inset * 0.003);
        const padVBot = Math.max(
          f.h * (0.06 + inset * 0.003),
          vcFooterOrnamentReservePx(brand, f),
        );
        const shadow = slide.textShadow !== false
          ? '0 2px 24px rgba(0,0,0,0.85), 0 1px 6px rgba(0,0,0,0.95)'
          : 'none';
        const textBgColor = slide.textBg
          ? `rgba(0,0,0,${(slide.textBgOpacity ?? 55) / 100 * 0.75})`
          : 'transparent';
        // Com o bloco deslocado, a moldura não pode recortar: quem limita passa
        // a ser a borda do card. Vale no editor e na exportação — senão o que
        // se vê ao arrastar não é o que sai no PNG.
        const textoDeslocado = hasElementOffset(slide, 'text');
        return (
          <div style={{
            position:'absolute', inset:0,
            padding:`${padVTop}px ${padH}px ${padVBot}px`,
            display:'flex', flexDirection:'column',
            justifyContent:L.jc, alignItems:L.ai,
            textAlign:slide.align,
            overflow: textoDeslocado ? 'visible' : 'hidden',
            // A moldura cobre o card inteiro (inset:0). Deixá-la clicável
            // engolia o clique da zona da foto — só o bloco de texto por dentro
            // é que recebe ponteiro.
            pointerEvents: 'none',
            ...VC_TEXT_ZONE_STYLE,
          }}>
            <div {...mov('text', {
              pointerEvents: movableElements ? 'auto' : 'none',
              background:textBgColor,
              backdropFilter: slide.textBg ? 'blur(8px)' : 'none',
              borderRadius: slide.textBg ? f.w*0.025 : 0,
              padding: slide.textBg ? `${f.h*0.022}px ${f.w*0.04}px` : 0,
              display:'inline-flex', flexDirection:'column',
              alignItems:
                slide.align==='center'  ? 'center'   :
                slide.align==='right'   ? 'flex-end' :
                slide.align==='justify' ? 'stretch'  :
                                          'flex-start',
              gap: f.h*0.018,
              maxWidth:'92%',
            })}>
              {/* Star ornament (8-pontas) — usado em presets como Case Study Neon.
                  Centrado independente do align do título. */}
              {brand.showStarOrnament && (
                <svg
                  viewBox="0 0 24 24"
                  width={f.w*0.045}
                  height={f.w*0.045}
                  style={{ alignSelf:'center', flexShrink:0 }}
                  aria-hidden
                >
                  <g fill={brand.accent || displayTitleInk}>
                    <polygon points="12,1 13,11 23,12 13,13 12,23 11,13 1,12 11,11"/>
                    <g transform="rotate(45 12 12)">
                      <polygon points="12,3 13,11 21,12 13,13 12,21 11,13 3,12 11,11"/>
                    </g>
                  </g>
                </svg>
              )}
              {/* Eyebrow — texto MAIÚSCULAS pequeno acima do título.
                  Usado em refs editoriais (NBA, NMLSS, Cadore). */}
              {slide.eyebrowText && (
                <span style={{
                  fontSize: f.w*0.024,
                  fontFamily: bodyFF,
                  fontWeight: 600,
                  color: displayBodyInk,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  lineHeight: 1.3,
                  margin: 0,
                  alignSelf: brand.showStarOrnament ? 'center' : 'auto',
                  textShadow: shadow,
                }}>{slide.eyebrowText}</span>
              )}
              <h1 {...mov('title', {
                color: displayTitleInk, fontFamily: titleFF,
                fontSize:f.w*0.084*(slide.titleSize/100),
                lineHeight:(slide.titleLeading ?? 105)/100,
                position: 'relative',
                top: vcTitleOvershootShift(f.w*0.084*(slide.titleSize/100), slide.titleLeading),
                fontWeight:slide.titleWeight ?? 800,
                // tracking em centi-em: default -3 (-0.03em). User pode ir de -10 a +30 → -0.13em a +0.27em
                letterSpacing:`${(-3 + (slide.titleTracking ?? 0)) / 100}em`,
                margin:0,
                textTransform:
                  slide.titleCase === 'upper' ? 'uppercase' :
                  slide.titleCase === 'lower' ? 'lowercase' :
                  isBebas ? 'uppercase' : 'none',
                textShadow: shadow,
              })}>{cultureRichText ? (
                <CultureInlineRich
                  text={slide.title || ''}
                  destaqueSpans={slide.destaqueSpans?.title}
                  baseColor={displayTitleInk}
                  accentColor={cultureAccentCol}
                  fontFamily={titleFF}
                  fontSize={f.w*0.084*(slide.titleSize/100)}
                  lineHeight={(slide.titleLeading ?? 105)/100}
                  fontWeight={slide.titleWeight ?? 800}
                  letterSpacing={`${(-3 + (slide.titleTracking ?? 0)) / 100}em`}
                />
              ) : slide.title}</h1>
              {/* Subtítulo — preset controla via brand.subtitleVisible/Weight/Case
                  (presets editoriais como Sports/NMLSS escondem subtítulo pra
                  não competir com eyebrow+título). */}
              {slide.subtitle && brand.subtitleVisible !== false && (
                cultureRichText ? (
                  <div {...mov('subtitle', {
                    margin:0,
                    maxWidth:'100%',
                    letterSpacing:`${(-1 + (slide.subTracking ?? 0)) / 100}em`,
                    textShadow: shadow,
                  })}>
                    <CultureRichParagraphs
                      text={slide.subtitle}
                      destaqueSpans={slide.destaqueSpans?.subtitle}
                      ink={displayBodyInk}
                      accentColor={cultureAccentCol}
                      fontFamily={bodyFF}
                      fontSize={f.w*0.028*(slide.subSize/100)}
                      lineHeight={(slide.subLeading ?? 150)/100}
                      fontWeight={brand.subtitleWeight ?? 400}
                      letterSpacing={`${(-1 + (slide.subTracking ?? 0)) / 100}em`}
                      paraGap={f.h*0.010}
                    />
                  </div>
                ) : (
                <p {...mov('subtitle', {
                  color: displayBodyInk, fontFamily: bodyFF,
                  fontSize:f.w*0.028*(slide.subSize/100),
                  lineHeight:(slide.subLeading ?? 150)/100,
                  fontWeight: brand.subtitleWeight ?? 400,
                  margin:0,
                  letterSpacing:`${(-1 + (slide.subTracking ?? 0)) / 100}em`,
                  textShadow: shadow,
                  textTransform: brand.subtitleCase === 'upper' ? 'uppercase'
                    : brand.subtitleCase === 'lower' ? 'lowercase' : 'none',
                  fontStyle: brand.subtitleItalic ? 'italic' : 'normal',
                })}>{slide.subtitle}</p>
              ))}
              {/* After-title text (Bold Promo Pink REF 4): linha curta abaixo
                  do título. Suporta strikethroughText pra preço antigo riscado:
                  "DE R$99" riscado + "POR R$0,00 (100% GRATUITO)" intacto. */}
              {slide.afterTitleText && (
                <p style={{
                  color: displayTitleInk, fontFamily: titleFF,
                  fontSize: f.w*0.034,
                  fontWeight: slide.titleWeight ?? 800,
                  letterSpacing: `${(-3 + (slide.titleTracking ?? 0)) / 100}em`,
                  margin: 0,
                  textTransform: slide.titleCase === 'upper' ? 'uppercase' : 'none',
                  textShadow: shadow,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: f.w*0.014,
                  alignItems: 'baseline',
                }}>
                  {slide.strikethroughText && (
                    <span style={{
                      textDecoration: 'line-through',
                      textDecorationColor: brand.accent || '#dc2626',
                      textDecorationThickness: f.w*0.004,
                      opacity: 0.85,
                    }}>{slide.strikethroughText}</span>
                  )}
                  <span>{slide.afterTitleText}</span>
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Footer bar 3 colunas (Authority Black REF 11): Topic / Brought by / Save.
          Texto pequeno MAIÚSCULAS distribuído no rodapé, similar ao header
          mas em baixo. Cada coluna tem label cinza + valor branco em 2 linhas. */}
      {(() => {
        const fLeft = brand.footerBarLeft;
        const fCenter = brand.footerBarCenter;
        const fRight = brand.footerBarRight;
        const hasFooter = !!(fLeft || fCenter || fRight);
        if (!hasFooter) return null;
        const labelColor = slide.bgImage ? 'rgba(255,255,255,0.55)' : (displayBodyInk || '#888');
        const valueColor = slide.bgImage ? '#ffffff' : (displayTitleInk || '#000');
        const Col = ({ data }) => {
          if (!data) return <div style={{ flex:1 }}/>;
          const [label, value] = String(data).split('|');
          return (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:f.h*0.004 }}>
              <span style={{ fontSize: f.w*0.020, fontFamily: bodyFF, color: labelColor,
                letterSpacing:'0.04em', textTransform:'uppercase' }}>{label || ''}</span>
              {value && (
                <span style={{ fontSize: f.w*0.022, fontFamily: bodyFF, color: valueColor,
                  fontWeight: 700 }}>{value}</span>
              )}
            </div>
          );
        };
        return (
          <div {...mov('footerBar', {
            position:'absolute', bottom: f.h*0.038, left: f.w*0.05, right: f.w*0.05,
            zIndex: 25, display:'flex', justifyContent:'space-between', alignItems:'flex-start',
            gap: f.w*0.02, pointerEvents: movableElements ? 'auto' : 'none',
          })}>
            <Col data={fLeft}/>
            <Col data={fCenter}/>
            <Col data={fRight}/>
          </div>
        );
      })()}

      {/* Footer pill com seta — usado em presets como Case Study Neon
          (CTA verde-neon) e Reflexivo Cream (handle pill). Texto + seta
          circular contrastante. Cor de fundo = brand.accent. */}
      {brand.footerPillText && (() => {
        const pillBg = brand.footerPillBg || brand.accent || '#0a0a0a';
        const pillFg = brand.footerPillFg || (pillBg === brand.accent ? '#0a0a0a' : '#ffffff');
        // Seta opcional — REF 2/5 mostram, REF 3 (Mood Sépia hashtag) não.
        // Default true se undefined; só esconde quando explicitamente false.
        const showArrow = brand.footerPillArrow !== false;
        // Padding-right encolhe quando não tem seta (visual mais compacto).
        const padRight = showArrow ? f.w*0.014 : f.w*0.028;
        return (
          <div {...mov('pill', {
            position:'absolute', bottom: f.h*0.058,
            left:'50%', transform:'translateX(-50%)',
            zIndex:25, pointerEvents: movableElements ? 'auto' : 'none',
          })}>
            <div style={{
              background: pillBg, color: pillFg,
              padding: `${f.h*0.012}px ${padRight}px ${f.h*0.012}px ${f.w*0.028}px`,
              borderRadius: 9999,
              display:'inline-flex', alignItems:'center', gap: f.w*0.018,
              fontSize: f.w*0.026, fontWeight:700, fontFamily: bodyFF,
              letterSpacing:'-0.011em', whiteSpace:'nowrap',
              textTransform: 'uppercase',
              boxShadow:'0 4px 16px rgba(0,0,0,0.18)',
            }}>
              {brand.footerPillText}
              {showArrow && (
                <span style={{
                  width: f.w*0.05, height: f.w*0.05, borderRadius:'50%',
                  background: pillFg, color: pillBg,
                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                  fontSize: f.w*0.030, fontWeight:700, lineHeight:1,
                  flexShrink:0,
                }}>→</span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Logo da marca — renderiza em qualquer canto, baseado no brand.logoPosition */}
      {brand.logo && (() => {
        // Se o handle está no topo, evita conflito com a logo (desloca pra mais longe)
        const handleAtTop = brand.showHandle;
        const pos = brand.logoPosition || 'tr';
        const margin = f.w * 0.045;
        const sizePx = (brand.logoSize ?? 30) * (f.w / 1080); // proporção em relação ao slide
        // Quando o handle está no topo direito e a logo no topo direito, desloca a logo pra baixo do handle
        const topOffset = handleAtTop && pos.startsWith('t') && pos.endsWith('r') ? margin + f.h * 0.05 : margin;
        const style = {
          position:'absolute',
          width: sizePx, height: sizePx,
          opacity: (brand.logoOpacity ?? 90) / 100,
          backgroundImage: `url(${brand.logo})`,
          backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
        };
        if (pos === 'tl') Object.assign(style, { top: margin,    left: margin });
        if (pos === 'tr') Object.assign(style, { top: topOffset, right: margin });
        if (pos === 'bl') Object.assign(style, { bottom: margin, left: margin });
        if (pos === 'br') Object.assign(style, { bottom: margin, right: margin });
        return <div {...mov('logo', style)} aria-hidden/>;
      })()}
    </div>
  );
  }

  const surfaceQuick = (sandwich || cultureStatFlat) ? cultureResolveSurface(slide, num) : null;
  const lightCultureOuter = resolveSlideBrandBg(brand, slideIdx, slide) || '#fafafc';
  const outerBg = surfaceQuick
    ? (surfaceQuick === 'dark' ? cultureDarkBackdropFromBrand(brand.bg) : surfaceQuick === 'accent' ? (brand.accent || '#000000') : lightCultureOuter)
    : bg;

  const showSwipe = slide.showSwipeCue !== false
    && brand.showSwipeCue !== false
    && total > 1
    && slideIdx < total - 1
    && getComposition(slide.composition)?.showSwipeCue !== false;
  const showEdgePeek = !!(slide.edgePeek || getComposition(slide.composition)?.edgePeek);

  return (
    <div style={{
      width:f.w*scale, height:f.h*scale,
      position:'relative', overflow:'hidden',
      borderRadius: scale < 0.9 ? 10 : 0,
      flexShrink:0, background: outerBg,
    }}>
      <div style={{ transform:`scale(${scale})`, transformOrigin:'top left', width:f.w, height:f.h, position:'relative' }}>
        {inner}
        {showEdgePeek && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: f.w * 0.028,
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.18))',
              pointerEvents: 'none',
              zIndex: 40,
            }}
          />
        )}
        {showSwipe && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: f.w * 0.028,
              top: '50%',
              transform: 'translateY(-50%)',
              width: f.w * 0.055,
              height: f.w * 0.055,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.35)',
              color: '#F2EDE4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: f.w * 0.032,
              fontWeight: 600,
              fontFamily: 'var(--font-ui), system-ui, sans-serif',
              pointerEvents: 'none',
              zIndex: 41,
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          >
            →
          </div>
        )}
      </div>
    </div>
  );
});

/** Posição absoluta da pílula @ no card — % do cartão (canto superior esquerdo do badge). */
function vcHandleBadgeBoxPositionStyle(brand) {
  const x = typeof brand?.handleBadgeX === 'number' ? Math.min(100, Math.max(0, brand.handleBadgeX)) : 5;
  const y = typeof brand?.handleBadgeY === 'number' ? Math.min(100, Math.max(0, brand.handleBadgeY)) : 4;
  return {
    position: 'absolute',
    left: `${x}%`,
    top: `${y}%`,
    zIndex: 22,
  };
}

/**
 * Badge do @ sem foto carregada. Era um anel vazio, que lido em miniatura
 * parece defeito de render; um emoji de foto diz "põe a tua aqui".
 */
const VC_HANDLE_AVATAR_EMOJI = '📷';

/** Texto do badge do @. Sem handle configurado mostra o placeholder, senão o
 *  badge saía como um anel solto sem nada ao lado. */
function vcHandleLabel(brand) {
  const h = String(brand?.handle || '').trim();
  if (!h) return PLACEHOLDER_HANDLE;
  return h.startsWith('@') ? h : `@${h}`;
}

function VcHandleAvatarFallback({ f, bg }) {
  return (
    <div style={{
      width: '100%', height: '100%', borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: f.w * 0.017, lineHeight: 1, userSelect: 'none',
    }}>
      <span aria-hidden>{VC_HANDLE_AVATAR_EMOJI}</span>
    </div>
  );
}

/** Foto do @ no badge: posição, rotação completa e zoom dentro do círculo (object-fit + transform). */
function vcHandleAvatarImgStyle(brand) {
  const x = typeof brand?.handleAvatarPosX === 'number' ? Math.min(100, Math.max(0, brand.handleAvatarPosX)) : 50;
  const y = typeof brand?.handleAvatarPosY === 'number' ? Math.min(100, Math.max(0, brand.handleAvatarPosY)) : 50;
  const rotRaw = typeof brand?.handleAvatarRotate === 'number' ? brand.handleAvatarRotate : 0;
  const rot = ((rotRaw % 360) + 360) % 360;
  const zoomPct = typeof brand?.handleAvatarZoom === 'number' ? Math.min(220, Math.max(85, brand.handleAvatarZoom)) : 100;
  const sc = zoomPct / 100;
  return {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: `${x}% ${y}%`,
    display: 'block',
    transform: `rotate(${rot}deg) scale(${sc})`,
    transformOrigin: `${x}% ${y}%`,
  };
}

export {
  cultureDarkBackdropFromBrand,
  vcCustomBodyFace,
  effectiveBodyFontFamily,
  LAYOUT_POS_LAB_ROWS,
  LAYOUTS,
  DEFAULT_LAYOUT,
  PHOTO_REGION_IDS,
  normalizePhotoRegion,
  VC_PHOTO_ZONE_HIT_LAYER_STYLE,
  normalizeSlideImgMode,
  slideStoredPresentationCssFilter,
  cultureResolveSurface,
  VC_TEXT_ZONE_STYLE,
  canvasClassicTitlePaddingXPx,
  canvasClassicSubtitlePaddingXPx,
  canvasCultureSandwichPaddingXPx,
  canvasCultureSandwichBottomPaddingXPx,
  ClassicCanvasInner,
  ClassicLegadoInsetPhotoColumn,
  SlideCardInner,
  vcHandleBadgeBoxPositionStyle,
  vcHandleAvatarImgStyle,
};
