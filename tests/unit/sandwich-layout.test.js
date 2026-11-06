import { describe, expect, it } from 'vitest';
import { sandwichFlowMetrics, SANDWICH_PHOTO_ZONE_MIN_H_PCT } from '../../src/utils/canvas-layout.js';

describe('composição sanduíche com pouco texto', () => {
  it('centraliza o conjunto e amplia a foto quando o card está esparso', () => {
    expect(sandwichFlowMetrics({
      title: 'O diagnóstico',
      subtitle: '22 anos de prática não salvam um site quebrado.',
      bodyAfterImage: 'A credibilidade começa na primeira tela.',
    })).toEqual({
      sparse: true,
      justifyContent: 'center',
      photoHeightPct: 38,
      photoMaxHeightPct: 40,
    });
  });

  it('mantém a composição original para texto longo ou posição manual', () => {
    const long = sandwichFlowMetrics({ title: 'Título', subtitle: 'Texto '.repeat(60), bodyAfterImage: 'Fecho' });
    expect(long).toMatchObject({ sparse: false, justifyContent: 'flex-start', photoHeightPct: SANDWICH_PHOTO_ZONE_MIN_H_PCT });
    const manual = sandwichFlowMetrics({ title: 'Curto', subtitle: 'Breve', bodyAfterImage: 'Fecho', elementOffsets: { photo: { x: 0, y: 4 } } });
    expect(manual.sparse).toBe(false);
  });
});
