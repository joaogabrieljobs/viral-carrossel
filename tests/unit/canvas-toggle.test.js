import { describe, it, expect } from 'vitest';
import {
  attachGenerationCanvasLayouts,
  autoAdjustSlides,
  enableCanvasLayoutSlides,
  disableCanvasLayoutSlides,
  removeCanvasLayoutSlides,
} from '../../src/utils/canvas-zones.js';
import {
  finalizeCanvasMarginsForAutoAdjust,
  shouldPreserveCanvasZonesDuringAutoAdjust,
} from '../../src/utils/canvas-layout.js';
import { FORMATS } from '../../src/utils/formats.js';

const base = { id: 's1', title: 'T', subtitle: 'S', bgImage: null, canvas: null };

describe('composição (canvas) — activar/desactivar preserva o que o utilizador ajustou', () => {
  it('activar pela primeira vez infere variante e zonas', () => {
    const [s] = enableCanvasLayoutSlides([base], 'livre');
    expect(s.canvas.enabled).toBe(true);
    expect(s.canvas.applied).toBe(true);
    expect(s.canvas.variant).toBe('classic');
    expect(s.canvas.zones.photo).toBeTruthy();
  });

  it('composição sanduíche cria a faixa de foto a ocupar 100% da largura', () => {
    const [s] = enableCanvasLayoutSlides([{
      ...base,
      bodyAfterImage: 'Fecho',
      imageQuery: 'foto editorial',
      useCultureLayout: true,
    }], 'tendencia_cultura');
    expect(s.canvas.variant).toBe('sandwich');
    expect(s.canvas.zones.photo.x).toBe(0);
    expect(s.canvas.zones.photo.w).toBe(100);
  });

  it('corrige a sugestão sanduíche antiga na primeira ativação sem sobrescrever edição aplicada', () => {
    const legacy = {
      ...base,
      canvas: { enabled: false, applied: false, variant: 'sandwich', zones: {
        top: { x: 6, y: 7, w: 88, h: 22 },
        photo: { x: 6, y: 31, w: 88, h: 41 },
        bottom: { x: 6, y: 74, w: 88, h: 23 },
      } },
    };
    const [upgraded] = enableCanvasLayoutSlides([legacy], 'tendencia_cultura');
    expect(upgraded.canvas.zones.photo).toMatchObject({ x: 0, w: 100 });

    const edited = { ...legacy, canvas: { ...legacy.canvas, applied: true } };
    const [preserved] = enableCanvasLayoutSlides([edited], 'tendencia_cultura');
    expect(preserved.canvas.zones.photo).toMatchObject({ x: 6, w: 88 });
  });

  it('desactivar guarda as zonas; reactivar reutiliza-as em vez de repor os defaults', () => {
    const [on] = enableCanvasLayoutSlides([base], 'livre');
    const moved = { ...on, canvas: { ...on.canvas, zones: { ...on.canvas.zones, photo: { x: 10, y: 55, w: 80, h: 40 } } } };
    const [off] = disableCanvasLayoutSlides([moved]);
    expect(off.canvas.enabled).toBe(false);
    expect(off.canvas.applied).toBe(true);
    expect(off.canvas.zones.photo).toEqual({ x: 10, y: 55, w: 80, h: 40 });
    const [again] = enableCanvasLayoutSlides([off], 'livre');
    expect(again.canvas.enabled).toBe(true);
    expect(again.canvas.zones.photo).toEqual({ x: 10, y: 55, w: 80, h: 40 });
  });

  it('remover composição volta ao layout padrão (canvas null)', () => {
    const [on] = enableCanvasLayoutSlides([base], 'livre');
    const [gone] = removeCanvasLayoutSlides([on]);
    expect(gone.canvas).toBeNull();
  });

  it('geração guarda zonas sem marcar a composição como ativa', () => {
    const [generated] = attachGenerationCanvasLayouts([
      { ...base, imageQuery: 'retrato editorial', bgImage: 'blob:foto' },
    ], { creativePreset: 'livre', slideTextDensity: '1_1' });
    expect(generated.canvas?.zones).toBeTruthy();
    expect(generated.canvas?.enabled).toBe(false);
    expect(generated.canvas?.applied).toBe(false);
  });

  it('geração preserva zonas explícitas de um padrão de apresentação', () => {
    const zones = {
      title: { x: 6, y: 8, w: 42, h: 20 },
      subtitle: { x: 6, y: 32, w: 42, h: 50 },
      photo: { x: 52, y: 10, w: 42, h: 76 },
    };
    const [generated] = attachGenerationCanvasLayouts([{
      ...base,
      imageQuery: 'executive evidence on a widescreen slide',
      canvas: { enabled: false, applied: true, variant: 'classic', zones },
    }], { creativePreset: 'apresentacao', slideTextDensity: '1_2' });
    expect(generated.canvas).toMatchObject({ enabled: false, applied: true, variant: 'classic' });
    expect(generated.canvas.zones).toEqual(zones);
  });

  it('autoajuste preserva a geometria editorial explícita de apresentações 16:9', () => {
    const zones = {
      title: { x: 7, y: 10, w: 38, h: 22 },
      subtitle: { x: 7, y: 36, w: 38, h: 42 },
      photo: { x: 51, y: 8, w: 43, h: 82 },
    };
    const slide = {
      ...base,
      title: 'Uma afirmação executiva que precisa permanecer na coluna editorial definida',
      subtitle: 'Contexto suficiente para disparar as heurísticas de ajuste.',
      bodyAfterImage: 'Fonte: relatório anual 2026 · R$ milhões',
      presentationCompositionId: 'executive-content',
      canvas: {
        enabled: false,
        applied: true,
        variant: 'classic',
        source: 'presentation-preset',
        preserveZones: true,
        zones,
      },
    };

    expect(shouldPreserveCanvasZonesDuringAutoAdjust(slide)).toBe(true);
    const finalized = finalizeCanvasMarginsForAutoAdjust(slide, FORMATS.apresentacao);
    expect(finalized).toMatchObject({ preserved: true, textInsetAdvice: null });
    expect(finalized.zones).toBe(zones);

    const [adjusted] = autoAdjustSlides([slide], {
      creativePreset: 'apresentacao',
      fmt: 'apresentacao',
    });
    expect(adjusted.canvas.zones).toBe(zones);
    expect(adjusted.canvas).toMatchObject({
      source: 'presentation-preset',
      preserveZones: true,
    });
  });

  it('reconhece apresentações antigas pelo id de composição e não migra suas zonas', () => {
    const zones = {
      title: { x: 52, y: 12, w: 40, h: 24 },
      subtitle: { x: 52, y: 40, w: 40, h: 42 },
      photo: { x: 0, y: 0, w: 48, h: 100 },
    };
    const legacyPresentation = {
      ...base,
      presentationCompositionId: 'case-content',
      canvas: { enabled: false, applied: true, variant: 'classic', zones },
    };
    const [adjusted] = autoAdjustSlides([legacyPresentation], {
      creativePreset: 'apresentacao',
      fmt: 'apresentacao',
    });
    expect(adjusted.canvas.zones).toBe(zones);
  });

  it('autoajuste global força cover e reduz texto longo', () => {
    const [adjusted] = autoAdjustSlides([{
      ...base,
      bgImage: 'blob:foto',
      bgFit: 'contain',
      bgX: 12,
      bgY: 84,
      bgZoom: 170,
      title: 'Uma manchete muito longa '.repeat(8),
      subtitle: 'Um texto de apoio igualmente longo. '.repeat(20),
      titleSize: 120,
      subSize: 120,
    }]);
    expect(adjusted.bgFit).toBe('cover');
    expect(adjusted.bgX).toBe(50);
    expect(adjusted.bgY).toBe(50);
    expect(adjusted.bgZoom).toBe(100);
    expect(adjusted.titleSize).toBeLessThan(120);
    expect(adjusted.subSize).toBeLessThan(120);
  });
});
