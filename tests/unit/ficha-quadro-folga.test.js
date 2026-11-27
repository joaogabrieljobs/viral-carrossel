// Defeito visto na captura do card 4 (Stories): o quadro em volta do apoio
// da Ficha descia para dentro da lista e subia até o título. O mesmo quadro
// do estilo fixo Ficha no Stories entrava 19 px na lista. O quadro agora fica
// entre os vizinhos, com folga de 8 px.
import { describe, expect, it } from 'vitest';
import { FORMATOS, apoteoseBrand, apoteoseLivre, fixture, pct } from '../helpers/apoteose-livre.js';
import { applySocialVisualComposition } from '../../src/utils/social-visual-composition.js';
import { VISUAL_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';

function check(slide, formato, label) {
  const frame = slide.socialArt.chrome.find(d => d.t === 'frame');
  expect(frame, `${label}: quadro do apoio`).toBeDefined();
  const { title, evidence } = slide.canvas.zones;
  expect(evidence, `${label}: lista`).toBeDefined();
  const used = Math.min(title.h, slide.socialArt.titleUsed ?? title.h);
  expect(frame.y + frame.h, `${label}: base do quadro antes da lista`).toBeLessThanOrEqual(evidence.y - pct(8, formato) + 0.01);
  expect(frame.y, `${label}: topo do quadro abaixo do título`).toBeGreaterThanOrEqual(title.y + used + pct(8, formato) - 0.01);
}

describe('Ficha: quadro do apoio com folga do título e da lista (card 4)', () => {
  it.each(FORMATOS)('Livre %s', formato => check(apoteoseLivre(formato)[3], formato, `Livre ${formato}`));

  it.each(FORMATOS)('estilo fixo Ficha %s', formato => {
    const preset = VISUAL_PRESETS.find(item => item.id === 'social_ficha');
    const source = fixture.response.slides.map((slide, index) => ({ id: `ficha-${index}`, title: slide.title, subtitle: slide.subtitle,
      bodyAfterImage: slide.bodyAfterImage, presentationBlocks: slide.presentationBlocks }));
    const slides = applySocialVisualComposition(source, { preset, brand: applyVisualPreset({ ...apoteoseBrand }, preset.id, VISUAL_PRESETS), formato });
    check(slides[3], formato, `Ficha ${formato}`);
  });
});
