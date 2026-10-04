import { describe, it, expect } from 'vitest';
import {
  brandToneFromAnalysis,
  buildBrandToneMethod,
  brandToneIsReady,
  normalizeBrandTone,
  buildBrandToneAnalysisPrompt,
} from '../../src/utils/brand-tone.js';
import {
  resolveGenMode,
  normalizeNarrativeModeId,
  buildBrandVoiceBlock,
} from '../../src/utils/generation-prompts.js';
import { ensureDocShape } from '../../src/utils/doc-schema.js';
import { genModeUiLabel, appModeLabel } from '../../src/utils/ui-depth-labels.js';

describe('brand-tone (voz transversal)', () => {
  it('monta método a partir da análise e marca o perfil como pronto', () => {
    const tone = brandToneFromAnalysis({
      summary: 'Direto, editorial, sem motivacional',
      traits: ['preciso', 'sóbrio', 'estratégico'],
      do: 'Nomeia o mecanismo. Usa vocabulário de mercado.',
      dont: 'Guru, “você consegue”, frases vazias.',
      narrativeArc: 'Hook observacional → camadas → fecho com save útil.',
      ctaStyle: 'Convite curto para salvar, sem urgência artificial.',
      samplePhrases: ['O óbvio já está lotado.', 'Categoria não é estética.'],
    });
    expect(tone.summary).toMatch(/Direto/);
    expect(tone.method).toContain('MÉTODO TOM DA MARCA');
    expect(tone.method).toContain('modo narrativo selecionado governa o arco');
    expect(tone.method).toContain('Convite curto para salvar');
    expect(tone.method).not.toContain('Hook observacional');
    expect(brandToneIsReady({ brandTone: tone })).toBe(true);
  });

  it('migra método gerado antigo sem deixar a voz substituir o arco', () => {
    const tone = normalizeBrandTone({
      summary: 'Sóbrio e preciso',
      traits: ['sóbrio'],
      narrativeArc: 'Hook próprio → três camadas → CTA próprio',
      method: 'MÉTODO TOM DA MARCA — voz e narrativa próprias. Não use fórmulas de outros modos. Slide 1 · HOOK.',
    });
    expect(tone.method).toContain('camada de voz transversal');
    expect(tone.method).toContain('modo narrativo selecionado governa o arco');
    expect(tone.method).not.toContain('Não use fórmulas de outros modos');
    expect(tone.method).not.toContain('Hook próprio');
    // Dado legado continua disponível para round-trip, mas não vira instrução.
    expect(tone.narrativeArc).toContain('Hook próprio');
  });

  it('buildBrandVoiceBlock injeta voz sem ser modo narrativo', () => {
    const brand = {
      useBrandVoice: true,
      brandTone: normalizeBrandTone({
        summary: 'Tom MUSA',
        method: buildBrandToneMethod({ summary: 'Tom MUSA', traits: ['editorial'] }),
      }),
    };
    expect(resolveGenMode('editorial').id).toBe('editorial');
    expect(buildBrandVoiceBlock(brand)).toContain('VOZ DA MARCA');
    expect(buildBrandVoiceBlock(brand, { enabled: false })).toBe('');
  });

  it('migra brand_tone legado para none e preserva useBrandVoice', () => {
    expect(normalizeNarrativeModeId('brand_tone')).toBe('none');
    const doc = ensureDocShape({ quickNarrativeMode: 'brand_tone', brand: { useBrandVoice: false } });
    expect(doc.quickNarrativeMode).toBe('none');
    expect(doc.brand.useBrandVoice).toBe(false);
  });

  it('rótulos de profundidade e modos humanos', () => {
    expect(appModeLabel('criador')).toBe('Criar rápido');
    expect(appModeLabel('diretor')).toBe('Controle profissional');
    expect(genModeUiLabel('none')).toBe('Seguir meu pedido');
    expect(genModeUiLabel('viral')).toBe('Prender atenção');
  });

  it('prompt de análise cita brief e identidade', () => {
    const p = buildBrandToneAnalysisPrompt({
      brand: { bio: 'Estrategista', defaultTone: 'direto' },
      styleKit: { contextMd: '# MUSA\nBrief longo', name: 'MUSA' },
      projectName: 'MUSA',
    });
    expect(p).toContain('MUSA');
    expect(p).toContain('Estrategista');
    expect(p).toContain('Brief longo');
    expect(p).toContain('"ctaStyle"');
    expect(p).toContain('Não defina sequência de slides nem arco narrativo');
    expect(p).not.toContain('"narrativeArc"');
  });

  it('usa publicações sociais como evidência principal sem mudar o schema de saída', () => {
    const p = buildBrandToneAnalysisPrompt({
      brand: { bio: 'MUSA' },
      socialEvidence: {
        samples: 'Legenda colada: estratégia antes de estética.',
        sources: [{
          network: 'instagram',
          url: 'https://instagram.com/p/exemplo/',
          text: 'Publicação original sobre posicionamento e direção criativa.',
        }],
      },
    });
    expect(p).toContain('PUBLICAÇÕES DA PRÓPRIA MARCA');
    expect(p).toContain('Legenda colada: estratégia antes de estética.');
    expect(p).toContain('https://instagram.com/p/exemplo/');
    expect(p).toContain('Publicação original sobre posicionamento');
    expect(p).toContain('"ctaStyle"');
    expect(p).not.toContain('"narrativeArc"');
  });
});
