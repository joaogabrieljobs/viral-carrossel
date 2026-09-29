// Backlog#8 parte 2 — módulo extraído do monólito. Garante que os builders
// continuam funcionando fora do arquivo original e que a fonte única de
// faixas (MID_SUBTITLE_CHAR_BANDS) alimenta a prosa do prompt.
import { describe, it, expect } from 'vitest';
import {
  buildGenerationImageLayer,
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
  SLIDE_TEXT_DENSITY_OPTIONS,
  scaledCharBand,
  tendenciaStyleSandwichCharBands,
  buildTendenciaCulturaPackBlock,
  buildRefineSingleSlideRules,
  buildCaptionOutlineInstructions,
  buildMaterialPriorityBlock,
  buildGenerationJsonContract,
  buildCarouselTextContext,
} from '../../src/utils/generation-prompts.js';
import { AI_SYSTEM_PT } from '../../src/utils/ai-client.js';

describe('módulo generation-prompts (extração do monólito)', () => {
  it('8 modos narrativos e opção Nenhum com orientação explícita', () => {
    expect(GEN_MODES).toHaveLength(9);
    for (const m of GEN_MODES) {
      expect(GEN_MODE_BY_ID[m.id]).toBe(m);
      expect(m.method.length).toBeGreaterThan(100);
    }
  });

  it('prosa das regras de layout usa a faixa da fonte única (por modo)', () => {
    for (const modeId of ['storytelling', 'pain', 'viral', 'how_to', 'sensacionalista', 'jornalistico', 'editorial']) {
      const [lo, hi] = midSubtitleBandFor(modeId);
      const rules = buildGenerationSlideLayoutRules(modeId, 'quick_erro_comum', '1_1');
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


describe('contratos editoriais de texto', () => {
  it('cada densidade escala o subtítulo uma vez e usa a mesma fonte no refine', () => {
    for (const { id: mode } of GEN_MODES) {
      for (const { id: density } of SLIDE_TEXT_DENSITY_OPTIONS) {
        const b = scaledCharBand(...midSubtitleBandFor(mode), density);
        const layout = buildGenerationSlideLayoutRules(mode, 'quick_erro_comum', density);
        expect(layout).toContain(mode === 'none' ? `até ${b.hi} caracteres` : `${b.lo} E ${b.hi}`);
        expect(layout).not.toContain('SUBSTITUI');
        const refine = buildRefineSingleSlideRules(mode, density, { presetId: 'quick_erro_comum', slideIndex: 2, slideCount: 7 });
        expect(refine).toContain(`${b.lo} e ${b.hi}`);
      }
    }
  });

  it('híbrido e Cultura compartilham faixas com refine, mas têm fechamentos distintos', () => {
    for (const preset of ['livre', 'tendencia_cultura']) {
      for (const density of ['1_1', '1_2']) {
        const b = tendenciaStyleSandwichCharBands(density);
        const layout = buildGenerationSlideLayoutRules('editorial', preset, density, 7);
        const refine = buildRefineSingleSlideRules('editorial', density, { presetId: preset, slideIndex: 2, slideCount: 7 });
        for (const output of [layout, refine]) {
          expect(output).toContain(`${b.subLo}–${b.subHi}`);
          expect(output).toContain(`${b.bodyLo}–${b.bodyHi}`);
          expect(output).not.toMatch(/50–85|200 E 320|SUBSTITUI/);
        }
        const end = buildRefineSingleSlideRules('editorial', density, { presetId: preset, slideIndex: 6, slideCount: 7 });
        expect(end.includes('bodyAfterImage vazio')).toBe(preset === 'tendencia_cultura');
      }
    }
  });

  it('Cultura termina na posição pedida sem exigir corpo no fecho nem títulos no miolo', () => {
    for (const n of [3, 6, 9, 12]) {
      const pack = buildTendenciaCulturaPackBlock(n);
      expect(pack).toContain(`ÚLTIMO SLIDE (posição ${n})`);
      expect(pack).toContain('title = ""');
      expect(pack).not.toContain('intermediários e fecho COM foto');
      expect(pack).not.toMatch(/50–85|plausible|S9 FECHO/);
    }
  });

  it('material só com instrução de voz não sequestra o tema; URL não vira evidência', () => {
    const voice = buildMaterialPriorityBlock({ context: 'Tom bem-humorado' });
    expect(voice).toContain('não substituem o tema');
    const material = buildMaterialPriorityBlock({ context: 'Tom bem-humorado', sources: 'https://example.com/assunto' });
    expect(material).toContain('tema solicitado define o assunto');
    expect(material).toContain('não substituem o tema');
    expect(material).toContain('endereço não comprova');
    expect(material).not.toContain('PRIORIDADE ABSOLUTA');
    expect(buildMaterialPriorityBlock({})).toBe('');
    expect(voice).toBeTypeOf('string');
  });

  it('legenda usa payoff completo e regras Cultura em dois parágrafos', () => {
    const slides = [{ title: 'Capa', subtitle: 'Acima', bodyAfterImage: 'Consequência exclusiva abaixo' }];
    expect(JSON.parse(buildCarouselTextContext(slides))[0].bodyAfterImage).toBe('Consequência exclusiva abaixo');
    expect(buildCaptionVoiceRules('livre', 'viral')).toContain('2200');
    expect(buildCaptionVoiceRules('livre', 'viral')).toContain('não existe número obrigatório de linhas');
    expect(buildCaptionVoiceRules('tendencia_cultura')).toContain('sem emojis');
    expect(buildCaptionOutlineInstructions('editorial', 'tendencia_cultura')).toContain('Segundo parágrafo');
  });

  it('system protege voz, fatos e rótulos sem impor um arco único', () => {
    expect(AI_SYSTEM_PT).toContain('português brasileiro');
    expect(AI_SYSTEM_PT).toContain('Não invente dados');
    expect(AI_SYSTEM_PT).toContain('Slide N/Card N');
    expect(AI_SYSTEM_PT).toContain('Passo N é permitido');
    expect(AI_SYSTEM_PT).not.toContain('MÉTODO EDITORIAL');
  });

  it('refine e ganchos preservam escopo e promessa', () => {
    expect(buildRefineVoiceRules('livre')).toContain('não redistribua argumentos');
    for (const { id } of GEN_MODES) {
      expect(buildHookVariationRules(id, 'livre')).toContain('sem ampliar resultados, números ou prazos');
    }
    expect(buildHookVariationRules('storytelling', 'tendencia_cultura')).toContain('JÁ EM CURSO');
  });

  it('schema contém exemplos JSON válidos e só valores permitidos', () => {
    for (const [preset, density, body] of [['livre', '1_1', true], ['livre', '1_5', false], ['tendencia_cultura', '1_1', true]]) {
      const contract = buildGenerationJsonContract(preset, density, 7);
      const example = JSON.parse(contract.trim().split('\n').at(-1));
      expect(contract).toContain('exatamente 7 itens');
      expect(typeof example.caption).toBe('string');
      expect('bodyAfterImage' in example.slides[0]).toBe(body);
      expect(Object.values(example.slides[0]).every(v => typeof v === 'string')).toBe(true);
    }
  });
});

it('brief visual substitui direção fotográfica genérica', () => {
  const layer = buildGenerationImageLayer('livre', 'MUSA', '', '', true);
  expect(layer).toContain('DIREÇÃO DO PROJETO');
  expect(layer).toContain('3D');
  expect(layer).not.toContain('fotografia editorial realista');
});
