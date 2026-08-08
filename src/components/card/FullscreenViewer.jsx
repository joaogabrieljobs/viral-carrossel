// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useState, useEffect, useRef } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import { useScrollLock } from '../../hooks/useScrollLock.js';
import { FORMATS } from '../../utils/formats.js';
import { FULLSCREEN_IMG_ADJ_ROWS, FullscreenImageAdjustBar } from './FullscreenImageAdjustBar.jsx';

/** Ajustes de imagem apenas para preview (ex.: tela cheia); valores típicos −50…+50, 0 = neutro. */
const PRESENTATION_IMG_ADJ_KEYS = ['exposure', 'brightness', 'contrast', 'color', 'blacks', 'tonalidade'];

const DEFAULT_PRESENTATION_IMG_ADJUST = Object.freeze({
  exposure: 0,
  brightness: 0,
  contrast: 0,
  color: 0,
  blacks: 0,
  tonalidade: 0,
});

function normalizePresentationImgAdjust(raw) {
  const o = typeof raw === 'object' && raw ? raw : {};
  const out = { ...DEFAULT_PRESENTATION_IMG_ADJUST };
  const clampN = (k, lo, hi) => {
    const x = typeof o[k] === 'number' && Number.isFinite(o[k]) ? o[k] : 0;
    return Math.round(Math.max(lo, Math.min(hi, x)));
  };
  out.exposure = clampN('exposure', -50, 50);
  out.brightness = clampN('brightness', -50, 50);
  out.contrast = clampN('contrast', -50, 50);
  out.color = clampN('color', -50, 50);
  out.blacks = clampN('blacks', -50, 50);
  out.tonalidade = clampN('tonalidade', -45, 45);
  return out;
}

function buildPresentationImageFilter(vals) {
  const v = normalizePresentationImgAdjust(vals);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const expMul = Math.pow(2, clamp(v.exposure / 100, -0.8, 0.8));
  const briMul = clamp(1 + v.brightness / 120, 0.65, 1.45);
  const blkLift = clamp(1 + v.blacks / 130, 0.72, 1.35);
  const bright = clamp(expMul * briMul * blkLift, 0.22, 2.85);
  const contrastPct = clamp(100 + v.contrast * 0.55 - v.blacks * 0.1, 32, 200);
  const satPct = clamp(100 + v.color * 1.05, 0, 220);
  const hue = clamp(v.tonalidade, -45, 45);
  return `brightness(${bright}) contrast(${contrastPct}%) saturate(${satPct}%) hue-rotate(${hue}deg)`;
}

function presentationAdjustIsNeutral(v) {
  const n = normalizePresentationImgAdjust(v);
  return !PRESENTATION_IMG_ADJ_KEYS.some((k) => n[k] !== 0);
}

/** Compara dois conjuntos já normalizados (ou brutos antes de normalizar). */
function presentationImgAdjustEquivalent(a, b) {
  const na = normalizePresentationImgAdjust(a);
  const nb = normalizePresentationImgAdjust(b);
  return PRESENTATION_IMG_ADJ_KEYS.every((k) => na[k] === nb[k]);
}

