import { describe, it, expect } from 'vitest';
import { recommendedGenerationVisualPreset, resolveCreationVisualSelection } from '../../src/utils/generation-visual-choice.js';
import { NARRATIVE_CHOICES, applyCreationVisualChoice, captureCreationVisualIdentity } from '../../src/utils/create-project-flow.js';
import { VISUAL_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import { PRESENTATION_PATHS } from '../../src/utils/presentation.js';
import { PRESENTATION_VISUAL_PRESETS } from '../../src/styles/presentation-presets.jsx';
import { applySocialVisualComposition } from '../../src/utils/social-visual-composition.js';
import { needsLightPhotoText } from '../../src/utils/style-kit-design.js';

describe('design recomendado na criação', () => {
  const presets = [...VISUAL_PRESETS, ...PRESENTATION_VISUAL_PRESETS];
  it('cada modo social recebe um preset existente sem mudar a narrativa', () => {
    const ids = NARRATIVE_CHOICES.map(({ id }) => {
      const result = recommendedGenerationVisualPreset({ narrative: id, presets });
      expect(VISUAL_PRESETS).toContain(result);
      return result.id;
    });
    expect(new Set(ids).size).toBeGreaterThanOrEqual(6);
  });
  it('recomenda os 12 estilos virais e também as famílias editoriais, sempre visíveis no seletor', () => {
    const ids = NARRATIVE_CHOICES.map(({ id }) => recommendedGenerationVisualPreset({ narrative: id, presets }));
    for (const p of ids) expect(p.hidden).toBeFalsy();
    const virais = ids.filter((p) => !p.socialFamily).map((p) => p.id);
    const familias = ids.filter((p) => p.socialFamily).map((p) => p.id);
    expect(new Set(virais).size).toBeGreaterThanOrEqual(4);
    expect(new Set(familias).size).toBeGreaterThanOrEqual(2);
    expect(recommendedGenerationVisualPreset({ narrative: 'viral', presets }).id).toBe('tabloid_keywords');
    expect(recommendedGenerationVisualPreset({ narrative: 'how_to', presets }).id).toBe('social_ficha');
  });
  it('usa os presets de apresentação associados aos sete caminhos', () => {
    for (const path of PRESENTATION_PATHS) {
      const result = recommendedGenerationVisualPreset({ productKind: 'apresentacao', presentationPath: path.id, presets });
      expect(result.id).toBe(path.suggestedVisualPreset);
      expect(result.productKind).toBe('apresentacao');
    }
  });
  it('aplica paleta real no padrão e preserva identidade salva ou ajustada no automático', () => {
    const brand = { bg: '#ffffff', titleColor: '#111111', titleFont: 'Minha fonte', logoImageId: 'logo', defaultTone: 'Direto' };
    const standard = resolveCreationVisualSelection({ selection: 'auto', narrative: 'viral', presets });
    expect(standard.preserveBrandIdentity).toBe(false);
    const styled = applyVisualPreset(brand, standard.presetId, presets);
    expect(styled.bg).toBe(standard.preset.brand.bg);
    expect(styled.titleFont).toBe(standard.preset.brand.titleFont);
    expect(styled.logoImageId).toBe('logo');
    const saved = resolveCreationVisualSelection({ selection: 'auto', narrative: 'viral', presets, preserveIdentity: true });
    expect(saved.presetId).toBe(standard.presetId);
    expect(saved.preserveBrandIdentity).toBe(true);
    expect(brand.titleFont).toBe('Minha fonte');
  });
  it('respeita estilo explícito e a opção de manter só a identidade', () => {
    expect(resolveCreationVisualSelection({ selection: null, presets }).presetId).toBeNull();
    const selected = resolveCreationVisualSelection({ selection: 'mood_sepia', narrative: 'viral', presets, preserveIdentity: true });
    expect(selected.presetId).toBe('mood_sepia');
    expect(selected.preserveBrandIdentity).toBe(false);
    const brand = { bg: '#fff', logoImageId: 'logo' };
    const base = captureCreationVisualIdentity(brand);
    const preview = applyCreationVisualChoice(brand, base, selected.preset);
    expect(applyCreationVisualChoice(preview, base).bg).toBe('#fff');
  });
  it('não recomenda presets customizados ou de outro produto por acidente', () => {
    expect(recommendedGenerationVisualPreset({ presets: [{ id: 'custom', isCustom: true }] })).toBeNull();
    expect(recommendedGenerationVisualPreset({ productKind: 'apresentacao', presets: VISUAL_PRESETS })).toBeNull();
  });
});

describe('composição social com design e conteúdo preservados', () => {
  const source = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, title: 'Uma ideia clara', subtitle: 'Explicação completa.', bodyAfterImage: i > 1 ? 'Condição importante.' : '', imageQuery: 'portrait with the supplied product', useCultureLayout: true, canvas: { applied: false } }));
  it('distribui foto e texto sem a faixa estreita nem metade inferior abandonada', () => {
    const preset = VISUAL_PRESETS.find(p => p.id === 'editorial_magazine');
    const result = applySocialVisualComposition(source, { preset });
    // Composição v4 dos 12 estilos: capa em sangria; a foto do miolo vai em
    // coluna larga (48%), sem a faixa estreita, e o apoio chega perto da base.
    expect(result[0].socialComposition).toBe('v4:vCoverBleed');
    expect(result[2].socialComposition).toMatch(/^v4:vPhoto(Column|Top)$/);
    const fotoMiolo = result[2].canvas.zones.photo;
    // Coluna de ponta a ponta com 48% de largura, ou faixa larga no topo.
    expect(fotoMiolo.h === 100 ? fotoMiolo.w >= 44 : fotoMiolo.w === 100).toBe(true);
    expect(result[2].canvas.zones.subtitle.y + result[2].canvas.zones.subtitle.h).toBeGreaterThanOrEqual(88);
    expect(result[0].canvas.zones.subtitle.y + result[0].canvas.zones.subtitle.h).toBeLessThanOrEqual(91.5);
    expect(result[2].bgFit).toBe('cover');
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toMatchObject({ id: source[i].id, title: source[i].title, subtitle: source[i].subtitle, bodyAfterImage: source[i].bodyAfterImage, imageQuery: source[i].imageQuery });
      expect(result[i].canvas.preserveZones).toBe(true);
      expect(result[i].useCultureLayout).toBe(false);
    }
    expect(source[2].canvas.applied).toBe(false);
  });
  it('mantém estilos personalizados e organização explícita da foto', () => {
    // Padrão personalizado agora recebe a composição da biblioteca v4 (família
    // deduzida da fonte da marca), sem trocar texto nem foto.
    const custom = applySocialVisualComposition(source, { preset: { isCustom: true } });
    expect(custom[0].socialCompositionVersion).toBe(4);
    custom.forEach((s, i) => expect(s).toMatchObject({ title: source[i].title, subtitle: source[i].subtitle, imageQuery: source[i].imageQuery }));
    expect(applySocialVisualComposition(source, { preset: VISUAL_PRESETS[0], photoRegion: 'top' })).toBe(source);
  });
  it('sem foto usa composição tipográfica; foto escura sem corpo também recebe contraste', () => {
    const result = applySocialVisualComposition([{ ...source[0], imageQuery: '' }], { preset: VISUAL_PRESETS.find(p => p.id === 'sports_editorial') });
    expect(result[0].socialComposition).toBe('v4:vCoverType');
    expect(result[0].overlay).toBe(0);
    expect(needsLightPhotoText({ bgImage: 'photo', overlay: 70, useCultureLayout: true, bodyAfterImage: '' })).toBe(true);
    expect(needsLightPhotoText({ bgImage: 'photo', overlay: 70, useCultureLayout: true, bodyAfterImage: 'Corpo de um sanduíche.' })).toBe(false);
  });
});
