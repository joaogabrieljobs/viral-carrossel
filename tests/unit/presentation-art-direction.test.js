import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PRESENTATION_VISUAL_PRESETS, getPresentationCompositionOverrides, applyPresentationVisualPreset } from '../../src/styles/presentation-presets.jsx';
import { presentationFamily } from '../../src/utils/presentation-art-direction.js';
import { buildPresentationFieldRules } from '../../src/utils/presentation.js';
import PresentationBlocks from '../../src/components/PresentationBlocks.jsx';
import { titleLetterSpacingEm } from '../../src/utils/title-tracking.js';
import { applyEditorialReview } from '../../src/utils/editorial-review.js';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';

const make = (id, role = 'content', extra = {}, stage = {}) => getPresentationCompositionOverrides(id, {
  slide: { title: 'Uma ideia com consequência', subtitle: 'Um argumento completo, sem inventar dados.', presentationPlan: { visualRole: role, purpose: 'explain' }, ...extra },
  index: role === 'cover' ? 0 : 2, count: 5, stage,
});
const presets = PRESENTATION_VISUAL_PRESETS.filter(p => p.sourceId);
describe('direções visuais dos dez padrões planejados', () => {
  it('cada padrão continua em uma família própria', () => {
    expect(presets).toHaveLength(10);
    expect(new Set(presets.map(p => presentationFamily(p.id))).size).toBe(10);
  });
  it('argumentos usam fonte de leitura, sem herdar uppercase e tracking de rótulos', () => {
    for (const preset of presets) {
      const s = make(preset.id);
      const type = s.presentationTypographyByComposition.content.subtitle;
      expect(type.fontFamily, preset.id).toBe(s.presentationBodyTypography.fontFamily);
      expect(type.weight).toBe(s.presentationBodyTypography.weight);
      expect(type.weight).toBeGreaterThanOrEqual(400);
      expect(type.case).toBe('normal');
      expect(type.leadingPercent).toBeGreaterThanOrEqual(132);
    }
  });
  it('conteúdo sem foto mantém variedade espacial e as fontes do padrão', () => {
    const variants = presets.map(p => make(p.id));
    expect(new Set(variants.map(s => JSON.stringify(s.canvas.zones))).size).toBeGreaterThanOrEqual(8);
    expect(new Set(variants.map(s => s.presentationTypographyByComposition.content.title.fontFamily)).size).toBeGreaterThanOrEqual(8);
    expect(variants.every(s => s.presentationSuppressPhoto)).toBe(true);
  });
  it('a abertura expressiva tem escala diferente do argumento, sem fabricar negrito', () => {
    for (const id of ['presentation_cinematic', 'presentation_typographic_bold']) {
      const cover = make(id, 'cover', { imageQuery: 'illustrative scene', title: 'Uma nova direção' });
      expect(cover.titleSize).toBeGreaterThan(make(id).titleSize);
      // Peso real da família (Barlow Condensed SemiBold 600; Anton 400), sem negrito sintético.
      expect([400, 600]).toContain(cover.presentationTypographyByComposition.cover.title.weight);
    }
  });
  it.each([['presentation_cinematic', 0.012], ['presentation_typographic_bold', 0.004]])('o tracking de %s mantém o valor tipográfico real do catálogo', (id, expected) => {
    const slide = make(id, 'cover', { imageQuery: 'illustrative scene', title: 'Uma nova direção' });
    const type = slide.presentationTypographyByComposition.cover.title;
    expect(titleLetterSpacingEm(type.fontFamily, type.tracking)).toBeCloseTo(expected, 4);
  });
  it('as instruções de destaque e leitura chegam também ao pitch', () => {
    for (const mode of ['auto', 'pitch', 'aula_workshop', 'proposta_comercial', 'relatorio_executivo', 'estudo_de_caso', 'keynote_manifesto']) {
      const prompt = buildPresentationFieldRules(mode);
      expect(prompt).toContain('**negrito**');
      expect(prompt).toContain('não use marcação em títulos');
      expect(prompt).toContain('Não repita todas as células');
    }
  });
  it('colunas estreitas pedem menos texto, sem truncar os campos existentes', () => {
    const source = { title: 'Uma ideia com consequência', subtitle: 'Um argumento completo com condição essencial.', imageQuery: 'illustrative photo' };
    const result = make('presentation_cinematic', 'content', source);
    expect(result.canvas.zones.subtitle.w).toBeLessThan(45);
    expect(result.presentationTextLimits.subtitle.maxChars).toBeLessThanOrEqual(180);
    expect({ ...source, ...result }.subtitle).toBe(source.subtitle);
  });
  it('uma revisão com argumento completo ganha coluna de leitura e mantém a foto', () => {
    const source = {
      title: 'Conecte a medição à decisão',
      subtitle: 'O clique isolado não explica o impacto no negócio. A equipe conecta exposição, comportamento esperado e janela de leitura antes de iniciar o experimento. Assim, uma diferença observada pode orientar uma decisão concreta, com responsabilidade clara sobre o próximo passo e sobre os limites da análise.',
      bodyAfterImage: 'A hipótese deve definir o mecanismo esperado e o critério de decisão. Um resultado inconclusivo exige rever a pergunta antes de ampliar o investimento.',
      imageQuery: 'illustrative workshop',
    };
    const result = make('presentation_executive_minimal', 'demo', source, { contentMode: 'pitch' });
    expect(result.canvas.zones.subtitle.w).toBeGreaterThanOrEqual(55);
    expect(result.presentationTextLimits.subtitle.maxChars).toBeGreaterThanOrEqual(source.subtitle.length);
    expect(result.presentationTextLimits.body.maxChars).toBeGreaterThanOrEqual(source.bodyAfterImage.length);
    expect(result.presentationSuppressPhoto).toBe(false);
    expect({ ...source, ...result }.subtitle).toBe(source.subtitle);
  });
  it('aplica a revisão longa com limites recalculados e continua recusando promessa sem fonte', () => {
    const argument = 'O clique isolado não explica o impacto no negócio. A equipe conecta exposição, comportamento esperado e janela de leitura antes de iniciar o experimento. Assim, uma diferença observada pode orientar uma decisão concreta, com responsabilidade clara sobre o próximo passo e sobre os limites da análise.';
    const support = 'A hipótese deve definir o mecanismo esperado e o critério de decisão. Um resultado inconclusivo exige rever a pergunta antes de ampliar o investimento.';
    const slides = ['cover', 'demo', 'closing'].map(visualRole => ({ title: 'Uma conclusão clara', subtitle: 'Uma explicação breve.', bodyAfterImage: '', imageQuery: visualRole === 'demo' ? 'illustrative workshop' : '', presentationPlan: { visualRole, purpose: 'explain' } }));
    const config = { count: 3, presetId: 'apresentacao', densityId: '1_2', presentationPath: 'pitch', factualSource: 'Organizar um teste com hipótese e decisão.', presentationPlan: { slides: [] },
      presentationLimitsForPlan: (_plan, candidate) => candidate.map((slide, index) => getPresentationCompositionOverrides('presentation_executive_minimal', { slide, stage: { contentMode: 'pitch' }, index, count: 3 }).presentationTextLimits),
    };
    const review = { edits: [{ slideIndex: 1, reason: 'Desenvolver o mecanismo e a decisão', subtitle: argument, bodyAfterImage: support }] };
    const result = applyEditorialReview({ slides, caption: '' }, review, config);
    expect(result.slides[1].subtitle).toBe(argument);
    expect(result.slides[1].bodyAfterImage).toBe(support);
    expect(() => applyEditorialReview({ slides, caption: '' }, { edits: [{ ...review.edits[0], subtitle: argument + ' Sem taxas escondidas.' }] }, config)).toThrow(/promessa comercial/);
  });
  it('a identidade do quadro aparece igualmente na prévia e exportação', () => {
    const blocks = [{ type: 'metrics', items: [{ value: '48', label: 'Pedidos', detail: 'Segundo mês do piloto' }] }];
    const html = forExport => renderToStaticMarkup(React.createElement(PresentationBlocks, { blocks, rect: { x: 6, y: 52, w: 88, h: 39 }, frame: { w: 1920, h: 1080 }, family: 'modular', accent: '#5733cc', ink: '#111111', background: '#ffffff', fontFamily: 'Inter', forExport }));
    for (const forExport of [false, true]) {
      const rendered = html(forExport);
      expect(rendered).toContain('data-vc-evidence-design="modular"');
      // QA livre-f3: sem algarismos tabulares; o html2canvas não os desenha e
      // o "1" ficava solto no arquivo. Tela e arquivo usam os mesmos algarismos.
      expect(rendered).not.toContain('tabular-nums');
      expect(rendered).toContain('Segundo mês do piloto');
      expect(rendered).toMatch(/font-size:9\d(\.\d+)?px/);
    }
  });
  it('o contador de apresentação vira fólio discreto na superfície de leitura', () => {
    const id = 'presentation_executive_minimal';
    const slide = { ...mkSlide(1, DEFAULT_BRAND), ...make(id, 'cover'), title: 'Uma ideia com consequência', subtitle: 'Uma explicação breve.' };
    const brand = { ...applyPresentationVisualPreset(DEFAULT_BRAND, id), showPageBadge: true, showHandle: false };
    for (const forExport of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(SlideCardInner, { slide, brand, fmt: 'apresentacao', creativePreset: 'apresentacao', num: 1, total: 3, forExport }));
      const tag = html.match(/<div[^>]*data-vc-presentation-folio="1"[^>]*>/)?.[0];
      expect(tag).toBeTruthy();
      expect(tag).toContain('background:transparent');
      const fontSize = Number(tag.match(/font-size:([\d.]+)px/)?.[1]);
      expect(fontSize).toBeGreaterThanOrEqual(18);
      expect(fontSize).toBeLessThanOrEqual(24);
      expect(html).toContain('1/3');
    }
  });
});
