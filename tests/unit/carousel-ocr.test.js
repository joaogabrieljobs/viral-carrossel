import { describe, expect, it } from 'vitest';
import {
  CAROUSEL_OCR_MAX_IMAGES,
  CAROUSEL_OCR_MAX_STORED_TEXT,
  CAROUSEL_OCR_MAX_TEXT_PER_IMAGE,
  normalizeCarouselImageEvidence,
  normalizeCarouselFileDataUrl,
  validateCarouselOcrFiles,
} from '../../src/utils/carousel-ocr.js';

describe('evidências OCR de carrosséis', () => {
  it('limita quantidade e texto salvo para não estourar o projeto local', () => {
    const raw = Array.from({ length: CAROUSEL_OCR_MAX_IMAGES + 4 }, (_, index) => ({
      name: `card-${index + 1}.png`,
      text: 'x'.repeat(CAROUSEL_OCR_MAX_TEXT_PER_IMAGE + 500),
    }));
    const normalized = normalizeCarouselImageEvidence(raw);
    expect(normalized.length).toBeLessThanOrEqual(CAROUSEL_OCR_MAX_IMAGES);
    expect(normalized.every((item) => item.text.length <= CAROUSEL_OCR_MAX_TEXT_PER_IMAGE)).toBe(true);
    expect(normalized.reduce((sum, item) => sum + item.text.length, 0)).toBeLessThanOrEqual(CAROUSEL_OCR_MAX_STORED_TEXT);
  });

  it('aceita PNG/JPG e recusa outros formatos antes do upload', () => {
    expect(validateCarouselOcrFiles([{ name: 'card.png', type: 'image/png', size: 1200 }])).toHaveLength(1);
    expect(validateCarouselOcrFiles([{ name: 'card.JPG', type: '', size: 1200 }])).toHaveLength(1);
    expect(() => validateCarouselOcrFiles([{ name: 'card.webp', type: 'image/webp', size: 1200 }])).toThrow(/PNG ou JPG/i);
  });

  it('corrige o MIME vazio do Safari antes de enviar PNG/JPG', () => {
    expect(normalizeCarouselFileDataUrl(
      'data:application/octet-stream;base64,AAAA',
      { name: 'card.PNG', type: '' },
    )).toBe('data:image/png;base64,AAAA');
    expect(normalizeCarouselFileDataUrl(
      'data:;base64,BBBB',
      { name: 'card.jpeg', type: '' },
    )).toBe('data:image/jpeg;base64,BBBB');
  });
});
