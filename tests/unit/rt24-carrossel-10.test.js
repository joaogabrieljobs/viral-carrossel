import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { mkSlide } from '../../src/utils/doc-schema.js';
import { VISUAL_PRESETS, SOCIAL_FAMILY_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import { applySocialVisualComposition, logoBoxPct } from '../../src/utils/social-visual-composition.js';
import { applyGenerationLogoPolicy, applyLogoAssetToSlides, brandWithSlideLogo } from '../../src/utils/slide-logo.js';
import { formatFrame } from '../../src/utils/social-families.js';

// RT24 item 10 (reteste real de 24/11): "logo do projeto enviada não aparece
// nos cards do estilo Ficha técnica". Investigado: o estilo não esconde a logo,
// a composição não a tira e a margem mínima de 24/11 não a move (a margem mexe
// no texto, nunca na logo). Com a logo aplicada aos cards, ela é desenhada na
// Ficha técnica como nos outros estilos, no editor e no arquivo. O que o
// reteste viu é a regra documentada do Studio (docs/product/guia-projetos-geracao.md,
// "Aplicar uma logo já salva"): importar a logo em Marca → Deste projeto vale
// para os cards gerados depois; os que já existem recebem a logo por
// Marca → Logo → "Inserir logo em todos os cards".
const LOGO = 'data:image/png;base64,AAAA';
const FOTO = 'data:image/png;base64,BBBB';
const PRESETS = [...VISUAL_PRESETS, ...SOCIAL_FAMILY_PRESETS];
const CARDS = [
  { title: 'Get your new San Diego site in 2 steps', subtitle: 'We build it first, you pay $797 when you like it.', imageQuery: 'frog', bgImage: FOTO },
  { title: 'Step 1 · Send your link or fill the brief', subtitle: 'Go to blkfrog.com/brief and send your current link.', imageQuery: 'frog', bgImage: FOTO },
  { title: 'Pay $797 only when you like it', subtitle: 'You only pay when you like the new site.', imageQuery: '' },
  { title: 'Send us your link', subtitle: 'Start at blkfrog.com/brief.', imageQuery: '' },
];
function projeto(presetId) {
  const preset = PRESETS.find((p) => p.id === presetId);
  const brand = applyVisualPreset({ name: 'BLK FROG', handle: '' }, preset.id);
  const cards = CARDS.map((c, i) => ({ ...mkSlide(i + 1, brand), ...c }));
  return { preset, brand, cards };
}
const desenhar = (slide, brand, index, forExport) => renderToStaticMarkup(React.createElement(SlideCardInner, {
  slide, brand: brandWithSlideLogo(brand, slide), fmt: 'carrossel', num: index + 1, total: CARDS.length, forExport, creativePreset: 'livre',
}));
const temLogo = (html) => /<img[^>]*data-vc-brand-logo[^>]*>/.test(html) && html.includes(`src="${LOGO}"`);

describe('RT24 carrossel 10: a logo do projeto aparece nos cards da Ficha técnica', () => {
  it.each(['social_ficha', 'social_revista', 'sports_editorial'])('%s: logo aplicada na geração é desenhada em todos os cards, no editor e no arquivo', (presetId) => {
    const { preset, brand, cards } = projeto(presetId);
    const comLogo = applyGenerationLogoPolicy(cards, { enabled: true, projectLogoAsset: { logoImageId: 'img_logo', logoImage: LOGO }, hasBrandLogo: false });
    const slides = applySocialVisualComposition(comLogo, { preset, brand });
    slides.forEach((slide, index) => {
      expect(slide.logoImage).toBe(LOGO);
      expect(slide.logoHidden).toBe(false);
      // A composição reserva o canto da logo e a caixa dela fica dentro do card.
      expect(slide.socialArt.logo).toMatchObject({ pos: 'tr' });
      const box = logoBoxPct(slide.socialArt.logo, formatFrame('carrossel'));
      expect(box.x0).toBeGreaterThan(0); expect(box.x1).toBeLessThan(100); expect(box.y0).toBeGreaterThan(0); expect(box.y1).toBeLessThan(100);
      for (const forExport of [false, true]) expect(temLogo(desenhar(slide, brand, index, forExport)), `card ${index + 1}`).toBe(true);
    });
  });

  it('Ficha técnica: logo aplicada depois, em projeto já composto, também é desenhada', () => {
    const { preset, brand, cards } = projeto('social_ficha');
    const compostos = applySocialVisualComposition(cards, { preset, brand });
    expect(compostos.every((slide, index) => !temLogo(desenhar(slide, brand, index, true)))).toBe(true);
    const slides = applyLogoAssetToSlides(compostos, { logoImageId: 'img_logo', logoImage: LOGO });
    slides.forEach((slide, index) => { for (const forExport of [false, true]) expect(temLogo(desenhar(slide, brand, index, forExport))).toBe(true); });
  });

  it('logo só guardada no projeto (sem aplicar nos cards) não aparece: é a regra para cards que já existem', () => {
    const { preset, brand, cards } = projeto('social_ficha');
    const slides = applySocialVisualComposition(cards, { preset, brand });
    expect(slides.some((slide) => slide.logoImage || slide.logoImageId)).toBe(false);
  });
});
