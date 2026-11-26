import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { applyFreeSocialDesign, isFreeSocialSlide } from '../../src/utils/social-free-design.js';
import { applySocialVisualComposition, restyleSocialSlides, socialFormatPatch } from '../../src/utils/social-visual-composition.js';
import { applyVisualPresetToCard } from '../../src/utils/visual-scope.js';
import { applyPresentationVisualPresetToDoc } from '../../src/utils/presentation-state.js';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';
import { clearSocialFreeDocumentState } from '../../src/utils/social-free-state.js';
import { VISUAL_PRESETS, getSlideOverridesForPreset, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import { PRESENTATION_VISUAL_PRESETS } from '../../src/styles/presentation-presets.jsx';

const preset = VISUAL_PRESETS.find(item => item.socialFamily === 'revista');
const blocks = [
  { type: 'comparison', headers: ['Origem', 'Destino'], rows: [['Ateliê', 'Cidade']] },
  { type: 'steps', items: [{ title: 'Observar', body: 'Reconhecer a textura.' }, { title: 'Criar', body: 'Explorar novas formas.' }] },
  { type: 'metrics', items: [{ value: '8', label: 'Encontros', detail: 'Em uma temporada.' }] },
  { type: 'quote', text: 'Toda forma começa com uma pergunta.', author: 'Manifesto da oficina' },
  { type: 'bignumber', value: '42', label: 'Peças', detail: 'Na coleção original.' },
  { type: 'icons', items: [{ icon: 'music', title: 'Ideias', body: 'Nascem do encontro.' }, { icon: 'users', title: 'Pessoas', body: 'Criam em conjunto.' }] },
];
const blockNeedle = ['Ateliê', 'Reconhecer a textura.', 'Em uma temporada.', 'Toda forma começa com uma pergunta.', 'Na coleção original.', 'Nascem do encontro.'];
const make = (block = blocks[3], format = 'carrossel') => {
  const slides = applyFreeSocialDesign([0, 1, 2].map(index => ({ ...mkSlide(index + 1, DEFAULT_BRAND), id: `c${index}`, title: index === 0 ? 'Uma oficina aberta' : index === 2 ? 'Participe da conversa' : 'Uma ideia por vez', subtitle: 'Um contexto que continua visível.', bodyAfterImage: index === 0 ? 'Nossa assinatura original.' : '', eyebrow: index ? 'A OFICINA' : '',
    imageQuery: index === 0 ? 'Workshop with people' : '', ...(index === 0 ? { bgImageId: 'original-photo', bgImage: 'data:image/png;base64,YQ==' } : {}),
    presentationBlocks: index === 1 ? [block] : [], socialFreeDesign: { family: 'editorial', ground: index === 0 ? 'photo' : 'bg', photo: index === 0 ? 'full' : 'none', block: index === 1 ? block.type : 'none' },
  })), { preset: 'social_free', formato: format });
  return { fmt: format, productKind: 'carrossel', creativePreset: 'livre', visualPreset: 'social_free', brand: { ...DEFAULT_BRAND, showHandle: false, logo: null }, slides,
    socialPlan: { version: 1, kind: 'social_free', signature: 'Nossa assinatura original.', cards: slides.map(s => s.socialPlan) }, socialDeckDesign: slides[0].socialDeckDesign, socialQuality: { reviewDiagnostics: [{ outcome: 'repetition_none' }] }, formatViews: {} };
};
const switched = doc => restyleSocialSlides(doc.slides, { preset, brand: applyVisualPreset(doc.brand, preset.id), formato: doc.fmt, overrides: getSlideOverridesForPreset(preset.id) });
const render = (slide, fmt, brand) => renderToStaticMarkup(React.createElement(SlideCardInner, { slide, fmt, brand, num: 2, total: 3, creativePreset: 'livre', forExport: true }));
const expectInactive = slide => {
  expect(isFreeSocialSlide(slide)).toBe(false);
  expect(slide.socialPresetId).not.toBe('social_free');
  expect(slide.socialVisualPresetId).not.toBe('social_free');
  expect(slide.socialPlan?.kind).not.toBe('social_free');
  expect(slide.socialComposition || '').not.toMatch(/^free:/);
};

describe('Saída explícita do Livre social', () => {
  it('a geração Livre ignora o recorte herdado, enquanto o catálogo mantém a regra atual', () => {
    const source = [{ ...mkSlide(1, DEFAULT_BRAND), id: 'inset', title: 'Uma proposta própria', subtitle: 'Uma ideia legível.', socialFreeDesign: { family: 'revista', ground: 'bg', photo: 'none' } }];
    const free = applySocialVisualComposition(source, { preset: { id: 'social_free', isFree: true, productKind: 'carrossel' }, photoRegion: 'inset' });
    expect(free[0].socialComposition).toMatch(/^free:/);
    expect(free[0].canvas?.applied).toBe(true);
    expect(applySocialVisualComposition(source, { preset, photoRegion: 'inset' })).toBe(source);
  });

  it('estilo fixo remove os marcadores de geração sem alterar conteúdo, foto ou ordem', () => {
    const doc = make();
    const before = structuredClone(doc);
    const slides = switched(doc);
    slides.forEach((slide, index) => {
      expectInactive(slide);
      for (const key of ['id', 'title', 'subtitle', 'bodyAfterImage', 'eyebrow', 'bgImage', 'bgImageId', 'presentationBlocks']) expect(slide[key], key).toEqual(doc.slides[index][key]);
      expect(socialFormatPatch(slide, 'stories').socialComposition).not.toMatch(/^free:/);
    });
    expect(doc).toEqual(before);
  });

  it.each(blocks.map((block, index) => [block.type, block, blockNeedle[index]]))('o bloco %s continua visível depois de trocar para estilo fixo', (_type, block, needle) => {
    const doc = make(block);
    const slides = switched(doc);
    expect(slides[1].presentationBlocks).toEqual(doc.slides[1].presentationBlocks);
    for (const fmt of ['carrossel', 'quadrado', 'stories']) {
      const shown = slideForFormatDisplay(slides[1], fmt, {});
      expect(shown.canvas?.zones?.evidence).toBeTruthy();
      const html = render(shown, fmt, applyVisualPreset(doc.brand, preset.id));
      expect(html).toContain(needle);
      expect(html).toContain('Um contexto que continua visível.');
    }
  });

  it.each(blocks.map((block, index) => [block.type, block, blockNeedle[index]]))('o bloco %s com foto permanece ao adaptar o estilo fixo a outro formato', (_type, block, needle) => {
    const doc = make(block);
    doc.slides[1] = { ...doc.slides[1], imageQuery: 'Hands shaping clay in a workshop', bgImageId: 'block-photo', bgImage: 'data:image/png;base64,Yg==',
      socialFreeDesign: { ...doc.slides[1].socialFreeDesign, photo: 'half' } };
    const slides = switched(doc);
    for (const fmt of ['carrossel', 'quadrado', 'stories']) {
      const shown = slideForFormatDisplay(slides[1], fmt, {});
      expect(shown.bgImageId).toBe('block-photo');
      expect(shown.bgImage).toBe(doc.slides[1].bgImage);
      expect(shown.canvas?.zones?.photo?.w).toBeGreaterThan(2);
      expect(shown.canvas?.zones?.evidence?.h, fmt).toBeGreaterThan(0);
      const html = render(shown, fmt, applyVisualPreset(doc.brand, preset.id));
      expect(html).toContain(needle);
      expect(html).toContain('Um contexto que continua visível.');
      expect(shown.presentationBlocks).toEqual(doc.slides[1].presentationBlocks);
    }
  });

  it('o estilo individual no Feed muda só o card escolhido', () => {
    const doc = make();
    const result = applyVisualPresetToCard(doc, 1, preset, VISUAL_PRESETS);
    expectInactive(result.slides[1]);
    expect(result.slides[0]).toEqual(doc.slides[0]);
    expect(result.slides[2]).toEqual(doc.slides[2]);
    expect(result.socialPlan).toEqual(doc.socialPlan);
    expect(result.slides[1].presentationBlocks).toEqual(doc.slides[1].presentationBlocks);
  });

  it.each(['stories', 'quadrado'])('o estilo individual em %s fica só nessa vista após serializar', fmt => {
    const doc = make();
    doc.fmt = fmt;
    doc.formatViews = { [fmt]: { slides: { c1: { titleSize: 72, canvas: { ...doc.slides[1].canvas, userEdited: true } } } },
      carrossel: { slides: { c0: { logoSize: 123 } } } };
    const other = fmt === 'stories' ? 'quadrado' : 'stories';
    const otherBefore = slideForFormatDisplay(doc.slides[1], other, doc.formatViews);
    const result = JSON.parse(JSON.stringify(applyVisualPresetToCard(doc, 1, preset, VISUAL_PRESETS)));
    expectInactive(slideForFormatDisplay(result.slides[1], fmt, result.formatViews));
    expect(result.slides).toEqual(JSON.parse(JSON.stringify(doc.slides)));
    expect(slideForFormatDisplay(result.slides[1], other, result.formatViews)).toEqual(JSON.parse(JSON.stringify(otherBefore)));
    expect(result.socialPlan).toEqual(JSON.parse(JSON.stringify(doc.socialPlan)));
    expect(result.formatViews.carrossel).toEqual(doc.formatViews.carrossel);
  });

  it.each(['stories', 'quadrado'])('a segunda troca de estilo em %s continua isolada na mesma vista', fmt => {
    const doc = make();
    doc.fmt = fmt;
    const other = fmt === 'stories' ? 'quadrado' : 'stories';
    const otherBefore = slideForFormatDisplay(doc.slides[1], other, doc.formatViews);
    const first = JSON.parse(JSON.stringify(applyVisualPresetToCard(doc, 1, preset, VISUAL_PRESETS)));
    const secondPreset = VISUAL_PRESETS.find(item => item.socialFamily === 'manchete');
    const result = JSON.parse(JSON.stringify(applyVisualPresetToCard(first, 1, secondPreset, VISUAL_PRESETS)));
    const shown = slideForFormatDisplay(result.slides[1], fmt, result.formatViews);
    expectInactive(shown);
    expect(shown.visualPresetId).toBe(secondPreset.id);
    expect(shown.socialArt?.family).toBe('manchete');
    expect(result.slides).toEqual(JSON.parse(JSON.stringify(doc.slides)));
    expect(slideForFormatDisplay(result.slides[1], other, result.formatViews)).toEqual(JSON.parse(JSON.stringify(otherBefore)));
    expect(result.socialPlan).toEqual(JSON.parse(JSON.stringify(doc.socialPlan)));
    expect(result.formatViews[fmt].slides.c0).toBeUndefined();
    expect(result.formatViews[fmt].slides.c2).toBeUndefined();
  });

  it('limpar o projeto inteiro desativa também os resíduos nas vistas, conservando conteúdo', () => {
    const doc = make();
    doc.formatViews = { stories: { slides: { c1: { ...doc.slides[1], titleSize: 77 } }, brand: { logoSize: 133 } } };
    const result = clearSocialFreeDocumentState(doc);
    expect(result.socialPlan).toBeNull();
    expect(result.socialDeckDesign).toBeNull();
    expect(result.socialQuality).toBeNull();
    result.slides.forEach(expectInactive);
    expectInactive(result.formatViews.stories.slides.c1);
    expect(result.formatViews.stories.brand).toEqual(doc.formatViews.stories.brand);
    expect(result.formatViews.stories.slides.c1.titleSize).toBe(77);
    expect(result.slides[1].presentationBlocks).toEqual(doc.slides[1].presentationBlocks);
  });

  it('a troca de produto para apresentação não leva a flag social nem o plano global', () => {
    const doc = make();
    doc.formatViews = { stories: { slides: { c1: { socialFreeDesign: doc.slides[1].socialFreeDesign, socialPlan: doc.slides[1].socialPlan } } } };
    const result = applyPresentationVisualPresetToDoc(doc, PRESENTATION_VISUAL_PRESETS[0].id, PRESENTATION_VISUAL_PRESETS);
    expect(result.productKind).toBe('apresentacao');
    expect(result.socialPlan).toBeNull();
    result.slides.forEach(expectInactive);
    expect(result.slides[1].presentationBlocks).toEqual(doc.slides[1].presentationBlocks);
    expectInactive(result.formatViews.stories.slides.c1);
  });

  it('projetos sem opt-in conservam o mesmo objeto na limpeza e a composição de catálogo', () => {
    const doc = { fmt: 'carrossel', slides: [{ id: 'legacy', title: 'Uma ideia', subtitle: 'Um apoio', imageQuery: '' }], formatViews: {} };
    expect(clearSocialFreeDocumentState(doc)).toBe(doc);
    const plain = applySocialVisualComposition(doc.slides, { preset, brand: doc.brand });
    expect(plain[0].socialNativeBlocksFromFree).toBeUndefined();
    expect(plain[0].socialFreeDesign).toBeUndefined();
  });
});
