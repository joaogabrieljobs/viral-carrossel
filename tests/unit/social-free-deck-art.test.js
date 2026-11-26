import { describe, expect, it } from 'vitest';
import { applyDeckArt, composeDeckArtImageDirection, deckArtSlides, deckImageCredits, deckNeedsArt, slideShowsDeckArt } from '../../src/utils/deck-art.js';
import { buildImagePrompt } from '../../shared/image-prompt.js';

const visualDirection = {
  palette: [{ role: 'base', hex: '#17364B' }, { role: 'subject_light', hex: '#E6BC65' }, { role: 'graphic', hex: '#75BED0' }],
  finish: 'Flat clean colour, no grain.', atmosphere: 'Calm workshop.', graphics: 'none', avoid: 'Organic shapes and print textures.',
};
const card = (id, art = true) => ({
  id, socialPresetId: 'social_free', imageQuery: 'A workshop scene',
  socialFreeDesign: { ground: art ? 'art' : 'photo', photo: art ? 'none' : 'full' },
  socialPlan: { visualDirection }, socialDeckDesign: { palette: { bg: '#17364B' } },
  canvas: { zones: { title: { x: 8, y: 12, w: 62, h: 20 }, subtitle: { x: 8, y: 40, w: 62, h: 25 } } },
});

describe('Arte única do Livre social', () => {
  it('reserva somente um crédito de arte e nenhum de foto nos cards sem foto', () => {
    const slides = [card('a'), card('b'), card('c', false)];
    expect(deckArtSlides(slides)).toHaveLength(2);
    expect(deckNeedsArt(slides)).toBe(true);
    expect(deckImageCredits(slides)).toEqual({ photos: 1, art: 1, total: 2 });
    const applied = applyDeckArt(slides, { presentationArtImageId: 'shared', presentationArtImage: 'data:image/png;base64,YQ==' });
    expect(applied[0].presentationArtImageId).toBe('shared');
    expect(applied[1].presentationArtImageId).toBe('shared');
    expect(applied[2]).toBe(slides[2]);
    expect(slideShowsDeckArt(applied[0])).toBe(true);
    expect(deckImageCredits(applied)).toEqual({ photos: 1, art: 0, total: 1 });
  });

  it.each([['carrossel', '1080 × 1350'], ['quadrado', '1080 × 1080'], ['stories', '1080 × 1920']])('pede fundo no formato real %s e respeita graphics none', (fmt, dimensions) => {
    const parts = composeDeckArtImageDirection({ slides: [card('a'), card('b')], fmt });
    expect(parts.format).toBe('carousel');
    expect(parts.socialFree).toBe(true);
    expect(parts.composition).toContain(dimensions);
    const built = buildImagePrompt({ scene: parts.sceneBrief.query, ...parts }, { route: 'sjinn' });
    expect(built.prompt).toContain('Graphics: no graphic interventions.');
    expect(built.prompt).toContain('Flat clean colour, no grain.');
    expect(built.prompt).not.toContain('16:9');
    expect(built.prompt).not.toContain('DEFAULT ART DIRECTION');
    expect(built.prompt).not.toContain('#171344');
    expect(built.chars).toBeLessThanOrEqual(4000);
  });
});
