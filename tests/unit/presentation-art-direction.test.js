import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PRESENTATION_VISUAL_PRESETS, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { presentationFamily } from '../../src/utils/presentation-art-direction.js';
import { buildPresentationFieldRules } from '../../src/utils/presentation.js';
import PresentationBlocks from '../../src/components/PresentationBlocks.jsx';
import { titleLetterSpacingEm } from '../../src/utils/title-tracking.js';

const make = (id, role = 'content', extra = {}) => getPresentationCompositionOverrides(id, {
  slide: { title: 'Uma ideia com consequência', subtitle: 'Um argumento completo, sem inventar dados.', presentationPlan: { visualRole: role, purpose: 'explain' }, ...extra },
  index: role === 'cover' ? 0 : 2, count: 5,
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
      expect(cover.presentationTypographyByComposition.cover.title.weight).toBe(400);
    }
  });
  it.each([['presentation_cinematic', 0.04], ['presentation_typographic_bold', -0.01]])('o tracking de %s mantém o valor tipográfico real do catálogo', (id, expected) => {
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
  it('a identidade do quadro aparece igualmente na prévia e exportação', () => {
    const blocks = [{ type: 'metrics', items: [{ value: '48', label: 'Pedidos', detail: 'Segundo mês do piloto' }] }];
    const html = forExport => renderToStaticMarkup(React.createElement(PresentationBlocks, { blocks, rect: { x: 6, y: 52, w: 88, h: 39 }, frame: { w: 1920, h: 1080 }, family: 'modular', accent: '#5733cc', ink: '#111111', background: '#ffffff', fontFamily: 'Inter', forExport }));
    for (const forExport of [false, true]) {
      const rendered = html(forExport);
      expect(rendered).toContain('data-vc-evidence-design="modular"');
      expect(rendered).toContain('font-variant-numeric:tabular-nums');
      expect(rendered).toContain('Segundo mês do piloto');
      expect(rendered).toContain('font-size:76px');
    }
  });
});
