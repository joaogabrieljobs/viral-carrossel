import { describe, expect, it } from 'vitest';
import { slidesPendingImageGeneration, imageBatchSelection } from '../../src/utils/image-generation-readiness.js';

const slides = [
  { id: 'photo', imageQuery: 'A party', presentationFreeDesign: { photo: 'half' } },
  { id: 'text', imageQuery: 'Residual AI instruction', presentationFreeDesign: { photo: 'none', ground: 'inverse' } },
  { id: 'art', imageQuery: 'Residual art instruction', presentationFreeDesign: { photo: 'none', ground: 'art' } },
  { id: 'retry', imageQuery: 'A DJ', presentationFreeDesign: { photo: 'none' }, presentationImageFallback: { originalDesign: { photo: 'half' } } },
  { id: 'legacy', imageQuery: 'Legacy photo' },
];

describe('Teste 7: lote posterior respeita os slides sem foto', () => {
  it('gera apenas a foto prevista, o retry temporário e os cards comuns', () => {
    expect(slidesPendingImageGeneration(slides).map(({ slide }) => slide.id)).toEqual(['photo', 'retry', 'legacy']);
  });
  it('selecionar todos não põe no orçamento nem gera foto nos slots de texto e arte', () => {
    const selection = imageBatchSelection(slides, slides.map(slide => slide.id));
    expect(selection.selectedIds).toEqual(['photo', 'retry', 'legacy']);
  });
});
