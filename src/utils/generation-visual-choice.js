import { getPresentationPath } from './presentation.js';

// Direção visual e arco narrativo são escolhas independentes: recomendar uma
// pele nunca troca o modo de escrita nem injeta o texto de um template.
const SOCIAL_STYLES = Object.freeze({
  none: 'editorial_magazine', editorial: 'authority_black', how_to: 'minimal_clean',
  storytelling: 'mood_sepia', viral: 'tabloid_keywords', pain: 'reflexivo_cream',
  deep: 'editorial_magazine', jornalistico: 'sports_editorial', sensacionalista: 'viral_hype_dark',
  tendencia_cultura: 'reflexivo_cream', quick_erro_comum: 'authority_black',
  quick_tendencia: 'sports_editorial', quick_decodificacao: 'editorial_magazine',
  quick_comportamento: 'mood_sepia',
});

export function recommendedGenerationVisualPreset({ productKind = 'carrossel', narrative = 'editorial', presentationPath = 'auto', presets = [] } = {}) {
  const presentation = productKind === 'apresentacao';
  const catalog = presets.filter(p => p && !p.hidden && !p.isCustom
    && (presentation ? p.productKind === 'apresentacao' : p.productKind !== 'apresentacao'));
  const id = presentation ? getPresentationPath(presentationPath).suggestedVisualPreset
    : (SOCIAL_STYLES[narrative] || SOCIAL_STYLES.editorial);
  return catalog.find(p => p.id === id) || catalog[0] || null;
}

export function resolveCreationVisualSelection({ selection = 'auto', productKind, narrative, presentationPath, presets = [], preserveIdentity = false } = {}) {
  const recommended = recommendedGenerationVisualPreset({ productKind, narrative, presentationPath, presets });
  const selected = selection === 'auto' ? recommended : presets.find(p => p.id === selection) || null;
  return {
    preset: selected,
    presetId: selected?.id || null,
    recommendedId: recommended?.id || null,
    automatic: selection === 'auto',
    preserveBrandIdentity: !selected || (selection === 'auto' && preserveIdentity),
  };
}
