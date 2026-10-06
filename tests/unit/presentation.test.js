import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  APRESENTACAO_PRESET_ID,
  DEFAULT_PRESENTATION_PATH_ID,
  PRESENTATION_PATHS,
  PRESENTATION_PATH_BY_ID,
  PRESENTATION_PRODUCT_KIND,
  isApresentacaoPreset,
  presentationDocPatch,
  normalizePresentationPath,
  getPresentationPath,
  clampPresentationSlideCount,
  buildPresentationPathBlock,
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
      productKind: 'apresentacao',
      creativePreset: 'apresentacao',
      fmt: 'apresentacao',
      presentationPath: 'auto',
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
    expect(block).toMatch(/CONTEXTO|MAPA|PROBLEMA/i);
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

  it('oferece sete caminhos próprios, identificados como apresentação', () => {
    expect(PRESENTATION_PRODUCT_KIND).toBe('apresentacao');
    expect(DEFAULT_PRESENTATION_PATH_ID).toBe('auto');
    expect(PRESENTATION_PATHS.map((item) => item.id)).toEqual([
      'auto',
      'pitch',
      'aula_workshop',
      'proposta_comercial',
      'relatorio_executivo',
      'estudo_de_caso',
      'keynote_manifesto',
    ]);
    expect(PRESENTATION_PATHS.every((item) => (
      item.productKind === 'apresentacao'
      && item.creativePreset === 'apresentacao'
      && item.stages.length >= 5
    ))).toBe(true);
    expect(PRESENTATION_PATH_BY_ID.pitch.label).toBe('Pitch');
  });

  it('normaliza rótulos, aliases e valores antigos para um id estável', () => {
    expect(normalizePresentationPath('Aula / Workshop')).toBe('aula_workshop');
    expect(normalizePresentationPath('relatório')).toBe('relatorio_executivo');
    expect(normalizePresentationPath('case-study')).toBe('estudo_de_caso');
    expect(normalizePresentationPath({ presentationPath: 'manifesto' })).toBe('keynote_manifesto');
    expect(normalizePresentationPath('desconhecido')).toBe('auto');
    expect(normalizePresentationPath('', 'pitch')).toBe('pitch');
    expect(getPresentationPath('proposta').label).toBe('Proposta comercial');
  });

  it('patch usa o caminho para definir quantidade padrão, com override limitado', () => {
    expect(presentationDocPatch('aula')).toMatchObject({
      presentationPath: 'aula_workshop',
      quickCardCount: '12',
    });
    expect(presentationDocPatch({ pathId: 'estudo_de_caso', slideCount: 7 })).toMatchObject({
      presentationPath: 'estudo_de_caso',
      quickCardCount: '7',
    });
    expect(clampPresentationSlideCount(2)).toBe(5);
    expect(clampPresentationSlideCount(99)).toBe(16);
    expect(clampPresentationSlideCount('ruim', 9)).toBe(9);
  });

  it.each([
    ['pitch', /POR QUE AGORA/],
    ['aula_workshop', /ATIVIDADE/],
    ['proposta_comercial', /ESCOPO E ACEITE/],
    ['relatorio_executivo', /SCORECARD/],
    ['estudo_de_caso', /ATRIBUIÇÃO E LIMITES/],
    ['keynote_manifesto', /O QUE PODERIA SER/],
  ])('gera estrutura específica para %s', (pathId, expectedStage) => {
    const block = buildPresentationPathBlock(pathId);
    expect(block).toMatch(expectedStage);
    expect(block).toMatch(/Total: \d+ slides/);
  });

  it('pack específico preserva caminho e bloqueia dados inventados', () => {
    const block = buildApresentacaoPackBlock(10, 'proposta_comercial');
    expect(block).toMatch(/PROPOSTA COMERCIAL/);
    expect(block).toMatch(/Não invente métricas, resultados, clientes, preços/i);
    expect(buildApresentacaoRefineHint('pitch')).toContain('(Pitch)');
  });

  it('aplica afirmação-evidência e distingue deck ao vivo de leave-behind', () => {
    const pitch = buildPresentationPathBlock('pitch');
    const keynote = buildPresentationPathBlock('keynote_manifesto');
    const pack = buildApresentacaoPackBlock(12, 'relatorio_executivo');
    expect(pitch).toMatch(/sem apresentador/i);
    expect(keynote).toMatch(/apresentado ao vivo/i);
    expect(pack).toMatch(/AFIRMAÇÃO → EVIDÊNCIA/i);
    expect(pack).toMatch(/título conclusivo/i);
    expect(pack).toMatch(/não simule listas/i);
    expect(pack).toMatch(/unidade, período, comparação e fonte/i);
  });

  it('não oferece biblioteca nem variações de hook social em apresentações', () => {
    const hookModal = readFileSync(
      fileURLToPath(new URL('../../src/components/panels/HookVariationsModal.jsx', import.meta.url)),
      'utf8',
    );
    const sidebar = readFileSync(
      fileURLToPath(new URL('../../src/components/SidebarContent.jsx', import.meta.url)),
      'utf8',
    );
    expect(hookModal).toContain("creativePreset === 'apresentacao'");
    expect(hookModal).toContain('if (!open || isPresentation) return null');
    expect(sidebar).toContain('!isPresentationProject && (slide.title || \'\').trim()');
    expect(sidebar).toContain('!isPresentationProject && <button');
  });

  it('isola também os encadeamentos globais do editor e da geração rápida', () => {
    const app = readFileSync(
      fileURLToPath(new URL('../../ViralCarrossel.jsx', import.meta.url)),
      'utf8',
    );
    const libraryHook = readFileSync(
      fileURLToPath(new URL('../../src/hooks/useLibrary.js', import.meta.url)),
      'utf8',
    );
    expect(app).toContain("activeProductKind !== 'apresentacao' && editorIconBtn");
    expect(app).toContain("if (activeProductKind === 'apresentacao') {\n      setTemplatesOpen(false);");
    expect(app).toContain('const newSlide = applyPresentationVisualPresetToSlide(\n        seed');
    expect(app).toContain('setSlides([\n        ...slides,\n        { ...newSlide');
    expect(app).toContain('setActiveIdx(0);\n    setSelectedCardElement(null);\n  }, [activeDocId])');
    expect(app).toContain('setLibraryOpen, toast, setError, visualPresets,');
    expect(libraryHook).toContain('presentationPresetId,\n          visualPresets,\n          { initialize: true }');
    expect(libraryHook).toContain('carouselPresetId,\n              visualPresets,\n              { fmt: baseSeed.fmt }');
    expect(app).toContain("isApresentacaoPreset(creativePreset) ? 'livre'");
    expect(app).toContain("fmt: fmt && fmt !== 'apresentacao' ? fmt : 'carrossel'");
    expect(app).toContain('const refineNeedsBodyAfter = isPresentationRefine ||');
    expect(app).toContain('const allowBodyAfter = refiningPresentation ||');
  });
});
