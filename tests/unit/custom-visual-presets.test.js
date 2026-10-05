import { describe, expect, it } from 'vitest';
import {
  createCustomVisualPreset,
  normalizeCustomVisualPresets,
  readCustomVisualPresets,
  writeCustomVisualPresets,
} from '../../src/utils/custom-visual-presets.js';
import { applyVisualPreset, getSlideOverridesForPreset, VISUAL_PRESETS } from '../../src/styles/visual-presets.jsx';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

describe('padrões visuais personalizados', () => {
  it('salva somente a assinatura visual e reaplica sem ocultar subtítulo', () => {
    const preset = createCustomVisualPreset({
      label: 'MUSA editorial',
      brand: { bg: '#101010', accent: '#beff22', subtitleVisible: false, logo: 'blob:nao-copiar' },
      slide: { layout: 'bl', align: 'left', textBg: true, textBgOpacity: 69, bgImage: 'blob:nao-copiar' },
      creativePreset: 'livre',
    });
    expect(preset.brand.logo).toBeUndefined();
    expect(preset.slideDefaults.bgImage).toBeUndefined();
    expect(preset.brand.subtitleVisible).toBe(true);
    const catalog = [...VISUAL_PRESETS, preset];
    expect(applyVisualPreset({ titleColor: '#fff' }, preset.id, catalog)).toMatchObject({
      bg: '#101010', accent: '#beff22', subtitleVisible: true,
    });
    expect(getSlideOverridesForPreset(preset.id, catalog)).toMatchObject({
      layout: 'bl', align: 'left', textBg: true, textBgOpacity: 69,
    });
  });

  it('persiste e filtra entradas inválidas do banco local', () => {
    const storage = memoryStorage();
    const preset = createCustomVisualPreset({ label: 'Meu padrão', brand: { bg: '#000000' }, slide: {} });
    expect(writeCustomVisualPresets([preset, { id: 'ruim' }], storage)).toBe(true);
    expect(readCustomVisualPresets(storage)).toHaveLength(1);
    expect(normalizeCustomVisualPresets([preset, preset])).toHaveLength(1);
  });
});
