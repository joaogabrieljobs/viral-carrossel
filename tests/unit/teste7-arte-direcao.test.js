import { describe, expect, it } from 'vitest';
import { buildImagePrompt } from '../../shared/image-prompt.js';
import { composeDeckArtImageDirection, DECK_ART_SCENE } from '../../src/utils/deck-art.js';
import { FREE_ART_GRAPHIC_FROM, FREE_ART_TEXT_MAX } from '../../src/utils/free-design.js';

const palette = [
  { role: 'base', hex: '#F0F0F0' },
  { role: 'subject_light', hex: '#D5D5D5' },
  { role: 'shadow', hex: '#454545' },
  { role: 'graphic', hex: '#111111' },
  { role: 'accent', hex: '#707070' },
];
const visualDirection = {
  palette,
  finish: 'Smooth flat color, no grain or print texture.',
  atmosphere: 'Calm and technical, with soft diffuse neutral light.',
  graphics: 'none',
  avoid: 'Organic shapes and print textures.',
};
const artSlide = (direction) => ({
  id: 'art', presentationPresetId: 'presentation_free',
  presentationFreeDesign: { ground: 'art', photo: 'none' },
  ...(direction ? { presentationPlan: { visualDirection: direction } } : {}),
});
const request = (direction, extra = {}) => {
  const parts = composeDeckArtImageDirection({ slides: [artSlide(direction)], ...extra });
  return { parts, ...buildImagePrompt({ scene: DECK_ART_SCENE, ...parts }, { route: 'sjinn' }) };
};
const generatedScene = parts => [parts.sceneBrief.subject, parts.sceneBrief.light, parts.composition].join('\n');

describe('Teste 7: a arte usa a direção do projeto, sem uma estética global da Apoteose', () => {
  it('graphics none e acabamento sem grão chegam ao pedido sem instruções fixas contraditórias', () => {
    const { parts, prompt, dropped, trimmed, chars } = request(visualDirection);
    expect(prompt).toContain(`Finish: ${visualDirection.finish}`);
    expect(prompt).toContain('Graphics: no graphic interventions.');
    expect(prompt).toContain(`Atmosphere: ${visualDirection.atmosphere}`);
    expect(prompt).toContain(`Deck exclusions: ${visualDirection.avoid}`);
    expect(generatedScene(parts)).not.toMatch(/fine,? (?:even )?grain|organic graphic shape|cut-paper look|Screen-print texture|fluid shape|small cluster/i);
    expect(parts.avoid).toContain(visualDirection.avoid);
    expect(prompt).toContain(`left ${FREE_ART_TEXT_MAX}% of the frame`);
    expect(prompt).toContain('No people, faces, hands or bodies.');
    expect(prompt).toContain('No lettering, captions, logos or watermarks');
    expect({ dropped, trimmed }).toEqual({ dropped: [], trimmed: [] });
    expect(chars).toBeLessThanOrEqual(4000);
  });

  it('grafismo geométrico e luz neutra não ganham formas orgânicas, pontos ou acabamento de impressão', () => {
    const geometry = {
      ...visualDirection,
      graphics: 'One thin angular outline, with sharp corners and generous empty space.',
    };
    const { parts, prompt } = request(geometry);
    expect(prompt).toContain(`Graphics: ${geometry.graphics}`);
    expect(prompt).toContain('light on the subject #D5D5D5; shadows #454545');
    expect(prompt).toContain(geometry.atmosphere);
    expect(generatedScene(parts)).not.toMatch(/organic graphic shape|cut-paper look|rounded extensions|fluid shape|small cluster|Screen-print texture|fine,? (?:even )?grain/i);
    expect(parts.composition).toContain(`from about ${FREE_ART_GRAPHIC_FROM}% of the frame width`);
  });

  it('grão e recorte orgânico continuam disponíveis quando a própria direção pede esse acabamento', () => {
    const organic = {
      ...visualDirection,
      finish: 'Fine grain and a tactile screen-print finish.',
      atmosphere: 'Warm amber light with cool blue shadows.',
      graphics: 'A sparse organic cut-paper shape at the outer edge.',
      avoid: 'Photographic scenes and repeated motifs.',
    };
    const { parts, prompt, dropped, trimmed } = request(organic);
    expect(prompt).toContain(`Finish: ${organic.finish}`);
    expect(prompt).toContain(`Graphics: ${organic.graphics}`);
    expect(prompt).toContain(`Atmosphere: ${organic.atmosphere}`);
    expect(prompt).toContain(`Deck exclusions: ${organic.avoid}`);
    expect(generatedScene(parts)).not.toMatch(/rounded extensions|fluid shape|small cluster/i);
    expect({ dropped, trimmed }).toEqual({ dropped: [], trimmed: [] });
  });

  it('sem direção ou paleta, o fundo padrão é neutro e não ativa o acabamento fotográfico genérico', () => {
    const { parts, prompt, defaultAesthetic } = request();
    expect(prompt).not.toContain('#171344');
    expect(prompt).toContain('base colour, the dominant field #111111');
    expect(defaultAesthetic).toBe(false);
    expect(prompt).not.toContain('DEFAULT ART DIRECTION');
    expect(generatedScene(parts)).not.toMatch(/fine,? (?:even )?grain|organic graphic shape|cut-paper look|Screen-print texture/i);
    expect(prompt).toContain('No people, faces, hands or bodies.');
    expect(prompt).toContain('No lettering, captions, logos or watermarks');
  });
});
