import { slideHasPendingPhotoIntent } from './canvas-zones.js';

const PHOTO_STRIP_REGIONS = new Set(['inset_h_top', 'inset_h_middle', 'inset_h_bottom', 'inset_h_narrow_mid']);

/**
 * Qual desenho o card usa. Repete, na mesma ordem, a escolha de ramo do
 * `SlideCardInner`; o teste auditoria-2311-ga-03 renderiza o card de verdade e
 * confere que os dois continuam de acordo.
 *
 * - `sandwich`: texto + foto + texto;
 * - `composed`: card composto por zonas (padrão dos carrosséis gerados);
 * - `photo-strip`: foto numa faixa;
 * - `full`: foto de fundo ou cor no card inteiro.
 */
export function cardLayoutKind(slide, { creativePreset = 'livre' } = {}) {
  const canvas = slide?.canvas;
  const culturePack = creativePreset === 'tendencia_cultura' && canvas?.source !== 'social-preset';
  const sandwichSkin = culturePack || !!slide?.useCultureLayout;
  const body = String(slide?.bodyAfterImage || '').trim();
  const pendingPhoto = slideHasPendingPhotoIntent(slide);
  const sandwich = sandwichSkin && !!body && (!!slide?.bgImage || pendingPhoto);
  const statFlat = sandwichSkin && !slide?.bgImage && !pendingPhoto && !!body && !!String(slide?.subtitle || '').trim();
  if (sandwich || statFlat) return 'sandwich';
  const hasZones = !!(canvas && canvas.zones && (canvas.enabled || canvas.applied));
  if (hasZones && canvas.variant === 'classic') return 'composed';
  if (!hasZones && PHOTO_STRIP_REGIONS.has(slide?.photoRegion)) return 'photo-strip';
  return 'full';
}

/**
 * Textos de assinatura (sobrelinha, riscado, depois do título) que o desenho
 * atual do card mostra. O painel só oferece o que sai no card e no arquivo.
 *
 * `strike`: `'line'` sai riscado; `'plain'` sai junto da oferta, sem o traço
 * (tarja do Bold Promo); `'none'` não sai.
 *
 * @returns {{ eyebrow: boolean, offer: boolean, strike: 'line' | 'plain' | 'none' }}
 */
export function signatureTextSupport(slide, options = {}) {
  const kind = cardLayoutKind(slide, options);
  if (kind === 'full') return { eyebrow: true, offer: true, strike: 'line' };
  // No card composto só a linguagem gráfica do estilo desenha estes textos
  // (chapéu do Case Study na capa; tarja de oferta do Bold Promo).
  const devices = kind === 'composed' && slide?.socialCompositionVersion >= 4 && Array.isArray(slide?.socialArt?.chrome)
    ? slide.socialArt.chrome
    : [];
  const draws = (token) => devices.some((device) => device?.requires === token);
  const offer = draws('oferta');
  return { eyebrow: draws('eyebrow'), offer, strike: offer ? 'plain' : 'none' };
}
