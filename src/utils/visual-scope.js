import { applyVisualPreset, getSlideOverridesForPreset } from '../styles/visual-presets.jsx';
import { applyPresentationVisualPresetToDoc } from './presentation-state.js';
import { sanitizeCustomVisualPresetBrand } from './custom-visual-presets.js';
import { suggestCreativePresetForVisual } from './slide-design-system.js';
import { applyFormatEdit, applyBrandEdit, brandForFormatDisplay, slideForFormatDisplay } from './format-view.js';

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
  if (preset.productKind === 'apresentacao') {
    const styled = applyPresentationVisualPresetToDoc({ ...doc, slides:[slide] }, preset.id, presets, { initialize:false });
    patch = { ...styled.slides[0] };
    brand = styled.brand;
  } else {
    patch = getSlideOverridesForPreset(preset.id, presets);
    brand = applyVisualPreset(doc.brand, preset.id, presets);
  }
  // Keep the author's content and photos, including auxiliary copy and CTAs.
  for (const key of ['id', 'title', 'subtitle', 'bodyAfterImage', 'eyebrowText', 'strikethroughText', 'afterTitleText', 'caption', 'bgImage', 'bgImageId', 'imageQuery', 'overlays']) delete patch[key];
  return applyFormatEdit(doc, index, {
    ...patch,
    visualBrand: sanitizeCustomVisualPresetBrand(brand),
    visualPresetId: preset.id,
    visualCreativePreset: preset.creativePreset || suggestCreativePresetForVisual(preset.id) || doc.creativePreset,
  });
}
