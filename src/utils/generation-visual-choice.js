import { getPresentationPath } from './presentation.js';

// Direção visual e arco narrativo são escolhas independentes: recomendar uma
// pele nunca troca o modo de escrita nem injeta o texto de um template.
const SOCIAL_STYLES = Object.freeze({
  none: 'social_minimal', editorial: 'social_grade', how_to: 'social_ficha',
  storytelling: 'social_documental', viral: 'social_manchete', pain: 'social_cinema',
  deep: 'social_revista', jornalistico: 'social_ficha', sensacionalista: 'social_poster',
  tendencia_cultura: 'social_revista', quick_erro_comum: 'social_ficha',
  quick_tendencia: 'social_manchete', quick_decodificacao: 'social_revista',
  quick_comportamento: 'social_documental',
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
