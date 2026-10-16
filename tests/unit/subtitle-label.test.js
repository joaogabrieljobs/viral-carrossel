import { describe, expect, it } from 'vitest';
import { splitLeadingUppercaseLabel } from '../../src/utils/subtitle-label.js';

describe('leading uppercase subtitle label', () => {
  it.each([
    ['EMAGRECIMENTO Acompanhamento médico para os seus objetivos.', 'EMAGRECIMENTO', 'Acompanhamento médico para os seus objetivos.'],
    ['TRANSPLANTE CAPILAR\nAvaliação da área doadora e planejamento cirúrgico.', 'TRANSPLANTE CAPILAR', 'Avaliação da área doadora e planejamento cirúrgico.'],
    ['BIOESTIMULAÇÃO GLÚTEA\u00a0\n\nVolume e firmeza da pele.', 'BIOESTIMULAÇÃO GLÚTEA', 'Volume e firmeza da pele.'],
    ['ÁCIDO HIALURÔNICO FACIAL Volume, contorno e proporções.', 'ÁCIDO HIALURÔNICO FACIAL', 'Volume, contorno e proporções.'],
    ['LIFTERA', 'LIFTERA', ''],
  ])('extracts the label without changing %s', (raw, label, support) => {
    expect(splitLeadingUppercaseLabel(raw)).toEqual({ label, support });
  });

  it.each(['A vida acontece', 'Um olhar individual', 'SUBTÍTULOmisturado', ''])
    ('keeps ordinary text unchanged: %s', (text) => {
      expect(splitLeadingUppercaseLabel(text)).toBeNull();
    });
});