function FullscreenViewer({ open, onClose, slides, fmt, brand, activeIdx, setActiveIdx, onSavePresentationAdjust, creativePreset = 'livre' }) {
  useScrollLock(open);
  const touchRef = useRef({ x:0, y:0 });
  const [size, setSize] = useState({ w:0, h:0 });
  const [photoAdjustOpen, setPhotoAdjustOpen] = useState(false);
  /** Rascunho da tela cheia: apenas slides com entrada explícita; ausente = usar `slide.presentationImgAdjust`. */
  const [imgAdjBySlide, setImgAdjBySlide] = useState({});

  useEffect(() => {
    if (!open) {
      setPhotoAdjustOpen(false);
      return;
    }
    const upd = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (photoAdjustOpen) setPhotoAdjustOpen(false);
        else onClose();
      }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); setActiveIdx(Math.max(0, activeIdx - 1)); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setActiveIdx(Math.min(slides.length - 1, activeIdx + 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, activeIdx, slides.length, setActiveIdx, onClose, photoAdjustOpen]);

  if (!open || !slides[activeIdx]) return null;

  const activeSlideFs = slides[activeIdx];
  const slideFsId = activeSlideFs.id;
  const hasBgImageFs = !!activeSlideFs.bgImage;

  const overlayDraftFs = imgAdjBySlide[slideFsId];
  const adjFs =
    overlayDraftFs !== undefined
      ? normalizePresentationImgAdjust(overlayDraftFs)
      : normalizePresentationImgAdjust(activeSlideFs.presentationImgAdjust);
  const presentationImgFilterFs =
    hasBgImageFs && !presentationAdjustIsNeutral(adjFs)
      ? buildPresentationImageFilter(adjFs)
      : null;
  const fsAdjDirtyUi = !presentationAdjustIsNeutral(adjFs);

  const fsPendingPersist =
    slides.some((sl) => {
      if (!Object.prototype.hasOwnProperty.call(imgAdjBySlide, sl.id)) return false;
      return !presentationImgAdjustEquivalent(sl.presentationImgAdjust, imgAdjBySlide[sl.id]);
    }) && !!onSavePresentationAdjust;

  const bumpFsAdj = (key, delta) => {
    if (!hasBgImageFs) return;
    setImgAdjBySlide((prev) => {
      const row = FULLSCREEN_IMG_ADJ_ROWS.find((r) => r.key === key);
      if (!row) return prev;
      const prevDraft = prev[slideFsId];
      const base =
        prevDraft !== undefined
          ? { ...normalizePresentationImgAdjust(prevDraft) }
          : { ...normalizePresentationImgAdjust(activeSlideFs.presentationImgAdjust) };
      let nextVal = base[key] + delta;
      nextVal = Math.round(nextVal / row.step) * row.step;
      nextVal = Math.max(row.min, Math.min(row.max, nextVal));
      return { ...prev, [slideFsId]: { ...base, [key]: nextVal } };
    });
  };

  const setFsAdjKey = (key, rawVal) => {
    if (!hasBgImageFs) return;
    setImgAdjBySlide((prev) => {
      const row = FULLSCREEN_IMG_ADJ_ROWS.find((r) => r.key === key);
      if (!row) return prev;
      const prevDraft = prev[slideFsId];
      const base =
        prevDraft !== undefined
          ? { ...normalizePresentationImgAdjust(prevDraft) }
          : { ...normalizePresentationImgAdjust(activeSlideFs.presentationImgAdjust) };
      let nextVal = Math.round(Number(rawVal));
      if (!Number.isFinite(nextVal)) return prev;
      nextVal = Math.round(nextVal / row.step) * row.step;
      nextVal = Math.max(row.min, Math.min(row.max, nextVal));
      return { ...prev, [slideFsId]: { ...base, [key]: nextVal } };
    });
  };

  const resetFsSlideAdj = () => {
    setImgAdjBySlide((prev) => ({
      ...prev,
      [slideFsId]: { ...DEFAULT_PRESENTATION_IMG_ADJUST },
    }));
  };

  const submitFsPersist = () => {
    if (!onSavePresentationAdjust || !fsPendingPersist) return;
    onSavePresentationAdjust(imgAdjBySlide);
  };

  const f = FORMATS[fmt] || FORMATS.carrossel;
  const padding = 32;
  const bottomReserve = photoAdjustOpen ? 232 : 108;
  const scale = Math.min(
    (size.w - padding * 2) / f.w,
    (size.h - padding * 2 - bottomReserve) / f.h,
    1,
  );
  const realScale = Number.isFinite(scale) && scale > 0 ? scale : 0.8;

  const onTouchStart = e => { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = e => {
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) setActiveIdx(Math.min(slides.length - 1, activeIdx + 1));
      else setActiveIdx(Math.max(0, activeIdx - 1));
    }
  };

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Apresentação em tela cheia"
      style={{
        position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.96)',
        display:'flex', alignItems:'center', justifyContent:'center',
        animation:'fadeUp 0.2s var(--ease-smooth)',
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, padding:'14px 20px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background:'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
        zIndex:2,
      }}>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', fontFamily:'var(--font-mono)', letterSpacing:'0.08em' }}>
          {String(activeIdx+1).padStart(2,'0')} / {String(slides.length).padStart(2,'0')}
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar tela cheia"
          style={{
            display:'flex', alignItems:'center', gap:6,
            background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)',
            color:'#fff', borderRadius:8, padding:'6px 12px', cursor:'pointer',
            fontSize:12, fontFamily:'var(--font-ui)', fontWeight:600,
          }}
        >
          <X size={13}/> ESC para sair
        </button>
      </div>

      {/* Slide */}
      <div style={{ pointerEvents:'none' }}>
        <SlideCard
          slide={activeSlideFs} fmt={fmt} brand={brand}
          num={activeIdx+1} total={slides.length} scale={realScale}
          creativePreset={creativePreset}
          showCanvasChrome={false}
          {...(overlayDraftFs !== undefined
            ? { presentationImgFilter: presentationImgFilterFs }
            : {})}
        />
      </div>

      {/* Setas */}
      {activeIdx > 0 && (
        <button
          onClick={() => setActiveIdx(activeIdx - 1)}
          aria-label="Slide anterior"
          style={{
            position:'absolute', left:24, top:'50%', transform:'translateY(-50%)',
            width:48, height:48, borderRadius:'50%',
            background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)',
            color:'#fff', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            backdropFilter:'blur(8px)',
          }}
        >‹</button>
      )}
      {activeIdx < slides.length - 1 && (
        <button
          onClick={() => setActiveIdx(activeIdx + 1)}
          aria-label="Próximo slide"
          style={{
            position:'absolute', right:24, top:'50%', transform:'translateY(-50%)',
            width:48, height:48, borderRadius:'50%',
            background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)',
            color:'#fff', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            backdropFilter:'blur(8px)', fontSize:24, lineHeight:1,
          }}
        >›</button>
      )}

      {/* Ajustes de imagem — abre sob demanda (botão ou tecla já documentada na barra) */}
      <div
        style={{
          position: 'absolute',
          bottom: 58,
          left: 0,
          right: 0,
          zIndex: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto', width: '100%', display: 'flex', justifyContent: 'center', paddingLeft: 20, paddingRight: 20, boxSizing: 'border-box' }}>
          {!photoAdjustOpen ? (
            <button
              type="button"
              disabled={!hasBgImageFs}
              onClick={() => setPhotoAdjustOpen(true)}
              aria-label={
                hasBgImageFs ? 'Abrir ajustes da foto' : 'Ajustes da foto indisponíveis sem imagem de fundo'
              }
              title={hasBgImageFs ? undefined : 'Adicione uma imagem de fundo para ajustar.'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 18px',
                borderRadius: 9999,
                border: `1px solid ${hasBgImageFs ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)'}`,
                background: hasBgImageFs ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                color: hasBgImageFs ? '#fff' : 'rgba(255,255,255,0.35)',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'var(--font-ui)',
                letterSpacing: '-0.022em',
                cursor: hasBgImageFs ? 'pointer' : 'not-allowed',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                transition: 'background 0.15s, transform 0.1s',
              }}
              onMouseDown={(e) => {
                if (hasBgImageFs) e.currentTarget.style.transform = 'scale(0.95)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <SlidersHorizontal size={14} aria-hidden strokeWidth={2.25} />
              Ajustar foto
            </button>
          ) : (
            <FullscreenImageAdjustBar
              disabled={!hasBgImageFs}
              adj={adjFs}
              onBump={bumpFsAdj}
              onSetKey={setFsAdjKey}
              onResetSlide={resetFsSlideAdj}
              onSave={submitFsPersist}
              anyDirty={fsAdjDirtyUi}
              hasPendingPersist={fsPendingPersist}
              onClose={() => setPhotoAdjustOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Dots */}
      <div style={{
        position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)',
        display:'flex', gap:6, padding:'8px 14px',
        background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)',
        borderRadius:99, backdropFilter:'blur(8px)',
      }}>
        {slides.map((_, i) => (
          <button
            key={i}
            aria-label={`Ir para slide ${i+1}`}
            onClick={() => setActiveIdx(i)}
            style={{
              width: i === activeIdx ? 22 : 8, height:8, borderRadius:99,
              background: i === activeIdx ? '#fff' : 'rgba(255,255,255,0.35)',
              border:'none', padding:0, cursor:'pointer',
              transition:'width 0.18s var(--ease-smooth), background 0.18s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export {
  PRESENTATION_IMG_ADJ_KEYS,
  DEFAULT_PRESENTATION_IMG_ADJUST,
  normalizePresentationImgAdjust,
  buildPresentationImageFilter,
  presentationAdjustIsNeutral,
  presentationImgAdjustEquivalent,
  FullscreenViewer,
};
