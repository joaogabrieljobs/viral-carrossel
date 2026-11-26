import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/apoteose-social-free-8.json';
import { applyFreeSocialDesign } from '../../src/utils/social-free-design.js';
import { wcagContrast } from '../../src/utils/wcag.js';

const formats = { carrossel: 1350, quadrado: 1080, stories: 1920 };
const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) + 0.01
  && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y) + 0.01;

function generated(formato) {
  const source = fixture.response.slides.map((slide, index) => ({ ...structuredClone(slide), id: `free-live-${index}` }));
  const deckDesign = { ...structuredClone(fixture.response.deckDesign), palette: {
    ...fixture.response.deckDesign.palette, bg: '#2B2158', accent: '#F8701E',
  } };
  const plan = { deckDesign, cards: source.map((slide, index) => ({ index, design: slide.design, scene: slide.scene, eyebrow: slide.eyebrow })) };
  return applyFreeSocialDesign(source, { preset: 'social_free', formato, plan, deckDesign,
    // O segundo navegador revelou a falha com a logo realmente persistida
    // de 260 px; não reduzir a fixture para ganhar altura artificialmente.
    brand: { logo: 'data:image/png;base64,LOGO', logoSize: 260, logoPosition: 'tr' } });
}

describe('Livre social: defeitos encontrados na geração completa', () => {
  it.each(Object.keys(formats))('%s: chapéu de card com foto recortada fica fora da foto', (formato) => {
    const slides = generated(formato);
    for (const index of [2, 5]) {
      const slide = slides[index];
      const descriptor = slide.socialArt.chrome.find(d => d.t === 'text' && d.text === '{eyebrow}');
      expect(descriptor, `chapéu ${index + 1}`).toBeDefined();
      const label = { x: descriptor.x, y: descriptor.y, w: descriptor.w, h: descriptor.size * 1.3 / formats[formato] * 100 };
      expect(slide.socialArt.textOnPhoto).toBe(false);
      expect(overlap(label, slide.canvas.zones.photo), `chapéu ${index + 1}`).toBe(false);
      expect(overlap(label, slide.canvas.zones.title), `título ${index + 1}`).toBe(false);
      expect(slide.socialArt.density, `leitura ${index + 1}`).toBe('ok');
    }
  });

  it('o destaque colorido usa a tinta medida na superfície real, sem alterar a paleta do deck', () => {
    const slides = generated('quadrado');
    for (const slide of slides) {
      expect(slide.socialDeckDesign.palette.accent).toBe('#F8701E');
      expect(wcagContrast(slide.presentationPaletteOverrides.accent, slide.socialFreeTextSurfaces.title), slide.title).toBeGreaterThanOrEqual(4.5);
    }
  });
});
