import { parseOverlayMoveKey, updateOverlayOnSlide } from './card-overlays.js';

/**
 * Roda de tamanho da letra no celular (pedido do João, 28/11): tocar numa caixa
 * de texto mostra a roda ao lado do card; girar para cima aumenta, para baixo
 * diminui, e o card fica à vista enquanto ajusta.
 *
 * `slide` é o card como aparece na proporção atual (vista já aplicada), então o
 * valor lido é o que está desenhado. O patch volta para `updateSlide`, que
 * grava na vista da proporção quando é o caso.
 */
const PERCENT = { min: 20, max: 240, step: 1 };

export function textSizeTarget(slide, key) {
  if (!slide || !key) return null;
  if (key === 'title') {
    return { label: 'título', value: num(slide.titleSize, 100), ...PERCENT, patch: (v) => ({ titleSize: v }) };
  }
  if (key === 'subtitle') {
    return { label: 'subtítulo', value: num(slide.subSize, 100), ...PERCENT, patch: (v) => ({ subSize: v }) };
  }
  if (key === 'bodyAfterImage') {
    return { label: 'texto', value: num(slide.bodyAfterSize, num(slide.subSize, 100)), ...PERCENT, patch: (v) => ({ bodyAfterSize: v }) };
  }
  const overlayId = parseOverlayMoveKey(key);
  const overlay = overlayId && (slide.overlays || []).find((item) => item?.id === overlayId);
  if (!overlay) return null;
  const patch = (v) => ({ overlays: updateOverlayOnSlide(slide, overlayId, { size: v }).overlays });
  if (overlay.type === 'text') return { label: 'texto', value: num(overlay.size, 3.4), min: 1.5, max: 8, step: 0.1, patch };
  if (overlay.type === 'cta') return { label: 'chamada', value: num(overlay.size, 100), min: 50, max: 240, step: 1, patch };
  return null;
}

/** Valor depois de girar `pixels` (positivo = para cima). A faixa toda cabe em `span` px. */
export function wheelValue({ start, pixels, min, max, step, span = 360 }) {
  const raw = start + (pixels / span) * (max - min);
  const stepped = Math.round(raw / step) * step;
  const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;
  return Number(Math.min(max, Math.max(min, stepped)).toFixed(decimals));
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
