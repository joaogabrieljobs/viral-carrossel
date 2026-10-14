/**
 * Elementos inseríveis no card — textos livres, CTAs e linhas.
 * Vivem em `slide.overlays[]` e renderizam por cima da composição.
 */

const uid = () => Math.random().toString(36).slice(2, 9);

export const MAX_CARD_OVERLAYS = 12;

/** Área de texto ancorada no ponto escolhido, com margem no lado direito. */
export function makeTextOverlay({ x = 26, y = 45, color = '#3A322C' } = {}) {
  const left = clamp(x, 0, 90, 26);
  return normalizeOverlay({
    type: 'text',
    x: left,
    y: clamp(y, 0, 90, 45),
    w: Math.min(48, 98 - left),
    text: 'Digite seu texto',
    color,
    size: 3.4,
    weight: 500,
  });
}

/** Catálogo mostrado no painel Elementos. */
export const ELEMENT_CATALOG = Object.freeze([
  {
    id: 'cta_filled',
    group: 'CTA',
    label: 'Pílula mocha',
    hint: 'Preenchida · seta',
    preview: 'filled',
    factory: () => makeCtaOverlay({
      variant: 'filled',
      text: 'AGENDE SUA AVALIAÇÃO',
      bg: '#6B5344',
      fg: '#FFFFFF',
      border: 'rgba(255,255,255,0.85)',
    }),
  },
  {
    id: 'cta_outline',
    group: 'CTA',
    label: 'Pílula contorno',
    hint: 'Fina · transparente',
    preview: 'outline',
    factory: () => makeCtaOverlay({
      variant: 'outline',
      text: 'Agende sua avaliação',
      bg: 'transparent',
      fg: '#5D4B42',
      border: '#5D4B42',
      uppercase: false,
    }),
  },
  {
    id: 'cta_glass',
    group: 'CTA',
    label: 'Pílula glass',
    hint: 'Blur · borda clara',
    preview: 'glass',
    factory: () => makeCtaOverlay({
      variant: 'glass',
      text: 'AGENDE SUA AVALIAÇÃO',
      bg: 'rgba(40,32,28,0.42)',
      fg: '#F5F0E8',
      border: 'rgba(245,240,232,0.75)',
      blur: true,
    }),
  },
  {
    id: 'cta_ink',
    group: 'CTA',
    label: 'Pílula tinta',
    hint: 'Preto · seta',
    preview: 'ink',
    factory: () => makeCtaOverlay({
      variant: 'filled',
      text: 'SAIBA MAIS',
      bg: '#0A0A0A',
      fg: '#FFFFFF',
      border: 'rgba(255,255,255,0.35)',
    }),
  },
  {
    id: 'cta_cream',
    group: 'CTA',
    label: 'Pílula cream',
    hint: 'Clara · tipografia',
    preview: 'cream',
    factory: () => makeCtaOverlay({
      variant: 'filled',
      text: 'CONHEÇA O MÉTODO',
      bg: '#F5F0E8',
      fg: '#2C2420',
      border: 'rgba(44,36,32,0.2)',
    }),
  },
  {
    id: 'cta_gold_edge',
    group: 'CTA',
    label: 'Pílula ouro',
    hint: 'Borda dourada',
    preview: 'gold',
    factory: () => makeCtaOverlay({
      variant: 'filled',
      text: 'AGENDE SUA AVALIAÇÃO',
      bg: '#4A3A32',
      fg: '#F7F1E6',
      border: '#C4A574',
    }),
  },
  {
    id: 'cta_soft_white',
    group: 'CTA',
    label: 'Pílula branca',
    hint: 'Sobre foto escura',
    preview: 'white',
    factory: () => makeCtaOverlay({
      variant: 'filled',
      text: 'QUERO COMEÇAR',
      bg: 'rgba(255,255,255,0.94)',
      fg: '#1A1410',
      border: 'rgba(255,255,255,0.5)',
    }),
  },
  {
    id: 'cta_outline_light',
    group: 'CTA',
    label: 'Contorno claro',
    hint: 'Branco · foto',
    preview: 'outline_light',
    factory: () => makeCtaOverlay({
      variant: 'outline',
      text: 'Agende sua avaliação',
      bg: 'transparent',
      fg: '#F5F0E8',
      border: 'rgba(245,240,232,0.9)',
      uppercase: false,
    }),
  },
  {
    id: 'rule_thin',
    group: 'Linhas',
    label: 'Traço fino',
    hint: 'Acima do texto',
    preview: 'rule',
    factory: () => ({
      id: uid(),
      type: 'rule',
      x: 12,
      y: 28,
      w: 28,
      color: '#3A322C',
      thickness: 1.5,
    }),
  },
  {
    id: 'rule_center',
    group: 'Linhas',
    label: 'Traço curto',
    hint: 'Centro · editorial',
    preview: 'rule',
    factory: () => ({
      id: uid(),
      type: 'rule',
      x: 36,
      y: 42,
      w: 28,
      color: '#3A322C',
      thickness: 1.25,
    }),
  },
  {
    id: 'rule_light',
    group: 'Linhas',
    label: 'Traço claro',
    hint: 'Sobre foto',
    preview: 'rule_light',
    factory: () => ({
      id: uid(),
      type: 'rule',
      x: 12,
      y: 22,
      w: 22,
      color: 'rgba(245,240,232,0.85)',
      thickness: 1.25,
    }),
  },
  {
    id: 'rule_accent',
    group: 'Linhas',
    label: 'Traço accent',
    hint: 'Marca · fino',
    preview: 'rule_accent',
    factory: () => ({
      id: uid(),
      type: 'rule',
      x: 12,
      y: 30,
      w: 18,
      color: '#C4A574',
      thickness: 2,
    }),
  },
]);

