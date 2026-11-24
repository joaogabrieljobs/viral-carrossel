import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyBrandEdit, applyFormatEdit, brandForFormatDisplay, slideForFormatDisplay } from '../../src/utils/format-view.js';
import { clearOwnVisualsBeforePresetOnAll } from '../../src/utils/visual-scope.js';
import { applyPresentationVisualPresetToDoc } from '../../src/utils/presentation-state.js';
import { PRESENTATION_VISUAL_PRESET_CATALOG } from '../../src/styles/presentation-presets.jsx';
import { VISUAL_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import { applyTemplateToDoc, buildTemplateContent } from '../../src/utils/published-template.js';
import * as social from '../../src/utils/social-visual-composition.js';

// FE-22: fora do Feed (e sempre em apresentação) cor e fonte mexidas na Marca
// ficam guardadas na proporção e vencem a marca do projeto. "Todos" e o modelo
// da galeria gravavam só a marca do projeto: o aviso dizia aplicado e a tela
// continuava com o valor antigo.
const shownBrand = (doc) => brandForFormatDisplay(doc.brand, doc.fmt, doc.formatViews, doc.creativePreset);
const shownSlide = (doc, i) => slideForFormatDisplay(doc.slides[i], doc.fmt, doc.formatViews, doc.creativePreset);

const deck = () => ({
  productKind: 'apresentacao', creativePreset: 'apresentacao', fmt: 'apresentacao', presentationPath: 'auto',
  brand: { name: 'Clínica', handle: '@clinica', bg: '#ffffff', accent: '#111111', titleColor: '#000000', logoSize: 200 },
  slides: [1, 2, 3].map((n) => ({ id: `d${n}`, num: n, title: `Título ${n}`, subtitle: `Apoio ${n}`, layout: 'tl', titleSize: 100 })),
});
/** Mesmo caminho do painel Marca: a edição cai na vista da proporção. */
const editBrand = (doc, patch) => applyBrandEdit(doc, { ...shownBrand(doc), ...patch });

describe('FE-22 — "Todos" alcança a marca guardada por formato', () => {
  const preset = PRESENTATION_VISUAL_PRESET_CATALOG.find((item) => item.id === 'presentation_pitch_dark');

  it('apresentação: depois do padrão em "Todos", a marca exibida tem o fundo e o destaque do padrão', () => {
    const edited = editBrand(deck(), { bg: '#123456', accent: '#abcdef', logoSize: 120 });
    expect(edited.formatViews.apresentacao.brand).toMatchObject({ bg: '#123456', accent: '#abcdef' });
    const styled = applyPresentationVisualPresetToDoc(
      clearOwnVisualsBeforePresetOnAll(edited, preset), preset.id, PRESENTATION_VISUAL_PRESET_CATALOG,
    );
    expect(shownBrand(styled).bg).toBe(preset.brand.bg);
    expect(shownBrand(styled).accent).toBe(preset.brand.accent);
    // Logo não é do padrão: o tamanho escolhido nesta proporção continua.
    expect(shownBrand(styled).logoSize).toBe(120);
  });

  it('carrossel: cor ajustada só no Stories não sobrevive ao padrão aplicado a todos', () => {
    const style = VISUAL_PRESETS.find((item) => item.productKind !== 'apresentacao' && item.brand?.bg && item.brand?.titleFont);
    let doc = { fmt: 'stories', creativePreset: 'livre', brand: { bg: '#ffffff', titleFont: 'Inter', logoPosition: 'tr' },
      slides: [{ id: 'c1', title: 'Um' }] };
    doc = editBrand(doc, { bg: '#ff00ff', titleFont: 'Lobster', logoPosition: 'bl' });
    const cleared = clearOwnVisualsBeforePresetOnAll(doc, style);
    const styled = { ...cleared, brand: applyVisualPreset(cleared.brand, style.id) };
    expect(shownBrand(styled).bg).toBe(style.brand.bg);
    expect(shownBrand(styled).titleFont).toBe(style.brand.titleFont);
    expect(shownBrand(styled).logoPosition).toBe('bl');
  });

  it('continua tirando o estilo próprio de cada card na proporção aberta', () => {
    const own = applyFormatEdit(deck(), 1, { visualBrand: { bg: '#ff0000' }, visualPresetId: 'outro' });
    const cleared = clearOwnVisualsBeforePresetOnAll(own, preset);
    expect(shownSlide(cleared, 1).visualBrand).toBeNull();
    expect(shownSlide(cleared, 1).visualPresetId).toBeNull();
  });

  it('o editor usa esta função no alcance "Todos"', () => {
    const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
    expect(app).toContain('d = clearOwnVisualsBeforePresetOnAll(d, preset);');
  });
});

describe('FE-22 — modelo da galeria vale em toda proporção e tira a composição anterior', () => {
  const autora = () => ({
    fmt: 'carrossel',
    brand: { titleFont: 'Playfair Display', bg: '#111111', titleColor: '#ffffff', accent: '#00ff88' },
    slides: [
      { id: 'a1', layout: 'mc', align: 'center', overlay: 50, titleSize: 130 },
      { id: 'a2', layout: 'ml', align: 'left', titleSize: 90 },
      { id: 'a3', layout: 'mb', align: 'center', titleSize: 100 },
    ],
  });
  const content = () => buildTemplateContent(autora());

  it('apresentação: layout, tamanho e cores mexidos antes passam a ser os do modelo', () => {
    let doc = editBrand(deck(), { bg: '#123456', accent: '#abcdef', logoSize: 120 });
    doc = applyFormatEdit(doc, 0, { layout: 'br', titleSize: 60, logoSize: 90, bgX: 10 });
    expect(shownSlide(doc, 0)).toMatchObject({ layout: 'br', titleSize: 60 });
    const applied = applyTemplateToDoc(doc, content());
    // Igual ao mesmo modelo num projeto que nunca foi ajustado (no 16:9 o
    // tamanho do título é mostrado na escala da proporção).
    const pristine = shownSlide(applyTemplateToDoc(deck(), content()), 0);
    expect(pristine).toMatchObject({ layout: 'mc', align: 'center' });
    for (const key of ['layout', 'align', 'titleSize', 'overlay']) expect(shownSlide(applied, 0)[key], key).toBe(pristine[key]);
    expect(shownBrand(applied)).toMatchObject({ bg: '#111111', accent: '#00ff88', titleFont: 'Playfair Display' });
    // Logo e recorte da foto são do projeto: o modelo não mexe.
    expect(shownSlide(applied, 0)).toMatchObject({ logoSize: 90, bgX: 10 });
    expect(shownBrand(applied).logoSize).toBe(120);
  });

  it('projeto sem ajuste por formato fica como antes', () => {
    const applied = applyTemplateToDoc(deck(), content());
    expect(applied.formatViews).toBeUndefined();
    expect(applied.slides.map((slide) => slide.layout)).toEqual(['mc', 'ml', 'mb']);
  });

  it('nenhuma marca da composição anterior sobra no card', () => {
    const marks = { socialComposition: 'v4:coverBleed', socialCompositionVersion: 4, socialVisualPresetId: 'viral_hype_dark',
      socialZoneAnchors: { title: 'end' }, overlayMode: 'scrim', socialScrimTop: 41, socialArt: { family: 'manchete', chrome: [] },
      socialFunction: 'opener', socialFamily: 'manchete', socialPhotoTreatment: 'sepia', titleItalic: true,
      subtitleWeight: 600, hideFooterPill: true, subtitleCase: 'upper', subtitleItalic: true };
    expect(Object.keys(marks).sort()).toEqual([...social.SOCIAL_COMPOSITION_FIELDS].sort());
    const doc = { fmt: 'carrossel', brand: {}, slides: [{ id: 'x', title: 'Fica', bgImageId: 'foto', ...marks }] };
    const [slide] = applyTemplateToDoc(doc, content()).slides;
    for (const field of social.SOCIAL_COMPOSITION_FIELDS) expect(slide[field], field).toBeUndefined();
    expect(slide).toMatchObject({ id: 'x', title: 'Fica', bgImageId: 'foto', layout: 'mc' });
  });
});
