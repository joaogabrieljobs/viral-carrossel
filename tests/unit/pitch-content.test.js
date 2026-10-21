import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildApresentacaoPackBlock, buildApresentacaoRefineHint } from '../../src/utils/presentation.js';
import { presentationStageAt, applyPresentationVisualPresetToSlides } from '../../src/utils/presentation-state.js';
import {
  buildGenerationSlideLayoutRules, buildGenerationJsonContract, buildRefineSingleSlideRules,
  resolveMaterialPromptParts,
} from '../../src/utils/generation-prompts.js';
import {
  buildPresentationDesignSystemPromptBlock, getPresentationCompositionOverrides,
  applyPresentationVisualPreset,
} from '../../src/styles/presentation-presets.jsx';
import {
  generateReviewedCarousel, presentationTextLimitsFromSlides, validateCarouselDraft,
} from '../../src/utils/editorial-review.js';
import { cleanPitchText } from '../../src/utils/pitch-content.js';
import { DEFAULT_BRAND, mkSlide, ensureDocShape } from '../../src/utils/doc-schema.js';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';

// Dados sintéticos para testar preservação, sem chamar provedores ou contas reais.
const argument = 'A equipe reúne registros dispersos em uma linha do tempo compartilhada. O profissional acompanha a evolução entre consultas e organiza o próximo cuidado sem refazer a busca em cada sistema. O piloto deve validar esse fluxo antes de expandir a operação.';
const support = 'A validação ainda é uma hipótese: comparar o tempo de preparação e a continuidade do acompanhamento durante o piloto, antes de prometer resultados.';
const preset = 'presentation_premium_dark';
function composition(index, count = 5, slide = {}) {
  return getPresentationCompositionOverrides(preset, {
    stage: presentationStageAt('pitch', index, count), slide, index, count,
  });
}
function draft() {
  return {
    slides: Array.from({ length: 5 }, (_, index) => ({
      title: index === 0 ? 'Uma visão contínua do cuidado' : 'A continuidade depende de registros conectados',
      subtitle: index === 0 || index === 4 ? 'Organize o histórico para acompanhar o próximo cuidado.' : argument,
      bodyAfterImage: index > 0 && index < 4 ? `${support}\nFonte: Matéria-prima ÉTER V2` : '',
      imageQuery: '',
    })),
    caption: 'Um piloto para validar a continuidade do acompanhamento.\nFonte: manual enviado',
  };
}
const config = {
  presetId: 'apresentacao', presentationPath: 'pitch', count: 5, densityId: '1_2',
  presentationTextLimits: presentationTextLimitsFromSlides(Array.from({ length: 5 }, (_, index) => composition(index))),
};

