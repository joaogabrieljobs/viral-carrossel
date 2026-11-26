import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import * as catalog from '../../src/styles/visual-presets.jsx';
import { buildPresentationDesignSystemPromptBlock } from '../../src/styles/presentation-presets.jsx';
import { filterVisualPresetsForProduct, resolveInitialVisualPreset } from '../../src/components/panels/GenerateModal.jsx';
import VisualStylePicker from '../../src/components/VisualStylePicker.jsx';
import { quickVisiblePresets } from '../../src/components/panels/QuickAdjustmentsPanel.jsx';
import { recommendedGenerationVisualPreset } from '../../src/utils/generation-visual-choice.js';

describe('Livre social: escolha explícita, preservando o catálogo atual', () => {
  it('acrescenta o preset virtual a um catálogo próprio, sem alterar os 21 estilos', () => {
    const free = catalog.FREE_SOCIAL_VISUAL_PRESET;
    expect(free).toMatchObject({ id: 'social_free', productKind: 'carrossel', isFree: true, hidden: true, generationOnly: true });
    expect(catalog.VISUAL_PRESETS).toHaveLength(21);
    expect(catalog.VISUAL_PRESETS.some(p => p.id === 'social_free')).toBe(false);
    expect(catalog.SOCIAL_VISUAL_PRESET_CATALOG).toEqual([...catalog.VISUAL_PRESETS, free]);
  });

  it('a opção fica disponível nos fluxos de geração e não entra no Criar rápido', () => {
    const presets = catalog.SOCIAL_VISUAL_PRESET_CATALOG || [];
    expect(filterVisualPresetsForProduct(undefined, 'carrossel').some(p => p.id === 'social_free')).toBe(true);
    expect(resolveInitialVisualPreset({ presets, productKind: 'carrossel', defaultVisualPreset: 'social_free' })).toBe('social_free');
    expect(quickVisiblePresets(presets, true)).toEqual(catalog.VISUAL_PRESETS);
    expect(filterVisualPresetsForProduct(presets, 'apresentacao').some(p => p.id === 'social_free')).toBe(false);
  });

  it('as recomendações por narrativa permanecem iguais às do catálogo anterior', () => {
    const presets = catalog.SOCIAL_VISUAL_PRESET_CATALOG || [];
    expect(presets.length).toBe(22);
    for (const narrative of ['none', 'editorial', 'how_to', 'storytelling', 'viral', 'pain', 'deep', 'jornalistico', 'sensacionalista', 'tendencia_cultura', 'quick_erro_comum', 'quick_tendencia', 'quick_decodificacao', 'quick_comportamento']) {
      const options = { productKind: 'carrossel', narrative };
      expect(recommendedGenerationVisualPreset({ ...options, presets })?.id)
        .toBe(recommendedGenerationVisualPreset({ ...options, presets: catalog.VISUAL_PRESETS })?.id);
    }
  });

  it('selecionar Livre preserva a paleta, fontes e logo da marca para o roteiro', () => {
    expect(catalog.FREE_SOCIAL_VISUAL_PRESET).toBeDefined();
    const brand = { bg: '#173E2F', accent: '#F5C460', titleFont: 6, bodyFont: 2, subtitleFont: 2,
      logoImageId: 'marca-local', name: 'Minha marca', footerPillText: 'APOTEOSE', footerPillArrow: false,
      footerBarLeft: 'Acompanhe|As novidades', cultureHeaderLeft: 'Minha marca', showPageBadge: true };
    const result = catalog.applyVisualPreset(brand, 'social_free', catalog.SOCIAL_VISUAL_PRESET_CATALOG);
    expect(result).toMatchObject(brand);
    expect(brand).not.toHaveProperty('visualIdentityLocked');
  });

  it('o cartão de geração não aparece no seletor de edição existente', () => {
    const free = catalog.FREE_SOCIAL_VISUAL_PRESET;
    expect(free).toBeDefined();
    if (!free) return;
    const view = allowGenerationOnly => renderToStaticMarkup(React.createElement(VisualStylePicker, { value: null, presets: [free], onChange: () => {}, allowGenerationOnly }));
    expect(view(true)).toContain('Livre: o Moont decide');
    expect(view(false)).not.toContain('Livre: o Moont decide');
  });

  it('o modo social não vira um padrão de apresentação pelo marcador isFree', () => {
    expect(buildPresentationDesignSystemPromptBlock({ id: 'social_free', productKind: 'carrossel', isFree: true, label: 'Livre', desc: 'Composição por card.' }, 'auto', { planned: true })).toBe('');
  });
});
