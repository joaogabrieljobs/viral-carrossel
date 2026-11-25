import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { mkSlide } from '../../src/utils/doc-schema.js';
import { VISUAL_PRESETS, SOCIAL_FAMILY_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import { applySocialVisualComposition } from '../../src/utils/social-visual-composition.js';
import { ContentLabelLanguageContext } from '../../src/utils/content-label-language.js';
import { labelTemplateWithoutPhoto, localizeLabelTemplate } from '../../src/utils/fixed-labels.js';

// RT24 item 9 (reteste real de 24/11): no carrossel "Ensinar" (Ficha técnica,
// inglês) os cards 4 e 5 diziam "§04 · FIGURE" com a zona de foto vazia.
const FOTO = 'data:image/png;base64,AAAA';
const preset = [...VISUAL_PRESETS, ...SOCIAL_FAMILY_PRESETS].find((p) => p.id === 'social_ficha');
const brand = applyVisualPreset({ name: 'BLK FROG', handle: '' }, preset.id);
const cards = [
  { title: 'Get your new San Diego site in 2 steps', subtitle: 'We build it first, you pay $797 when you like it.', imageQuery: 'frog', bgImage: FOTO },
  { title: 'Step 1 · Send your link or fill the brief', subtitle: 'Go to blkfrog.com/brief and send your current link.', imageQuery: 'frog', bgImage: FOTO },
  { title: 'Pay $797 only when you like it', subtitle: 'You only pay when you like the new site. The price is $797.', imageQuery: 'frog holding a card' },
  { title: 'Offer ends Nov 30, 11:59 PM PT', subtitle: 'Your new site for $797, with a new logo.', imageQuery: 'calendar on a desk', bgImageId: 'img_a_caminho' },
  { title: 'Send us your link', subtitle: 'Start at blkfrog.com/brief.', imageQuery: '' },
].map((c, i) => ({ ...mkSlide(i + 1, brand), ...c }));
const slides = applySocialVisualComposition(cards, { preset, brand });
const desenhar = (index, lang, forExport) => renderToStaticMarkup(React.createElement(
  ContentLabelLanguageContext.Provider, { value: lang },
  React.createElement(SlideCardInner, { slide: slides[index], brand, fmt: 'carrossel', num: index + 1, total: slides.length, forExport, creativePreset: 'livre' }),
));

describe('RT24 carrossel 9: rótulo de figura só em card com figura', () => {
  it('a composição marca os cards 2 a 4 como figura (têm foto ou pedido de foto)', () => {
    expect(slides.slice(1, 4).map((s) => s.socialArt.fn)).toEqual(['photo', 'photo', 'photo']);
  });

  it.each([false, true])('inglês, arquivo=%s: card com foto diz FIGURE; card sem foto não', (forExport) => {
    expect(desenhar(1, 'en', forExport)).toContain('§02 · FIGURE');
    const semFoto = desenhar(2, 'en', forExport);
    expect(semFoto).not.toContain('FIGURE');
    expect(semFoto).toContain('§03 · POINT');
  });

  it.each([false, true])('português, arquivo=%s: FIGURA só com foto; sem foto, PONTO', (forExport) => {
    expect(desenhar(1, 'pt-BR', forExport)).toContain('§02 · FIGURA');
    const semFoto = desenhar(2, 'pt-BR', forExport);
    expect(semFoto).not.toContain('FIGURA');
    expect(semFoto).toContain('§03 · PONTO');
    expect(desenhar(2, 'es', forExport)).toContain('§03 · PUNTO');
  });

  it('foto a caminho (guardada no aparelho, ainda não lida) já conta como figura', () => {
    expect(desenhar(3, 'en', true)).toContain('§04 · FIGURE');
  });

  it('a troca é só do rótulo de figura; os outros rótulos e o texto da pessoa ficam', () => {
    expect(labelTemplateWithoutPhoto('§{n} · FIGURA')).toBe('§{n} · PONTO');
    expect(labelTemplateWithoutPhoto('§{n} · FECHO')).toBe('§{n} · FECHO');
    expect(labelTemplateWithoutPhoto('§{n} · {marca?}')).toBe('§{n} · {marca?}');
    expect(labelTemplateWithoutPhoto('FIGURAS {n}')).toBe('FIGURAS {n}');
    expect(desenhar(4, 'en', true)).toContain('§05 · CLOSING');
  });

  it('"CENA {n}" já segue o idioma do conteúdo, pelos mesmos rótulos fixos', () => {
    expect(localizeLabelTemplate('CENA {n}', 'en')).toBe('SCENE {n}');
    expect(localizeLabelTemplate('CENA {n}', 'es')).toBe('ESCENA {n}');
    expect(localizeLabelTemplate('CENA {n}', 'pt-BR')).toBe('CENA {n}');
  });
});
