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

/**
 * Catálogo mostrado no painel Elementos. Entram em preto, branco e cinza
 * (João, 27/11): a cor fica por conta de quem edita, sem paleta imposta.
 */
export const ELEMENT_CATALOG = Object.freeze([
  {
    id: 'cta_filled',
    group: 'CTA',
    label: 'Pílula grafite',
    hint: 'Preenchida · seta',
    preview: 'filled',
    factory: () => makeCtaOverlay({
      variant: 'filled',
      text: 'AGENDE SUA AVALIAÇÃO',
      bg: '#3A3A3A',
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
      fg: '#1A1A1A',
      border: '#1A1A1A',
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
      bg: 'rgba(24,24,24,0.42)',
      fg: '#FFFFFF',
      border: 'rgba(255,255,255,0.75)',
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
    label: 'Pílula clara',
    hint: 'Cinza claro · tipografia',
    preview: 'cream',
    factory: () => makeCtaOverlay({
      variant: 'filled',
      text: 'CONHEÇA O MÉTODO',
      bg: '#EDEDED',
      fg: '#1A1A1A',
      border: 'rgba(0,0,0,0.2)',
    }),
  },
  {
    id: 'cta_gold_edge',
    group: 'CTA',
    label: 'Pílula com filete',
    hint: 'Escura · borda cinza',
    preview: 'gold',
    factory: () => makeCtaOverlay({
      variant: 'filled',
      text: 'AGENDE SUA AVALIAÇÃO',
      bg: '#2B2B2B',
      fg: '#FFFFFF',
      border: '#A6A6A6',
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
      fg: '#111111',
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
      fg: '#FFFFFF',
      border: 'rgba(255,255,255,0.9)',
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
      color: '#222222',
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
      color: '#222222',
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
      color: 'rgba(255,255,255,0.85)',
      thickness: 1.25,
    }),
  },
  {
    id: 'rule_accent',
    group: 'Linhas',
    label: 'Traço cinza',
    hint: 'Médio · fino',
    preview: 'rule_accent',
    factory: () => ({
      id: uid(),
      type: 'rule',
      x: 12,
      y: 30,
      w: 18,
      color: '#8C8C8C',
      thickness: 2,
    }),
  },
  {
    id: 'rule_medium',
    group: 'Linhas',
    label: 'Traço médio',
    hint: 'Mais grosso',
    preview: 'rule_medium',
    factory: () => ({
      id: uid(),
      type: 'rule',
      x: 12,
      y: 34,
      w: 46,
      color: '#222222',
      thickness: 8,
    }),
  },
  {
    id: 'rule_long',
    group: 'Linhas',
    label: 'Traço longo',
    hint: 'Quase a largura',
    preview: 'rule_long',
    factory: () => ({
      id: uid(),
      type: 'rule',
      x: 8,
      y: 18,
      w: 84,
      color: '#222222',
      thickness: 6,
    }),
  },
  {
    id: 'rule_bold',
    group: 'Linhas',
    label: 'Barra',
    hint: 'Faixa larga',
    preview: 'rule_bold',
    factory: () => ({
      id: uid(),
      type: 'rule',
      x: 10,
      y: 72,
      w: 70,
      color: '#111111',
      thickness: 22,
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
  // Ausência de fonte mantém a herança do estilo, inclusive em projetos antigos.
  const fontFamily = typeof raw.fontFamily === 'string' ? raw.fontFamily.trim() : '';
  const typography = fontFamily ? { fontFamily } : {};
  if (type === 'cta') {
    return {
      ...base,
      ...typography,
      variant: ['filled', 'outline', 'glass'].includes(raw.variant) ? raw.variant : 'filled',
      text: String(raw.text || 'AGENDE SUA AVALIAÇÃO').slice(0, 80),
      bg: String(raw.bg || '#6B5344'),
      fg: String(raw.fg || '#FFFFFF'),
      border: String(raw.border || 'rgba(255,255,255,0.85)'),
      uppercase: raw.uppercase !== false,
      blur: !!raw.blur,
      arrow: raw.arrow !== false,
      size: clamp(raw.size, 50, 240, 100),
    };
  }
  if (type === 'rule') {
    return {
      ...base,
      w: clamp(raw.w, 4, 90, 28),
      color: String(raw.color || '#3A322C'),
      thickness: clamp(raw.thickness, 0.5, 48, 1.5),
    };
  }
  return {
    ...base,
    ...typography,
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
