/**
 * Moldura e recorte da foto no card (pedido do João, 27/11).
 *
 * - Moldura: a zona `photo` do canvas, em % do card. Arrastar move; as alças
 *   mudam o tamanho. A imagem vai junto com a moldura.
 * - Recorte (duplo clique): a moldura fica parada e a imagem anda dentro dela
 *   (`bgX`/`bgY`, 0–100 como `background-position`) e ganha zoom (`bgZoom`).
 *
 * O arrasto da imagem é proporcional à sobra real da foto na moldura: o ponto
 * da imagem acompanha o dedo. Sem sobra num eixo, a imagem não anda nesse eixo;
 * com zoom, sobra nos dois e a faixa fina passa a ser enquadrável.
 */

export const PHOTO_FRAME_MIN_PCT = 8;
export const PHOTO_ZOOM_MIN = 100;
export const PHOTO_ZOOM_MAX = 400;
const CUSTOM_ZOOM_MIN = 50;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round2 = (value) => Math.round(value * 100) / 100;
const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/** Move a moldura sem mudar o tamanho e sem sair do card. */
export function moveFrameRect(rect, dx, dy) {
  const w = clamp(finite(rect?.w, 100), PHOTO_FRAME_MIN_PCT, 100);
  const h = clamp(finite(rect?.h, 100), PHOTO_FRAME_MIN_PCT, 100);
  return {
    x: round2(clamp(finite(rect?.x, 0) + dx, 0, 100 - w)),
    y: round2(clamp(finite(rect?.y, 0) + dy, 0, 100 - h)),
    w, h,
  };
}

/**
 * Redimensiona pela alça (`n`, `s`, `e`, `w` ou cantos `ne`, `nw`, `se`, `sw`).
 * A borda oposta à alça fica parada; tamanho mínimo e limite do card.
 */
export function resizeFrameRect(rect, handle, dx, dy) {
  let left = finite(rect?.x, 0);
  let top = finite(rect?.y, 0);
  let right = left + finite(rect?.w, 100);
  let bottom = top + finite(rect?.h, 100);
  const h = String(handle || '');
  if (h.includes('w')) left = clamp(left + dx, 0, right - PHOTO_FRAME_MIN_PCT);
  if (h.includes('e')) right = clamp(right + dx, left + PHOTO_FRAME_MIN_PCT, 100);
  if (h.includes('n')) top = clamp(top + dy, 0, bottom - PHOTO_FRAME_MIN_PCT);
  if (h.includes('s')) bottom = clamp(bottom + dy, top + PHOTO_FRAME_MIN_PCT, 100);
  return { x: round2(left), y: round2(top), w: round2(right - left), h: round2(bottom - top) };
}

/**
 * Ponto de partida do recorte. O deslocamento antigo da foto
 * (`elementOffsets.photo`, que o render subtrai do `background-position`)
 * entra no enquadramento e é zerado, para só haver uma fonte de verdade.
 */
export function photoCropState(slide = {}) {
  const off = slide?.elementOffsets?.photo || {};
  const fit = slide?.bgFit === 'custom' ? 'custom' : 'cover';
  const zoomMin = fit === 'custom' ? CUSTOM_ZOOM_MIN : PHOTO_ZOOM_MIN;
  return {
    bgX: round2(clamp(finite(slide?.bgX, 50) - finite(off.x, 0), 0, 100)),
    bgY: round2(clamp(finite(slide?.bgY, 50) - finite(off.y, 0), 0, 100)),
    bgZoom: clamp(finite(slide?.bgZoom, 100), zoomMin, PHOTO_ZOOM_MAX),
    bgFit: fit,
  };
}

/** Tamanho da imagem desenhada na moldura, em px da moldura. */
function renderedSize(state, { frameW, frameH, imageW, imageH }) {
  const iw = imageW > 0 ? imageW : frameW;
  const ih = imageH > 0 ? imageH : frameH;
  if (state.bgFit === 'custom') {
    const w = frameW * (state.bgZoom / 100);
    return { w, h: w * (ih / iw) };
  }
  const cover = Math.max(frameW / iw, frameH / ih) * (state.bgZoom / 100);
  return { w: iw * cover, h: ih * cover };
}

function croppedPatch(state) {
  return {
    bgX: state.bgX, bgY: state.bgY, bgZoom: state.bgZoom, bgFit: state.bgFit,
    photoFraming: 'manual',
    elementOffsets: { photo: { x: 0, y: 0 } },
  };
}

/**
 * Arrasta a imagem `dx`,`dy` px (da moldura) a partir de `state`.
 * Puxar para baixo mostra a parte de cima da foto (o percentual diminui).
 */
export function panPhoto(state, dx, dy, geometry) {
  const size = renderedSize(state, geometry);
  const overflowX = size.w - geometry.frameW;
  const overflowY = size.h - geometry.frameH;
  const bgX = overflowX > 0.5 ? round2(clamp(state.bgX - (dx / overflowX) * 100, 0, 100)) : state.bgX;
  const bgY = overflowY > 0.5 ? round2(clamp(state.bgY - (dy / overflowY) * 100, 0, 100)) : state.bgY;
  return croppedPatch({ ...state, bgX, bgY });
}

/** Zoom multiplicativo (roda do mouse, pinça ou botões), com limites. */
export function zoomPhoto(state, factor) {
  const min = state.bgFit === 'custom' ? CUSTOM_ZOOM_MIN : PHOTO_ZOOM_MIN;
  const bgZoom = Math.round(clamp(state.bgZoom * factor, min, PHOTO_ZOOM_MAX));
  return croppedPatch({ ...state, bgZoom });
}
