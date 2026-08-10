// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import AutoFitText from '../AutoFitText.jsx';
import { AUTOFIT_MIN_SCALE } from '../../utils/slide-design-system.js';
import { vcBgPatternDivStyle } from '../../utils/brand-visuals.js';
import { mergeUtf16AccentIntervals, unifyAccentIntervalsUtf16, cultureAccentRenderablePieces } from '../../utils/text-spans.js';

function VcBgPatternLayer({ pattern, style: extra }) {
  const st = vcBgPatternDivStyle(pattern);
  if (!st) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        ...st,
        ...(extra || {}),
      }}
    />
  );
}

/** Parágrafos separados por `\n\n+` como no preview; devolve intervalos globais UTF-16 do texto trimmed. */
function listCultureParagraphWindows(fullRaw) {
  const raw = String(fullRaw ?? '');
  const windows = [];
  const reSep = /\n\n+/g;
  let chunkStartGlob = 0;
  let m;
  while ((m = reSep.exec(raw)) !== null) {
    pushTrimmedParagraphWindow(raw, chunkStartGlob, m.index, windows);
    chunkStartGlob = m.index + m[0].length;
  }
  pushTrimmedParagraphWindow(raw, chunkStartGlob, raw.length, windows);
  return windows;
}

function pushTrimmedParagraphWindow(raw, globFrom, globTo, out) {
  const chunk = raw.slice(globFrom, globTo);
  let lead = 0;
  while (lead < chunk.length && /\s/.test(chunk[lead])) lead++;
  let trail = chunk.length - 1;
  while (trail >= lead && /\s/.test(chunk[trail])) trail--;
  if (trail < lead) return;
  const display = chunk.slice(lead, trail + 1);
  out.push({ globStart: globFrom + lead, globEnd: globFrom + trail + 1, display });
}

function clipAccentIntervalsToWindow(intervalsGlob, ws, we) {
  if (!intervalsGlob?.length) return [];
  const clipped = [];
  for (const [s, e] of intervalsGlob) {
    const a = Math.max(s, ws);
    const b = Math.min(e, we);
    if (b > a) clipped.push([a - ws, b - ws]);
  }
  return mergeUtf16AccentIntervals(clipped);
}

function CultureInlineRich({
  text,
  baseColor,
  accentColor,
  fontFamily,
  fontSize,
  lineHeight,
  fontWeight,
  letterSpacing,
  destaqueSpans,
}) {
  const wrapStyle = {
    color: baseColor,
    fontFamily,
    fontSize,
    lineHeight,
    fontWeight,
    letterSpacing,
    margin: 0,
    display: 'block',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  };
  if (text == null || text === '') return null;
  const parts = cultureAccentRenderablePieces(text, destaqueSpans);
  return (
    <span style={wrapStyle}>
      {parts.map((p, i) =>
        p.type === 'accent' ? (
          // Accent: SEMPRE visualmente distinto do base, mesmo quando a cor está washout.
          // - fontWeight 800 garante destaque acima de base 400/500/600 padrão
          // - se a cor accent estiver muito próxima do base (washout em fundos com baixo contraste),
          //   o weight extra ainda permite o usuário ver o destaque
          <span key={i} style={{
            color: accentColor,
            fontWeight: 800,
          }}>{p.v}</span>
        ) : (
          <span key={i}>{p.v}</span>
        ),
      )}
    </span>
  );
}

