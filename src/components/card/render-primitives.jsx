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
          <span key={i} data-vc-destaque style={{
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
  paragraphProps = null,
}) {
  const full = text ?? '';
  const windows = listCultureParagraphWindows(full);
  const globSpans = unifyAccentIntervalsUtf16(full, destaqueSpans);
  if (!windows.length) return null;
  return windows.map((w, idx) => {
    const extra = typeof paragraphProps === 'function'
      ? (paragraphProps(idx) || {})
      : (paragraphProps || {});
    return (
    <p
      key={idx}
      {...extra}
      style={{
        margin: 0,
        marginBottom: idx < windows.length - 1 ? paraGap : 0,
        textAlign: 'left',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        ...(extra.style || {}),
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
    );
  });
}

// ─── OVERFLOW SCALER ──────────────────────────────────────────────────────────
// Mede o próprio container e fornece um scale factor (via render-prop) que pode
// ser aplicado uniformemente aos fontSize dos textos filhos.
// Diferente do AutoFitText (que envolve UM elemento de texto), o OverflowScaler
// permite que MÚLTIPLOS elementos (title + subtitle + body + photo zone) coexistam
// dentro dele, e o scale uniforme garante hierarquia tipográfica preservada.
//
// Uso:
//   <OverflowScaler
//     containerStyle={{...}}
//     deps={[title, subtitle, body]}
//     minScale={0.7}
//     hardMinScale={0.48}
//     strictMinScale
//   >
//     {(scale) => (<>... fontSize={baseSize * scale} ...</>)}
//   </OverflowScaler>
/** `containerProps` passa handlers ao contentor (usado pelo arrasto livre). */
function overflowScaleFloor(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0.28, Math.min(1, parsed));
}

// Último recurso para conteúdo excepcionalmente denso. A geração respeita os
// limites editoriais, e este piso mantém a menor tipografia legível. Conteúdo
// além desta capacidade deve ser redistribuído entre slides em vez de virar
// caracteres quase invisíveis.
const OVERFLOW_ABSOLUTE_MIN_SCALE = 0.28;

function overflowFitRatio(available, content) {
  const parsedAvailable = Number(available);
  const parsedContent = Number(content);
  if (!Number.isFinite(parsedAvailable) || parsedAvailable <= 0) return 1;
  if (!Number.isFinite(parsedContent) || parsedContent <= 0) return 1;
  return Math.min(1, parsedAvailable / parsedContent);
}

/**
 * Calcula o passo seguinte sem perder a hierarquia entre os filhos: todos os
 * tamanhos continuam a receber o mesmo multiplicador. `minScale` e o piso
 * editorial normal. Se ainda houver corte nesse piso, uma segunda medicao pode
 * recorrer a `hardMinScale`, reservado para conteudo excepcionalmente denso.
 * Persistindo o corte nesse segundo piso, as medicoes seguintes podem chegar ao
 * piso absoluto. Altura e largura participam do mesmo calculo deterministico.
 */
function nextOverflowScale({
  currentScale,
  clientHeight,
  contentHeight,
  clientWidth = 0,
  contentWidth = 0,
  photoHeight = 0,
  minScale = AUTOFIT_MIN_SCALE,
  hardMinScale = minScale,
  absoluteMinScale = OVERFLOW_ABSOLUTE_MIN_SCALE,
  strictMinScale = false,
}) {
  const softFloor = overflowScaleFloor(minScale, AUTOFIT_MIN_SCALE);
  const current = strictMinScale
    ? Math.max(softFloor, overflowScaleFloor(currentScale, 1))
    : overflowScaleFloor(currentScale, 1);
  const hardFloor = strictMinScale
    ? softFloor
    : Math.min(softFloor, overflowScaleFloor(hardMinScale, softFloor));
  const absoluteFloor = strictMinScale
    ? softFloor
    : Math.min(
      hardFloor,
      overflowScaleFloor(absoluteMinScale, OVERFLOW_ABSOLUTE_MIN_SCALE),
    );
  const fixedPhoto = Math.max(0, Number(photoHeight) || 0);
  const parsedClientHeight = Number(clientHeight);
  const parsedContentHeight = Number(contentHeight);
  const hasVerticalMeasurement = Number.isFinite(parsedClientHeight)
    && parsedClientHeight > 0
    && Number.isFinite(parsedContentHeight)
    && parsedContentHeight > 0;
  const textContent = Math.max(1, parsedContentHeight - fixedPhoto);
  const textAvailable = Math.max(1, parsedClientHeight - fixedPhoto);
  const verticalRatio = hasVerticalMeasurement
    ? overflowFitRatio(textAvailable, textContent)
    : 1;
  const horizontalRatio = overflowFitRatio(clientWidth, contentWidth);
  const fitRatio = Math.min(verticalRatio, horizontalRatio);
  if (fitRatio >= 1) return current;

  const desired = current * fitRatio * 0.98;
  const reachedSoftFloor = current <= softFloor + 0.003;
  const reachedHardFloor = current <= hardFloor + 0.003;
  const floor = !reachedSoftFloor
    ? softFloor
    : reachedHardFloor
      ? absoluteFloor
      : hardFloor;
  return Math.min(current, Math.max(floor, desired));
}

/**
 * Invalida a medição quando uma fonte ou o tamanho do contentor muda.
 *
 * A invalidação é separada da escala: gravar `1` sobre uma escala que já era
 * `1` não provoca render no React, embora a fonte recém-aplicada possa ter
 * alterado completamente as métricas do texto. O callback deve, portanto,
 * incrementar uma revisão própria e forçar uma nova passagem de medição.
 *
 * `environment` existe para manter este observador testável sem DOM e também
 * permite o fallback em navegadores que não oferecem FontFaceSet/ResizeObserver.
 */
function observeOverflowInvalidations(element, onInvalidate, environment = {}) {
  const doc = typeof document !== 'undefined' ? document : null;
  const win = typeof window !== 'undefined' ? window : null;
  const fonts = environment.fonts === undefined ? doc?.fonts : environment.fonts;
  const ResizeObserverImpl = environment.ResizeObserverImpl === undefined
    ? (typeof ResizeObserver !== 'undefined' ? ResizeObserver : null)
    : environment.ResizeObserverImpl;
  const requestFrame = environment.requestFrame === undefined
    ? (win?.requestAnimationFrame ? (callback) => win.requestAnimationFrame(callback) : null)
    : environment.requestFrame;
  const cancelFrame = environment.cancelFrame === undefined
    ? (win?.cancelAnimationFrame ? (id) => win.cancelAnimationFrame(id) : null)
    : environment.cancelFrame;
  const setTimer = environment.setTimer || setTimeout;
  const clearTimer = environment.clearTimer || clearTimeout;
  const fallbackDelay = Number.isFinite(environment.fallbackDelay)
    ? Math.max(0, environment.fallbackDelay)
    : 600;

  let disposed = false;
  let frameId = null;
  const invalidate = () => {
    if (disposed || frameId !== null) return;
    if (typeof requestFrame === 'function') {
      // Agrupa FontFaceSet + ResizeObserver no mesmo frame para evitar medir
      // duas vezes quando ambos notificam a aplicação da mesma fonte.
      frameId = requestFrame(() => {
        frameId = null;
        if (!disposed) onInvalidate();
      });
      return;
    }
    onInvalidate();
  };

  const fallbackTimer = setTimer(invalidate, fallbackDelay);
  const fontReady = fonts?.ready;
  if (fontReady && typeof fontReady.then === 'function') {
    fontReady.then(invalidate, () => {});
  }
  fonts?.addEventListener?.('loadingdone', invalidate);

  let resizeObserver = null;
  if (element && typeof ResizeObserverImpl === 'function') {
    resizeObserver = new ResizeObserverImpl(invalidate);
    resizeObserver.observe(element);
  }

  return () => {
    disposed = true;
    clearTimer(fallbackTimer);
    fonts?.removeEventListener?.('loadingdone', invalidate);
    resizeObserver?.disconnect?.();
    if (frameId !== null && typeof cancelFrame === 'function') {
      cancelFrame(frameId);
    }
    frameId = null;
  };
}

function OverflowScaler({
  containerStyle,
  containerProps = null,
  deps = [],
  minScale = AUTOFIT_MIN_SCALE,
  hardMinScale = minScale,
  absoluteMinScale = OVERFLOW_ABSOLUTE_MIN_SCALE,
  strictMinScale = false,
  onOverflowAtFloor = null,
  children,
}) {
  const ref = React.useRef(null);
  const [scale, setScale] = React.useState(1);
  const [overflowAtFloor, setOverflowAtFloor] = React.useState(false);
  const iterationsRef = React.useRef(0);
  const [, setMeasurementRevision] = React.useState(0);
  const callbackRef = React.useRef(onOverflowAtFloor);
  const lastNotifiedOverflowRef = React.useRef(null);
  callbackRef.current = onOverflowAtFloor;
  const strictFloor = overflowScaleFloor(minScale, AUTOFIT_MIN_SCALE);
  const effectiveScale = strictMinScale ? Math.max(strictFloor, scale) : scale;

  React.useEffect(() => {
    if (lastNotifiedOverflowRef.current === overflowAtFloor) return;
    lastNotifiedOverflowRef.current = overflowAtFloor;
    if (typeof callbackRef.current === 'function') {
      callbackRef.current(overflowAtFloor);
    }
  }, [overflowAtFloor]);

  const requestRemeasure = React.useCallback(() => {
    iterationsRef.current = 0;
    // Recomeça da escala natural para também permitir que o texto volte a
    // crescer quando a fonte carregada é mais estreita ou a zona aumenta.
    setScale(1);
    // Esta revisão é deliberadamente independente de `scale`: mesmo quando a
    // escala continua 1, uma fonte nova precisa disparar outro layout effect.
    setMeasurementRevision((revision) => revision + 1);
  }, []);

  // Reset ao trocar conteúdo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    setScale(1);
    setOverflowAtFloor(false);
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
    const clientW = el.clientWidth;
    if (clientH <= 0 && clientW <= 0) return;
    // ATENÇÃO: `scrollHeight` só enxerga transbordo para BAIXO. Estas zonas usam
    // `justify-content: flex-end` (layouts bl/bc/br), e nelas o conteúdo que não
    // cabe sai pelo TOPO — scrollHeight === clientHeight e o scaler concluía que
    // cabia, deixando o título cortado. Medir a soma real dos filhos resolve
    // para qualquer valor de justify-content.
    const cs = window.getComputedStyle(el);
    const padV = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const padH = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    // UNIDADES: `clientHeight` e `offsetHeight` são px de LAYOUT; o
    // `getBoundingClientRect` é px de ECRÃ, já multiplicado pelo `scale()` da
    // pré-visualização. Misturar os dois fazia a soma dos filhos sair 3× menor
    // na fila do desktop (escala 0.333) e o scaler concluía que cabia — o
    // título voltava a ser cortado, e só fora da escala 1 (a exportação, onde
    // isto foi testado da primeira vez, tem escala 1 e passava).
    let filhosH = 0;
    let filhoMaisLargo = 0;
    for (const filho of el.children) {
      filhosH += filho.offsetHeight || 0;
      filhoMaisLargo = Math.max(
        filhoMaisLargo,
        filho.offsetWidth || 0,
        filho.scrollWidth || 0,
      );
    }
    const contentH = Math.max(el.scrollHeight, Math.ceil(filhosH + padV));
    const contentW = Math.max(el.scrollWidth, Math.ceil(filhoMaisLargo + padH));
    const overflowsVertically = clientH > 0 && contentH > clientH + 1;
    const overflowsHorizontally = clientW > 0 && contentW > clientW + 1;
    if (!overflowsVertically && !overflowsHorizontally) {
      setOverflowAtFloor(false);
      return;
    }
    // Desconta photo zone (altura fixa, não escala)
    const photoEl = el.querySelector('[data-vc-photo-zone="1"]');
    const photoH = photoEl ? photoEl.offsetHeight || 0 : 0;
    // Estimativa: scale precisa ajustar pela razão de área (h escalada ≈ h × scale)
    // Safety factor 0.98: tira um pequeno respiro pra evitar ficar exatamente no limite,
    // mas suficientemente conservador pra não encolher demais.
    const target = nextOverflowScale({
      currentScale: effectiveScale,
      clientHeight: clientH,
      contentHeight: contentH,
      clientWidth: clientW,
      contentWidth: contentW,
      photoHeight: photoH,
      minScale,
      hardMinScale,
      absoluteMinScale,
      strictMinScale,
    });
    const isOverflowingAtStrictFloor = strictMinScale
      && effectiveScale <= strictFloor + 0.003
      && target <= strictFloor + 0.003;
    setOverflowAtFloor(isOverflowingAtStrictFloor);
    if (target < effectiveScale - 0.003) {
      setScale(target);
    } else if (strictMinScale && scale < strictFloor - 0.003) {
      setScale(strictFloor);
    }
  });
  // Re-mede ao concluir o carregamento das fontes, em carregamentos posteriores
  // e quando o contentor muda de tamanho. O timer cobre browsers antigos sem
  // FontFaceSet/ResizeObserver.
  React.useEffect(() => {
    return observeOverflowInvalidations(ref.current, requestRemeasure);
  }, [requestRemeasure]);
  return (
    <div
      ref={ref}
      {...(containerProps || {})}
      data-vc-overflow-at-floor={overflowAtFloor ? 'true' : 'false'}
      data-vc-overflow-scale={String(Number(effectiveScale.toFixed(4)))}
      style={{ ...containerStyle, ...(containerProps?.style || {}) }}
    >
      {children(effectiveScale)}
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
  OVERFLOW_ABSOLUTE_MIN_SCALE,
  nextOverflowScale,
  observeOverflowInvalidations,
  OverflowScaler,
};
