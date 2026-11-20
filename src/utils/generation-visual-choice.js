import { getPresentationPath } from './presentation.js';

// Direção visual e arco narrativo são escolhas independentes: recomendar uma
// pele nunca troca o modo de escrita nem injeta o texto de um template.
// Os 12 estilos virais ficam com os modos de atenção e emoção; as famílias
// editoriais (v4) com os modos estruturados (passo a passo, ir a fundo,
// informar). As chaves de pacote criativo seguem a mesma escolha do seletor
// (SUGGESTED_VISUAL_PRESET_BY_CREATIVE em slide-design-system.js).
const SOCIAL_STYLES = Object.freeze({
  none: 'minimal_clean', editorial: 'authority_black', how_to: 'social_ficha',
  storytelling: 'mood_sepia', viral: 'tabloid_keywords', pain: 'reflexivo_cream',
  deep: 'social_revista', jornalistico: 'social_grade', sensacionalista: 'viral_hype_dark',
  tendencia_cultura: 'editorial_magazine', quick_erro_comum: 'authority_black',
  quick_tendencia: 'tabloid_keywords', quick_decodificacao: 'case_study_neon',
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
