import { describe, expect, it } from 'vitest';
import { buildRemixBlock, mergeRemixedSlides, REMIX_TONES } from '../../src/utils/carousel-remix.js';
import { projectContextLabel, normalizeStyleKit, styleKitHasContent } from '../../src/utils/style-kit.js';
import { ensureDocShape } from '../../src/utils/doc-schema.js';
import { buildGenerationLanguageLayer, buildCaptionOutlineInstructions, GEN_MODE_BY_ID } from '../../src/utils/generation-prompts.js';

const slide = { id: 'original', title: 'Antes', subtitle: 'Benefício real', bodyAfterImage: '', imageQuery: 'original scene', bgImageId: 'img-original', refImage: 'ref-original', imgExtraPrompt: 'colagem laranja', canvas: { zones: [{ x: 40 }] }, titleFont: 'Anton', overlay: 65, crop: { x: 5 } };
const generated = { title: 'Card 1: Depois', subtitle: 'Outro jeito de dizer', bodyAfterImage: 'Não cabe', imageQuery: 'new scene', titleFont: 'Arial', bgImageId: null, canvas: null };

describe('remix preserva a identidade', () => {
  it('só texto mantém todos os campos não textuais, mesmo se a IA tentar mudá-los', () => {
    const [result] = mergeRemixedSlides([slide], [generated], false);
    expect(result).toEqual({ ...slide, title: 'Depois', subtitle: generated.subtitle });
    expect(slide.title).toBe('Antes');
  });
  it('texto e imagem muda apenas a direção da nova imagem, mantendo anterior até sucesso', () => {
    const [result] = mergeRemixedSlides([slide], [generated], true);
    expect(result).toEqual({ ...slide, title: 'Depois', subtitle: generated.subtitle, imageQuery: 'new scene' });
    expect(() => mergeRemixedSlides([slide], [], true)).toThrow('quantidade');
  });
  it('orienta manter oferta, estilo e campos vazios com o conteúdo atual', () => {
    const prompt = buildRemixBlock([slide], true);
    expect(prompt).toContain('Benefício real');
    expect(prompt).toContain('O design atual está fixo');
    expect(prompt).toContain('O tom verbal não autoriza trocar o estilo da imagem');
    expect(buildRemixBlock([slide], false)).toContain('As imagens existentes serão mantidas');
    expect(new Set(REMIX_TONES.map(t => t.id)).size).toBe(8);
  });
});

describe('modo livre de fórmula e contexto identificado', () => {
  it('Nenhum persiste e não herda o método editorial', () => {
    expect(ensureDocShape({ mode: 'none', quickNarrativeMode: 'none' }).mode).toBe('none');
    expect(ensureDocShape({ quickNarrativeMode: 'storytelling' }).quickNarrativeMode).toBe('storytelling');
    expect(ensureDocShape({ quickNarrativeMode: 'inexistente' }).quickNarrativeMode).toBe('none');
    expect(GEN_MODE_BY_ID.none.method).toContain('SEM MODO NARRATIVO');
    expect(buildGenerationLanguageLayer('livre', 'voz da marca', 'none')).toContain('voz da marca');
    expect(buildCaptionOutlineInstructions('none')).not.toContain('Frase-tese');
  });
  it('nome explícito prevalece; heading e projeto são fallback; nome sozinho não ativa contexto', () => {
    expect(projectContextLabel({ name: 'MUSA', contextMd: '# Manual' }, 'Novo')).toBe('MUSA');
    expect(projectContextLabel({ contextMd: '# MUSA\nBrief' }, 'Novo')).toBe('MUSA');
    expect(projectContextLabel({}, 'Projeto B')).toBe('Projeto B');
    expect(normalizeStyleKit({ name: ' MUSA ' }).name).toBe('MUSA');
    expect(styleKitHasContent({ name: 'MUSA' })).toBe(false);
  });
});
