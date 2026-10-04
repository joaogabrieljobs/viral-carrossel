import { brandToneIsReady } from './brand-tone.js';
import { styleKitHasContent } from './style-kit.js';

/**
 * Estado do contexto do projeto (spec duas-profundidades).
 * - sem: só pedido / defaults
 * - basico: bio/brief curto ou tom
 * - completo: brief + tom + identidade visual (logo ou estilo)
 */
export function resolveContextStatus({ brand = {}, styleKit = {} } = {}) {
  const brief = String(styleKit?.contextMd || '').trim();
  const bio = String(brand?.bio || '').trim();
  const hasDesc = brief.length >= 40 || bio.length >= 20;
  const hasTone = brandToneIsReady(brand);
  const hasLogo = !!(brand?.logo || brand?.logoImageId || styleKit?.logo?.imageId);
  const hasStylePrompt = !!String(styleKit?.stylePrompt || '').trim();
  const refCount = Array.isArray(styleKit?.refImages) ? styleKit.refImages.length : 0;
  const hasRefs = refCount > 0;
  const hasStyle = hasStylePrompt || hasRefs;
  const hasVisual = hasLogo || hasStyle;

  if (hasDesc && hasTone && hasVisual) {
    return {
      id: 'completo', label: 'Contexto completo',
      hasDesc, hasTone, hasLogo, hasStyle, hasStylePrompt, hasRefs, refCount, hasVisual,
    };
  }
  if (hasDesc || hasTone) {
    return {
      id: 'basico', label: 'Contexto básico',
      hasDesc, hasTone, hasLogo, hasStyle, hasStylePrompt, hasRefs, refCount, hasVisual,
    };
  }
  return {
    id: 'sem', label: 'Sem contexto',
    hasDesc, hasTone, hasLogo, hasStyle, hasStylePrompt, hasRefs, refCount, hasVisual,
  };
}

/** Checklist profissional compacto (não bloqueia geração). */
export function buildIdentityChecklist({ brand = {}, styleKit = {}, material = {} } = {}) {
  const st = resolveContextStatus({ brand, styleKit });
  const hasMaterial = !!(
    String(material?.content || '').trim()
    || String(material?.sources || '').trim()
    || String(material?.context || '').trim()
  );
  return {
    status: st,
    items: [
      { id: 'brief', label: 'Brief', ready: st.hasDesc, hint: 'Adicione um brief ou descrição para a IA entender sua marca.' },
      { id: 'tone', label: 'Tom de voz', ready: st.hasTone, hint: 'Analise o tom para manter a mesma voz nas próximas criações.' },
      { id: 'logo', label: 'Logo', ready: st.hasLogo, hint: 'Adicione uma logo para reutilizá-la nos próximos carrosséis.' },
      { id: 'style', label: 'Estilo visual', ready: st.hasStylePrompt, hint: 'Opcional: estilo visual para a arte.' },
      {
        id: 'refs',
        label: st.refCount ? `${st.refCount} referências` : 'Referências',
        ready: st.hasRefs,
        hint: 'Opcional: referências visuais do projeto.',
      },
      { id: 'material', label: 'Material do post', ready: hasMaterial, hint: 'Opcional: texto-base deste post.' },
    ],
  };
}

const PLACEHOLDER_TITLES = new Set(['seu título aqui', 'seu titulo aqui']);
const PLACEHOLDER_SUBTITLES = new Set([
  'subtítulo descritivo que reforça o gancho principal do carrossel.',
  'subtitulo descritivo que reforca o gancho principal do carrossel.',
]);

function isPlaceholderTitle(title) {
  return PLACEHOLDER_TITLES.has(String(title || '').trim().toLowerCase());
}

function isPlaceholderSubtitle(subtitle) {
  return PLACEHOLDER_SUBTITLES.has(String(subtitle || '').trim().toLowerCase());
}

/** True quando há conteúdo real (não o placeholder «Seu título aqui»). */
export function projectHasCarouselContent(slides = []) {
  return (slides || []).some((s) => {
    const title = String(s?.title || '').trim();
    const subtitle = String(s?.subtitle || '').trim();
    const hasRealTitle = title && !isPlaceholderTitle(title);
    const hasRealSubtitle = subtitle && !isPlaceholderSubtitle(subtitle);
    return !!(hasRealTitle || hasRealSubtitle || s?.bgImage || s?.logoImageId);
  });
}

export function styleKitHasAnyIdentity(kit) {
  return styleKitHasContent(kit) || !!(kit?.logo?.imageId);
}
