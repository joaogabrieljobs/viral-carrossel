import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { contentAwarePresentationOverrides } from '../../src/utils/presentation-composition.js';
import { presentationForSocialFormat } from '../../src/utils/presentation-format.js';
import PresentationArtChrome from '../../src/components/card/PresentationArtChrome.jsx';
import PresentationBlocks from '../../src/components/PresentationBlocks.jsx';
import LegacyPresentationBlocks from '../../src/components/LegacyPresentationBlocks.jsx';
import { GENERATED_PRESENTATION_PATTERNS } from '../../src/generated/presentation-design-system.generated.js';
import { getPresentationCompositionOverrides, PRESENTATION_VISUAL_PRESET_CATALOG } from '../../src/styles/presentation-presets.jsx';
import { ensureDocShape } from '../../src/utils/doc-schema.js';

const KINDS = ['cover', 'divider', 'content', 'demo', 'data', 'closing'];

describe('biblioteca 2.0 no fluxo de composição', () => {
  it('quadros de projetos antigos mantêm exatamente o tratamento visual anterior', () => {
    const props = { blocks: [{ type: 'metrics', items: [{ value: '48', label: 'Pedidos', detail: 'Base fornecida' }] }], rect: { x: 6, y: 50, w: 88, h: 40 },
      frame: { w: 1920, h: 1080 }, family: 'data', ink: '#111111', background: '#ffffff', fontFamily: 'Inter', forExport: true };
    const previous = renderToStaticMarkup(React.createElement(LegacyPresentationBlocks, props));
    const preserved = renderToStaticMarkup(React.createElement(PresentationBlocks, { ...props, artDirectionVersion: 1 }));
    const redesigned = renderToStaticMarkup(React.createElement(PresentationBlocks, { ...props, artDirectionVersion: 2 }));
    expect(preserved).toBe(previous);
    expect(redesigned).not.toBe(previous);
  });
  it('a escolha manual também aplica a biblioteca nova e o catálogo oculta todos os antigos', () => {
    const visible = PRESENTATION_VISUAL_PRESET_CATALOG.filter(p => !p.hidden);
    expect(visible).toHaveLength(10);
    for (const p of visible) {
      const result = getPresentationCompositionOverrides(p.id, { slide: { title: 'Escolha manual' }, index: 0, count: 3 });
      expect(result.presentationArtDirectionVersion, p.id).toBe(2);
      expect(result.presentationCompositionVersion).toBe(3);
      const saved = ensureDocShape({ fmt: 'apresentacao', productKind: 'apresentacao', slides: [{ ...result, title: 'Escolha manual' }] });
      expect(saved.slides[0].logoSize).toBe(80);
    }
  });
  for (const p of GENERATED_PRESENTATION_PATTERNS) {
    it(`${p.id}: compõe 16:9, desenha o chrome e recompõe 4:5`, () => {
      const base = { ...p.slideDefaults, presentationPresetId: p.id };
      for (const kind of KINDS) {
        const slide = { title: 'Uma ideia com consequência', subtitle: 'Argumento curto.', imageQuery: kind === 'data' ? '' : 'foto',
          presentationBlocks: kind === 'data' ? [{ type: 'metrics', items: [{ value: '3', label: 'etapas' }] }] : [] };
        const out = contentAwarePresentationOverrides(base, slide, kind);
        expect(out.presentationArtDirectionVersion).toBe(2);
        expect(out.presentationComposition).toBe(kind);
        expect(out.presentationTypographyByComposition[kind].subtitle.weight).toBeGreaterThanOrEqual(400);
        if (kind === 'data') expect(out.canvas.zones.evidence).toBeTruthy();
        const chrome = renderToStaticMarkup(React.createElement(PresentationArtChrome, { slide: out, frame: { w: 1920, h: 1080 }, index: 1, total: 6 }));
        expect(chrome).toContain('data-vc-presentation-art');
        const social = presentationForSocialFormat({ ...slide, ...out, bgImage: kind === 'data' ? '' : 'x.jpg' }, 'carrossel');
        expect(social.presentationChrome.format).toBe('4:5');
        expect(social.canvas.zones.title.h).toBeGreaterThan(5);
        expect({ ...slide, ...social }.subtitle).toBe(slide.subtitle);
      }
    });
  }
  it('o ajuste manual da foto não é sobrescrito pelo tratamento da família', () => {
    const base = { ...GENERATED_PRESENTATION_PATTERNS.find((p) => p.id === 'presentation_swiss_grid').slideDefaults, presentationPresetId: 'presentation_swiss_grid' };
    const out = contentAwarePresentationOverrides({ ...base, presentationImgAdjust: { brightness: 110 } }, { title: 'x', imageQuery: 'y' }, 'content');
    expect(out.presentationImgAdjust).toEqual({ brightness: 110 });
    expect(out.presentationPhotoTreatment).toMatch(/grayscale/);
  });
  it('etapas usam a numeração da família', () => {
    const html = renderToStaticMarkup(React.createElement(PresentationBlocks, { blocks: [{ type: 'steps', items: [{ title: 'Ver', body: 'x' }, { title: 'Grade', body: 'y' }] }], rect: { x: 6, y: 40, w: 88, h: 50 }, frame: { w: 1920, h: 1080 }, family: 'luxury', ink: '#000', background: '#fff', fontFamily: 'Jost' }));
    expect(html).toContain('>II<');
  });
});
