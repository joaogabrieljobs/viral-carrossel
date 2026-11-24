import { canWriteAccountPreference } from './storage.js';
import { CUSTOM_VISUAL_PRESETS_KEY, writeCustomVisualPresets } from './custom-visual-presets.js';

/**
 * Grava os padrões visuais salvos pela pessoa, a menos que outra aba tenha
 * trocado a conta deste navegador. Fica à parte de custom-visual-presets.js,
 * que também é carregado pelo servidor e não pode depender do navegador.
 */
export function saveCustomVisualPresets(presets, storage) {
  if (!canWriteAccountPreference(CUSTOM_VISUAL_PRESETS_KEY)) return false;
  return writeCustomVisualPresets(presets, storage);
}
