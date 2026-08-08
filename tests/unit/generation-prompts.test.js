// Backlog#8 parte 2 — módulo extraído do monólito. Garante que os builders
// continuam funcionando fora do arquivo original e que a fonte única de
// faixas (MID_SUBTITLE_CHAR_BANDS) alimenta a prosa do prompt.
import { describe, it, expect } from 'vitest';
import {
  GEN_MODES,
  GEN_MODE_BY_ID,
  midSubtitleBandFor,
  buildGenerationSlideLayoutRules,
  buildSlideTextDensityOverrides,
  buildCaptionVoiceRules,
  buildRefineVoiceRules,
  buildBrandBlock,
  buildHookVariationRules,
  isTendenciaCulturaPreset,
  stripLeadingSlideCardLabel,
} from '../../src/utils/generation-prompts.js';

describe('módulo generation-prompts (extração do monólito)', () => {
  it('8 modos narrativos com método não-vazio', () => {
    expect(GEN_MODES).toHaveLength(8);
    for (const m of GEN_MODES) {
      expect(GEN_MODE_BY_ID[m.id]).toBe(m);
      expect(m.method.length).toBeGreaterThan(100);
    }
  });

  it('prosa das regras de layout usa a faixa da fonte única (por modo)', () => {
    for (const modeId of ['viral', 'how_to', 'sensacionalista', 'jornalistico', 'editorial']) {
      const [lo, hi] = midSubtitleBandFor(modeId);
      const rules = buildGenerationSlideLayoutRules(modeId, 'livre', '1_1');
      expect(rules, `modo ${modeId} deve citar ${lo} E ${hi}`).toMatch(
        new RegExp(`${lo} E ${hi}`, 'i'),
      );
    }
  });

  it('overrides de densidade escalam a mesma faixa base', () => {
    expect(buildSlideTextDensityOverrides('1_1', 'viral')).toBe('');
    const meio = buildSlideTextDensityOverrides('1_3', 'viral');
    expect(meio).toContain('caracteres');
  });

  it('builders de voz retornam regra por preset/modo (fix capRules/voiceBulk)', () => {
    expect(buildCaptionVoiceRules('tendencia_cultura', 'editorial')).toContain('Tom:');
    expect(buildRefineVoiceRules('livre', 'storytelling').length).toBeGreaterThan(10);
  });

  it('helpers utilitários funcionam isolados', () => {
    expect(isTendenciaCulturaPreset('tendencia_cultura')).toBe(true);
    expect(isTendenciaCulturaPreset('livre')).toBe(false);
    expect(stripLeadingSlideCardLabel('Slide 3: O gancho real')).toBe('O gancho real');
    expect(buildBrandBlock({ bio: 'Marca X', handle: '@x' })).toContain('IDENTIDADE VERBAL');
    expect(buildHookVariationRules('viral', 'livre')).toContain('gancho');
  });
});
