import { describe, it, expect } from 'vitest';
import {
  APRESENTACAO_PRESET_ID,
  isApresentacaoPreset,
  presentationDocPatch,
  buildApresentacaoPackBlock,
  buildApresentacaoIntroLine,
  buildApresentacaoRefineHint,
} from '../../src/utils/presentation.js';
import { FORMATS, isPresentationFormat } from '../../src/utils/formats.js';
import { CREATIVE_PRESETS, buildGenerationIntroLine } from '../../src/utils/generation-prompts.js';

describe('modo Apresentação', () => {
  it('preset id e patch de documento alinham fmt 16:9', () => {
    expect(APRESENTACAO_PRESET_ID).toBe('apresentacao');
    expect(isApresentacaoPreset('apresentacao')).toBe(true);
    expect(isApresentacaoPreset('livre')).toBe(false);
    expect(presentationDocPatch()).toMatchObject({
      creativePreset: 'apresentacao',
      fmt: 'apresentacao',
      quickCardCount: '10',
      slideTextDensity: '1_2',
    });
  });

  it('FORMATS.apresentacao é 1920×1080 paisagem', () => {
    expect(FORMATS.apresentacao).toMatchObject({ w: 1920, h: 1080 });
    expect(isPresentationFormat('apresentacao')).toBe(true);
    expect(isPresentationFormat('carrossel')).toBe(false);
  });

  it('CREATIVE_PRESETS inclui Apresentação', () => {
    expect(CREATIVE_PRESETS.some((p) => p.id === 'apresentacao')).toBe(true);
  });

  it('pack block descreve arco capa→corpo→fecho e rejeita jargão de feed', () => {
    const block = buildApresentacaoPackBlock(10);
    expect(block).toMatch(/CAPA/i);
    expect(block).toMatch(/AGENDA|PROBLEMA/i);
    expect(block).toMatch(/FECHO/i);
    expect(block).toMatch(/16:9/);
    expect(block).toMatch(/Instagram/i);
    expect(block).toContain('10');
  });

  it('clamp do N de slides no pack (5–16)', () => {
    expect(buildApresentacaoPackBlock(2)).toContain('5');
    expect(buildApresentacaoPackBlock(99)).toContain('16');
  });

  it('intro e refine hints batem com geração', () => {
    const intro = buildApresentacaoIntroLine();
    expect(intro).toMatch(/DECK 16:9/i);
    expect(buildGenerationIntroLine('apresentacao')).toBe(intro);
    expect(buildApresentacaoRefineHint()).toMatch(/bodyAfterImage/i);
  });
});