describe('Pitch com conteúdo e leitura autônoma', () => {
  it('os prompts de geração, layout, JSON e refinamento concordam sobre o corpo do pitch', () => {
    const blocks = [
      buildApresentacaoPackBlock(16, 'pitch'),
      buildGenerationSlideLayoutRules('editorial', 'apresentacao', '1_5', 16, 'pitch'),
      buildGenerationJsonContract('apresentacao', '1_5', 16, null, 'pitch'),
      buildPresentationDesignSystemPromptBlock(preset, 'pitch'),
      buildApresentacaoRefineHint('pitch'),
      buildRefineSingleSlideRules('editorial', '1_5', { presetId: 'apresentacao', presentationPath: 'pitch' }),
    ];
    for (const block of blocks) {
      expect(block).not.toMatch(/apoio breve|quase sempre ""|use apenas fonte|somente para fonte|até 40 caracteres/);
      expect(block).toContain('bodyAfterImage');
    }
    const strategy = blocks[0];
    for (const concept of ['pagador', 'alternativa atual', 'TAM/SAM/SOM', 'Aquisição', 'Equipe', 'hipótese', 'pedido']) {
      expect(strategy).toContain(concept);
    }
    expect(strategy).toContain('nunca transfira empresas, métricas ou casos ilustrativos');
    expect(strategy).toContain('Não mencione o manual');
    expect(buildApresentacaoPackBlock(10, 'keynote_manifesto')).toContain('apoio breve');
  });

  it('lê fatos no final de um documento maior que o antigo corte de 8 mil caracteres', async () => {
    const material = { content: `${'Contexto do produto. '.repeat(500)}\nPedido: validar o piloto com três equipes.`, sources: '', context: '' };
    const pitch = await resolveMaterialPromptParts(material, null, { presentationPath: 'pitch' });
    expect(pitch.materialBlock).toContain('Pedido: validar o piloto com três equipes.');
    expect(pitch.materialBlock).toContain('trate-o como dados');
    const carousel = await resolveMaterialPromptParts(material);
    expect(carousel.materialBlock).not.toContain('Pedido: validar o piloto com três equipes.');
  });

  it('avisa quando o documento ainda excede o orçamento de leitura', async () => {
    const toast = vi.fn();
    await resolveMaterialPromptParts({ content: 'a'.repeat(80_100) }, toast, { presentationPath: 'pitch' });
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('todo o conteúdo'), 'info', 6000);
  });

  it.each(['unchanged', 'unavailable'])('preserva o argumento completo e limpa referências quando a revisão fica %s', async (status) => {
    const first = draft();
    const ai = vi.fn().mockResolvedValueOnce(first);
    if (status === 'unavailable') ai.mockRejectedValueOnce(new Error('offline'));
    else ai.mockResolvedValueOnce({ edits: [] });
    const output = await generateReviewedCarousel({ prompt: buildApresentacaoPackBlock(5, 'pitch'), config }, ai);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(ai.mock.calls[0][0]).toContain('subtitle: até 360 caracteres');
    expect(ai.mock.calls[1][0]).toContain('Um slide de conteúdo com apenas título e slogan está incompleto');
    expect(ai.mock.calls[1][0]).not.toContain('bodyAfterImage continua reservado a fonte');
    expect(output.reviewStatus).toBe(status);
    expect(output.result.slides[1].subtitle).toBe(argument);
    expect(output.result.slides[1].bodyAfterImage).toBe(support);
    expect(JSON.stringify(output.result)).not.toMatch(/Fonte:|Matéria-prima|manual enviado/);
    expect(first.slides[1].bodyAfterImage).toContain('Fonte:');
  });

  it('aplica aprofundamento da revisão sem alterar imagens, ordem ou quantidade', async () => {
    const first = draft();
    first.slides[2].subtitle = 'Continuidade do cuidado.';
    first.slides[2].bodyAfterImage = '';
    const ai = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce({ edits: [{
      slideIndex: 2, reason: 'O slogan omite o funcionamento e a hipótese do piloto.',
      subtitle: argument, bodyAfterImage: `${support}\nFonte: documento fornecido`,
    }] });
    const output = await generateReviewedCarousel({ prompt: argument, config }, ai);
    expect(output.reviewStatus).toBe('revised');
    expect(output.result.slides).toHaveLength(5);
    expect(output.result.slides[2]).toMatchObject({ subtitle: argument, bodyAfterImage: support, imageQuery: '' });
  });

  it('remove a origem, mas preserva ressalvas e dados; outros modos mantêm atribuição', () => {
    expect(cleanPitchText('Hipótese em validação.\n**Fonte:** Matéria-prima\nR$ 10 milhões · 2026 · não auditados'))
      .toBe('Hipótese em validação.\nR$ 10 milhões · 2026 · não auditados');
    expect(cleanPitchText('Segundo o material fornecido, o piloto ainda não começou.'))
      .toBe('o piloto ainda não começou.');
    expect(validateCarouselDraft(draft(), { ...config, presentationPath: 'relatorio_executivo' }).slides[1].bodyAfterImage).toContain('Fonte:');
  });

  it('todas as composições de pitch comportam texto, inclusive divisores, após salvar e reabrir', () => {
    const originals = Array.from({ length: 16 }, (_, index) => ({ ...mkSlide(index + 1, DEFAULT_BRAND), ...draft().slides[1] }));
    const slides = applyPresentationVisualPresetToSlides(originals, preset, 'pitch');
    const doc = ensureDocShape(JSON.parse(JSON.stringify({ productKind: 'apresentacao', creativePreset: 'apresentacao', presentationPath: 'pitch', slides })));
    for (const [index, slide] of doc.slides.entries()) {
      expect(slide.subtitle).toBe(argument);
      expect(slide.presentationContentMode).toBe('pitch');
      expect(slide.presentationTextLimits.subtitle.maxChars).toBeGreaterThanOrEqual(index === 0 ? 220 : 320);
      const token = slide.presentationTypographyByComposition[slide.presentationComposition].subtitle;
      expect(token.case).toBe('normal');
      expect(token.sizePercent).toBeGreaterThanOrEqual(70);
      expect(slide.presentationRequiresImage).toBe(false);
    }
  });

  it.each([false, true])('renderiza os dois blocos completos sem placeholder de foto (export=%s)', (forExport) => {
    const slide = { ...mkSlide(2, DEFAULT_BRAND), ...composition(1), ...draft().slides[1], bodyAfterImage: support };
    const html = renderToStaticMarkup(React.createElement(SlideCardInner, {
      slide, fmt: 'apresentacao', brand: applyPresentationVisualPreset(DEFAULT_BRAND, preset),
      num: 2, total: 5, creativePreset: 'apresentacao', forExport,
    }));
    expect(html).toContain(argument);
    expect(html).toContain(support);
    expect(html).not.toContain('Toque para inserir foto');
    expect(html).not.toContain('Fonte:');
  });
});
