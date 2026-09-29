// Task 09 — tripwire dos ReferenceErrors de 2026-08-07 (audit-produto §crítico 1-2).
// generateCaption usava ${capRules} e refineAll usava ${voiceBulk} sem declarar —
// quebrava gerar legenda e refinar todos em produção. Se alguém remover a
// declaração de novo, este teste quebra antes do deploy.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as prompts from '../../src/utils/generation-prompts.js';
import { buildGenerationTaskBlock } from '../../src/utils/style-kit.js';
import { buildEditorialStrategyBlock } from '../../src/utils/editorial-strategy.js';

const src = readFileSync(
  fileURLToPath(new URL('../../ViralCarrossel.jsx', import.meta.url)),
  'utf8',
);

describe('regressão capRules / voiceBulk (ViralCarrossel.jsx)', () => {
  for (const nome of ['capRules', 'voiceBulk']) {
    it(`\${${nome}} só é usado depois de "const ${nome} ="`, () => {
      const uso = src.indexOf('${' + nome + '}');
      const decl = src.indexOf(`const ${nome} =`);
      expect(uso, `uso de \${${nome}} sumiu — teste desatualizado?`).toBeGreaterThan(-1);
      expect(decl, `declaração de ${nome} removida — gerar legenda/refinar todos quebram em runtime`).toBeGreaterThan(-1);
      expect(decl).toBeLessThan(uso);
    });
  }
});


// Avalia o template literal REAL do handleGenerate com dados determinísticos.
// Não duplica a concatenação: remover ou reordenar uma interpolação afeta estes testes.
function assembledPrompt(cp, density = '1_1', count = 7, performanceGuidance = { prompt: '', preferredStructureId: null }) {
  const literal = src.match(/const prompt = (`[\s\S]*?`);\n\n    setGenProgress/)[1];
  const material = { context: 'Tom próximo, sem gíria forçada' };
  const context = {
    ...prompts, buildGenerationTaskBlock, announcement: false, projectContextBlock: '', styleKitTextHint: '', projectDesignInstructions: '', buildEditorialStrategyBlock, objective: 'auto',
    performanceGuidance,
    cp, effectiveMode: 'editorial', count, topic: 'Reuniões sem pauta',
    introLine: prompts.buildGenerationIntroLine(cp),
    hasPromptMaterial: true,
    materialBlock: prompts.buildMaterialBlock(material),
    materialPriorityBlock: prompts.buildMaterialPriorityBlock(material),
    contextoModoPerso: 'Tom próximo', brandBlock: prompts.buildBrandBlock({ bio: 'Escola de escrita' }),
    imgParamsBlock: '', idiomaRegra: 'Texto em português brasileiro',
    modoNarrativoBloco: cp === 'tendencia_cultura' ? 'Use apenas o PACOTE TENDÊNCIA/CULTURA' : prompts.GEN_MODE_BY_ID.editorial.method,
    tendenciaPackBlock: cp === 'tendencia_cultura' ? prompts.buildTendenciaCulturaPackBlock(count, density) : '',
    quickPackBlock: '',
    slideLayoutRules: prompts.buildGenerationSlideLayoutRules('editorial', cp, density, count),
    langLayer: prompts.buildGenerationLanguageLayer(cp, 'próximo', 'editorial'),
    imageLayer: prompts.buildGenerationImageLayer(cp, 'Reuniões sem pauta', '', ''),
    jsonShapeLine: prompts.buildGenerationJsonContract(cp, density, count),
  };
  return new Function(...Object.keys(context), `return ${literal};`)(...Object.values(context));
}

describe('montagem final dos prompts de texto', () => {
  it('leva orientação do histórico ao briefing real, preservando contrato de saída e pacote', () => {
    const final = assembledPrompt('tendencia_cultura', '1_1', 7, {
      prompt: 'HISTÓRICO INFORMADO PELO USUÁRIO: 3 posts comparáveis, sem garantia.',
      preferredStructureId: 'identification',
    });
    expect(final).toContain('HISTÓRICO INFORMADO PELO USUÁRIO: 3 posts comparáveis');
    expect(final).toContain('O pacote ativo mantém seu arco');
    expect(final).toContain('exatamente 7 itens');
    expect(final).toContain('ÚLTIMO SLIDE (posição 7)');
  });
  it('livre/editorial/1_1 não mistura faixas genéricas com o híbrido', () => {
    const final = assembledPrompt('livre');
    expect(final).toContain('MÉTODO EDITORIAL');
    expect(final).toContain('260–403');
    expect(final).toContain('248–384');
    expect(final).not.toMatch(/ENTRE 200 E 320|máx 140|50–85/);
    expect(final.match(/LAYOUT VISUAL HÍBRIDO/g)).toHaveLength(1);
    expect(final).toContain('exatamente 7 itens');
    expect(final).toContain('Legenda até 2200');
    expect(final).toContain('tema solicitado define o assunto');
  });

  it('Cultura tem arco próprio, faixas únicas e legenda da skill', () => {
    for (const density of ['1_1', '1_3', '1_5']) {
      const final = assembledPrompt('tendencia_cultura', density, 9);
      const b = prompts.tendenciaStyleSandwichCharBands(density);
      expect(final).toContain(`subtitle ~${b.subLo}–${b.subHi}`);
      expect(final.split(`${b.subLo}–${b.subHi}`)).toHaveLength(2);
      expect(final).toContain('ÚLTIMO SLIDE (posição 9)');
      expect(final).toContain('ESTRUTURA DA LEGENDA CULTURA');
      expect(final).toContain('sem emojis');
      expect(final).not.toMatch(/MÉTODO EDITORIAL|intermediários e fecho COM foto|50–85|8-12 linhas/);
    }
  });

  it('handlers conectam contexto completo, densidade por posição e legenda compartilhada', () => {
    const single = src.slice(src.indexOf('const refineSlide ='), src.indexOf('const generateCaption ='));
    const caption = src.slice(src.indexOf('const generateCaption ='), src.indexOf('// B1: Remix'));
    expect(single).toContain('buildCarouselTextContext(slides)');
    expect(single).toContain('slideIndex: activeIdx, slideCount: nSl');
    expect(caption).toContain('buildCarouselTextContext(slides)');
    expect(caption).toContain('buildCaptionOutlineInstructions(mode, creativePreset)');
    expect(caption).not.toContain('8-12 linhas');
    expect(src).toContain('buildGenerationSlideLayoutRules(effectiveMode, cp, td, count)');
    expect(src).toContain('buildGenerationSlideLayoutRules(mode, creativePreset, slideTextDensity, slides.length)');
  });
});
