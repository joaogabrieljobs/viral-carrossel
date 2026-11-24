import { describe, expect, it } from 'vitest';
import { assertPresentationExportQuality, exportRenderScope } from '../../src/hooks/useExport.js';

// FE-24: ao baixar um único slide, a trava de qualidade contava a posição
// dentro do recorte (sempre 1) e mandava a pessoa abrir o slide errado.
const comparison = [{ type: 'comparison', headers: ['Oferta', 'Condição'], rows: [['Assinatura', 'US$ 365/ano'], ['Teste', 'Preço em estudo']] }];
const slide = (id, patch = {}) => ({
  id, title: 'A assinatura sustenta a relação', subtitle: 'O custo de cada entrega define a margem.',
  presentationCompositionId: 'presentation_data', presentationQualityVersion: 1,
  presentationBlocks: comparison, presentationSuppressPhoto: true,
  canvas: { source: 'presentation-preset', variant: 'classic', applied: true, zones: {
    photo: { x: 96, y: 94, w: 1, h: 1 }, title: { x: 6, y: 25, w: 88, h: 14 },
    subtitle: { x: 6, y: 42, w: 88, h: 12 }, evidence: { x: 6, y: 57, w: 88, h: 35 },
  } }, ...patch,
});
const deck = () => {
  const slides = Array.from({ length: 8 }, (_, i) => slide(`s${i + 1}`));
  slides[6].canvas.zones.evidence.y = 90;
  return slides;
};

describe('FE-24 — a trava de qualidade cita o número real do slide', () => {
  it('baixar só o slide 7 aponta o slide 7, não o 1', () => {
    const scope = exportRenderScope(deck(), {}, [6]);
    expect(scope.slides.map((s) => s.id)).toEqual(['s7']);
    expect(() => assertPresentationExportQuality(scope)).toThrow(/^Slide 7: .*Abra o slide 7 para corrigir/);
  });

  it('o escopo guarda a posição de cada slide no projeto', () => {
    expect(exportRenderScope(deck(), {}, [6, 2]).indexes).toEqual([6, 2]);
    expect(exportRenderScope(deck(), {}).indexes).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('defeito medido na tela também usa a posição do projeto', () => {
    const slides = deck().map((s) => slide(s.id));
    const node = { textContent: 'x', scrollHeight: 300, clientHeight: 100, scrollWidth: 10, clientWidth: 10, getBoundingClientRect: () => ({ width: 10, height: 10, left: 0, top: 0, right: 10, bottom: 10 }) };
    const root = {
      matches: (sel) => sel === '[data-vc-presentation="true"]',
      getAttribute: (name) => (name === 'data-vc-card-surface' ? 's5' : null),
      getBoundingClientRect: () => ({ width: 100, height: 100, left: 0, top: 0, right: 100, bottom: 100 }),
      querySelectorAll: () => [node],
    };
    const scope = exportRenderScope(slides, { s5: root }, [4]);
    expect(() => assertPresentationExportQuality(scope)).toThrow(/^Slide 5: /);
  });

  it('exportação completa continua numerando pela ordem do projeto', () => {
    expect(() => assertPresentationExportQuality(exportRenderScope(deck(), {}))).toThrow(/^Slide 7: /);
    expect(() => assertPresentationExportQuality({ slides: [deck()[6]], roots: [] })).toThrow(/^Slide 1: /);
  });
});