function makeCtaOverlay({
  variant,
  text,
  bg,
  fg,
  border,
  uppercase = true,
  blur = false,
}) {
  return {
    id: uid(),
    type: 'cta',
    variant,
    text,
    bg,
    fg,
    border,
    uppercase,
    blur,
    arrow: true,
    x: 50,
    y: 78,
  };
}

export function normalizeOverlay(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = String(raw.type || '');
  // Textos livres e documentos antigos compartilham o mesmo formato.
  if (!['cta', 'rule', 'text'].includes(type)) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : uid();
  const base = {
    id,
    type,
    x: clamp(raw.x, 0, 100, type === 'cta' ? 50 : 12),
    y: clamp(raw.y, 0, 100, type === 'cta' ? 78 : 30),
  };
  if (type === 'cta') {
    return {
      ...base,
      variant: ['filled', 'outline', 'glass'].includes(raw.variant) ? raw.variant : 'filled',
      text: String(raw.text || 'AGENDE SUA AVALIAÇÃO').slice(0, 80),
      bg: String(raw.bg || '#6B5344'),
      fg: String(raw.fg || '#FFFFFF'),
      border: String(raw.border || 'rgba(255,255,255,0.85)'),
      uppercase: raw.uppercase !== false,
      blur: !!raw.blur,
      arrow: raw.arrow !== false,
    };
  }
  if (type === 'rule') {
    return {
      ...base,
      w: clamp(raw.w, 4, 90, 28),
      color: String(raw.color || '#3A322C'),
      thickness: clamp(raw.thickness, 0.5, 8, 1.5),
    };
  }
  return {
    ...base,
    w: clamp(raw.w, 8, 90, 48),
    text: String(raw.text ?? ''),
    color: String(raw.color || '#3A322C'),
    align: ['left', 'center', 'right'].includes(raw.align) ? raw.align : 'left',
    size: clamp(raw.size, 1.5, 8, 3.4),
    weight: clamp(raw.weight, 300, 800, 500),
    tracking: Number.isFinite(Number(raw.tracking)) ? Number(raw.tracking) : -0.02,
    leading: clamp(raw.leading, 1, 1.8, 1.25),
  };
}

function clamp(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function normalizeOverlays(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeOverlay).filter(Boolean).slice(0, MAX_CARD_OVERLAYS);
}

export function addOverlayToSlide(slide, overlay) {
  const next = normalizeOverlay(overlay);
  if (!next) return slide;
  const overlays = normalizeOverlays([...(slide?.overlays || []), next]);
  return { ...slide, overlays, elementsUnlocked: true };
}

export function removeOverlayFromSlide(slide, overlayId) {
  const overlays = normalizeOverlays(slide?.overlays || []).filter((o) => o.id !== overlayId);
  return { ...slide, overlays };
}

export function updateOverlayOnSlide(slide, overlayId, patch) {
  const overlays = normalizeOverlays(slide?.overlays || []).map((o) => (
    o.id === overlayId ? normalizeOverlay({ ...o, ...patch, id: o.id }) : o
  ));
  return { ...slide, overlays };
}

/** Chave de arrasto em elementOffsets. */
export function overlayMoveKey(overlayId) {
  return `ov_${overlayId}`;
}

export function parseOverlayMoveKey(chave) {
  const key = String(chave || '');
  if (!key.startsWith('ov_')) return null;
  return key.slice(3) || null;
}
