import { applyVisualPreset, getSlideOverridesForPreset, PRESET_BRAND_SIGNATURE_KEYS } from '../styles/visual-presets.jsx';
import { applyPresentationVisualPresetToDoc } from './presentation-state.js';
import { sanitizeCustomVisualPresetBrand } from './custom-visual-presets.js';
import { suggestCreativePresetForVisual } from './slide-design-system.js';
import { applyFormatEdit, applyBrandEdit, brandForFormatDisplay, slideForFormatDisplay, transformFormatVisuals } from './format-view.js';
import { dropKeysFromFormatViews } from './format-view-keys.js';
import { isFreeSocialPreset } from './social-free-design.js';
import { restyleSocialSlides } from './social-visual-composition.js';
import { hasSocialFreeState, socialFreeExitPatch } from './social-free-state.js';

const CONTENT_KEYS = ['id', 'title', 'subtitle', 'bodyAfterImage', 'eyebrow', 'eyebrowText', 'strikethroughText', 'afterTitleText', 'caption', 'bgImage', 'bgImageId', 'bgImageAssetId', 'imageQuery', 'overlays'];

/** Applying a look never inserts sample prices or replaces the author's copy. */
export function preserveVisualPresetContent(styled, source) {
  return {
    ...styled,
    slides: (styled.slides || []).map((slide, index) => {
      const original = source.slides?.[index];
      if (!original) return slide;
      const next = { ...slide };
      for (const key of CONTENT_KEYS) {
        if (Object.hasOwn(original, key)) next[key] = original[key];
        else delete next[key];
      }
      return next;
    }),
  };
}

export function editCardVisualBrand(doc, index, nextBrand) {
  const slide = slideForFormatDisplay(doc.slides[index], doc.fmt, doc.formatViews, doc.creativePreset);
  const base = brandForFormatDisplay(doc.brand, doc.fmt, doc.formatViews, doc.creativePreset);
  const current = { ...base, ...sanitizeCustomVisualPresetBrand(slide.visualBrand) };
  const next = typeof nextBrand === 'function' ? nextBrand(current) : { ...current, ...nextBrand };
  const visual = sanitizeCustomVisualPresetBrand(next);
  // Identity fields (e.g. @handle) remain shared; local styling stays on this card.
  const identityChanges = Object.fromEntries(Object.entries(next).filter(([key, value]) =>
    !(key in visual) && JSON.stringify(value) !== JSON.stringify(current[key])));
  const updated = Object.keys(identityChanges).length ? applyBrandEdit(doc, { ...base, ...identityChanges }) : doc;
  return applyFormatEdit(updated, index, { visualBrand:visual });
}

/** A per-card style carries visual tokens only, never another client's identity. */
export function applyVisualPresetToCard(doc, index, preset, presets) {
  const slide = slideForFormatDisplay(doc.slides[index], doc.fmt, doc.formatViews, doc.creativePreset);
  if (!slide || !preset) return doc;
  let patch;
  let brand;
  const entry = doc.formatViews?.[doc.fmt]?.slides?.[slide.id];
  const exitedFreeView = hasSocialFreeState(doc.slides[index])
    && Object.hasOwn(entry || {}, 'socialFreeDesign') && entry.socialFreeDesign === null;
  // A saída continua restrita à vista nas próximas trocas de estilo também.
  const exitFree = !isFreeSocialPreset(preset) && (hasSocialFreeState(slide) || exitedFreeView);
  if (preset.productKind === 'apresentacao') {
    const styled = applyPresentationVisualPresetToDoc({ ...doc, slides:[slide] }, preset.id, presets, { initialize:false });
    patch = { ...styled.slides[0] };
    brand = styled.brand;
  } else {
    patch = getSlideOverridesForPreset(preset.id, presets, { scope: 'card' });
    brand = applyVisualPreset(doc.brand, preset.id, presets);
    if (exitFree) {
      const shown = doc.slides.map(item => slideForFormatDisplay(item, doc.fmt, doc.formatViews, doc.creativePreset));
      shown[index] = { ...slide, visualPresetId: preset.id };
      // O card desenha a marca do projeto com os tokens visuais do estilo por
      // cima (selo, barra e cabeçalho continuam os do projeto). A composição
      // reserva espaço para essa mesma assinatura, não para a do estilo.
      const drawn = { ...brandForFormatDisplay(doc.brand, doc.fmt, doc.formatViews, doc.creativePreset), ...sanitizeCustomVisualPresetBrand(brand) };
      patch = restyleSocialSlides(shown, { preset, brand: drawn, formato: doc.fmt, overrides: patch, narrative: doc.quickNarrativeMode || 'editorial' })[index];
    }
  }
  // Keep the author's content and photos, including auxiliary copy and CTAs.
  for (const key of [...CONTENT_KEYS, ...(exitFree ? ['presentationBlocks', 'socialBlocks'] : [])]) delete patch[key];
  const visualPatch = {
    ...(exitFree ? socialFreeExitPatch(slide) : {}),
    ...patch,
    visualBrand: sanitizeCustomVisualPresetBrand(brand),
    visualPresetId: preset.id,
    visualCreativePreset: preset.socialFamily ? doc.creativePreset : (preset.creativePreset || suggestCreativePresetForVisual(preset.id) || doc.creativePreset),
  };
  if (exitFree && (doc.fmt !== 'carrossel' || doc.slides[index]?.socialArt?.formato && doc.slides[index].socialArt.formato !== 'carrossel')) {
    // Os metadados de composição não são VIEW_KEYS legados. Guardar a saída
    // inteira nesta vista impede que null apague o Livre dos outros formatos.
    const entry = Object.fromEntries(Object.entries(visualPatch).filter(([key, value]) => value !== undefined && value !== slide[key]));
    const bucket = doc.formatViews?.[doc.fmt] || {};
    return { ...doc, formatViews: { ...doc.formatViews, [doc.fmt]: { ...bucket, slides: {
      ...bucket.slides, [slide.id]: { ...bucket.slides?.[slide.id], ...entry },
    } } } };
  }
  return applyFormatEdit(doc, index, visualPatch);
}

/**
 * Antes de um padrão valer para todos os cards: sai o estilo próprio de cada
 * card na proporção aberta e, em toda proporção, as cores e fontes que o
 * padrão define (a vista guardava o valor antigo e vencia o novo). A logo não
 * é do padrão: posição, tamanho e opacidade por proporção continuam.
 */
export function clearOwnVisualsBeforePresetOnAll(doc, preset) {
  const cleared = transformFormatVisuals(doc, items => items.map(item => ({ ...item, visualBrand:null, visualPresetId:null, visualCreativePreset:null })));
  const brandKeys = [...Object.keys(preset?.brand || {}), ...PRESET_BRAND_SIGNATURE_KEYS]
    .filter(key => !key.startsWith('logo'));
  const formatViews = dropKeysFromFormatViews(cleared.formatViews, { brandKeys });
  return formatViews === cleared.formatViews ? cleared : { ...cleared, formatViews };
}