function CultureRichParagraphs({
  text,
  ink,
  accentColor,
  fontFamily,
  fontSize,
  lineHeight,
  fontWeight,
  letterSpacing,
  paraGap,
  destaqueSpans = null,
}) {
  const full = text ?? '';
  const windows = listCultureParagraphWindows(full);
  const globSpans = unifyAccentIntervalsUtf16(full, destaqueSpans);
  if (!windows.length) return null;
  return windows.map((w, idx) => (
    <p
      key={idx}
      style={{
        margin: 0,
        marginBottom: idx < windows.length - 1 ? paraGap : 0,
        textAlign: 'left',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <CultureInlineRich
        text={w.display}
        destaqueSpans={clipAccentIntervalsToWindow(globSpans, w.globStart, w.globEnd)}
        baseColor={ink}
        accentColor={accentColor}
        fontFamily={fontFamily}
        fontSize={fontSize}
        lineHeight={lineHeight}
        fontWeight={fontWeight}
        letterSpacing={letterSpacing}
      />
    </p>
  ));
}

// ─── OVERFLOW SCALER ──────────────────────────────────────────────────────────
// Mede o próprio container e fornece um scale factor (via render-prop) que pode
// ser aplicado uniformemente aos fontSize dos textos filhos.
// Diferente do AutoFitText (que envolve UM elemento de texto), o OverflowScaler
// permite que MÚLTIPLOS elementos (title + subtitle + body + photo zone) coexistam
// dentro dele, e o scale uniforme garante hierarquia tipográfica preservada.
//
// Uso:
//   <OverflowScaler containerStyle={{...}} deps={[title, subtitle, body]} minScale={0.7}>
//     {(scale) => (<>... fontSize={baseSize * scale} ...</>)}
//   </OverflowScaler>
/** `containerProps` passa handlers ao contentor (usado pelo arrasto livre). */
function OverflowScaler({ containerStyle, containerProps = null, deps = [], minScale = AUTOFIT_MIN_SCALE, children }) {
  const ref = React.useRef(null);
  const [scale, setScale] = React.useState(1);
  const iterationsRef = React.useRef(0);
  // Reset ao trocar conteúdo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    setScale(1);
    iterationsRef.current = 0;
  }, deps);
  // Mede e reduz se transbordou — converge em ≤6 frames
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Hard limit pra evitar loop infinito em casos patológicos
    if (iterationsRef.current > 8) return;
    iterationsRef.current++;
    const clientH = el.clientHeight;
    if (clientH <= 0) return;
    // ATENÇÃO: `scrollHeight` só enxerga transbordo para BAIXO. Estas zonas usam
    // `justify-content: flex-end` (layouts bl/bc/br), e nelas o conteúdo que não
    // cabe sai pelo TOPO — scrollHeight === clientHeight e o scaler concluía que
    // cabia, deixando o título cortado. Medir a soma real dos filhos resolve
    // para qualquer valor de justify-content.
    const cs = window.getComputedStyle(el);
    const padV = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    let filhosH = 0;
    for (const filho of el.children) filhosH += filho.getBoundingClientRect().height;
    const contentH = Math.max(el.scrollHeight, Math.ceil(filhosH + padV));
    if (contentH <= clientH + 1) return;
    // Desconta photo zone (altura fixa, não escala)
    const photoEl = el.querySelector('[data-vc-photo-zone="1"]');
    const photoH = photoEl ? photoEl.getBoundingClientRect().height : 0;
    const textContentH = Math.max(1, contentH - photoH);
    const availForText = Math.max(1, clientH - photoH);
    // Estimativa: scale precisa ajustar pela razão de área (h escalada ≈ h × scale)
    // Safety factor 0.98: tira um pequeno respiro pra evitar ficar exatamente no limite,
    // mas suficientemente conservador pra não encolher demais.
    const target = Math.max(minScale, scale * (availForText / textContentH) * 0.98);
    if (target < scale - 0.003) {
      setScale(target);
    }
  });
  // Fallback: re-medir após fontes carregarem (1s) — corrige casos onde a primeira
  // medida foi tirada antes de a fonte web aplicar
  React.useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      if (cancelled) return;
      iterationsRef.current = 0;
      // Force uma re-medida resetando pra 1 (vai re-disparar o ciclo de encolhimento)
      setScale((s) => (s < 1 ? 1 : s));
    }, 600);
    return () => { cancelled = true; clearTimeout(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return (
    <div ref={ref} {...(containerProps || {})} style={{ ...containerStyle, ...(containerProps?.style || {}) }}>
      {children(scale)}
    </div>
  );
}

export {
  VcBgPatternLayer,
  listCultureParagraphWindows,
  pushTrimmedParagraphWindow,
  clipAccentIntervalsToWindow,
  CultureInlineRich,
  CultureRichParagraphs,
  OverflowScaler,
};
