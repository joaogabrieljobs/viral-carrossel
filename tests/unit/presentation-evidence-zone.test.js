// MF-13 (reteste 19/11): slide com bloco nativo numa composição sem zona de
// dados ficava com metade vazia e a exportação era barrada.
import { describe, expect, it } from 'vitest';
import { PRESENTATION_VISUAL_PRESETS, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { auditPresentationLayout } from '../../src/utils/presentation-quality.js';
import { repairMissingPresentationEvidence } from '../../src/utils/presentation-composition.js';
import { assertPresentationExportQuality } from '../../src/hooks/useExport.js';

const BLOCKS = {
  metrics: [{ type: 'metrics', items: [{ label: 'Pães por dia', value: '320', detail: 'média de outubro' }, { label: 'Funcionários', value: '6', detail: '' }] }],
  comparison: [{ type: 'comparison', headers: ['Pão', 'Preço'], rows: [['Francês', 'R$ 1,20'], ['Integral', 'R$ 9,00']] }],
  steps: [{ type: 'steps', items: [{ title: 'Fermentar', body: '36 horas' }, { title: 'Assar', body: 'Forno de lastro' }] }],
};
const ROLES = [[0, 'cover'], [2, 'context'], [2, 'story'], [2, 'data'], [4, 'divider'], [5, 'closing']];

describe('bloco nativo sempre tem área de dados', () => {
  for (const preset of PRESENTATION_VISUAL_PRESETS) for (const [type, blocks] of Object.entries(BLOCKS)) {
    it(`${preset.id} · ${type}: toda posição do roteiro passa pela checagem de exportação`, () => {
      for (const [index, role] of ROLES) {
        const slide = { id: `s${index}`, title: 'Indicadores da semana', subtitle: 'O movimento cresce aos sábados.', presentationBlocks: blocks, presentationQualityVersion: 1, presentationPlan: { visualRole: role } };
        const composed = { ...slide, ...getPresentationCompositionOverrides(preset.id, { slide, stage: {}, index, count: 6 }) };
        const audit = auditPresentationLayout(composed, { index });
        expect(audit.issues.map((i) => i.message), `${role} (${index})`).toEqual([]);
        expect(composed.canvas.zones.evidence.w).toBeGreaterThanOrEqual(50);
      }
    });
  }
});

describe('projeto salvo com bloco sem área de dados', () => {
  it('é recomposto como página de dados ao abrir, sem mudar texto nem bloco', () => {
    for (const preset of PRESENTATION_VISUAL_PRESETS) {
      const base = { id: 'x', title: 'Vendas por dia', subtitle: 'Sábado concentra o movimento.', presentationPlan: { visualRole: 'context' } };
      const old = { ...base, ...getPresentationCompositionOverrides(preset.id, { slide: base, stage: {}, index: 2, count: 6 }) };
      const broken = { ...old, presentationBlocks: BLOCKS.comparison, presentationQualityVersion: 1 };
      expect(() => assertPresentationExportQuality({ slides: [broken], roots: [] })).toThrow(/Slide 1: A área de dados/);
      const fixed = repairMissingPresentationEvidence(broken);
      expect(auditPresentationLayout(fixed).issues).toEqual([]);
      expect(fixed.title).toBe(broken.title);
      expect(fixed.subtitle).toBe(broken.subtitle);
      expect(fixed.presentationBlocks).toEqual(broken.presentationBlocks);
      expect(() => assertPresentationExportQuality({ slides: [fixed], roots: [] })).not.toThrow();
    }
  });

  it('não toca slide sem bloco nem slide já correto', () => {
    const slide = { title: 'a', canvas: { applied: true, zones: { title: { x: 1, y: 1, w: 10, h: 10 } } } };
    expect(repairMissingPresentationEvidence(slide)).toBe(slide);
  });

  it('erro de qualidade fica marcado para o aviso não sumir sozinho', () => {
    const base = { id: 'x', title: 'Vendas', subtitle: 'Apoio', presentationPlan: { visualRole: 'context' } };
    const broken = { ...base, ...getPresentationCompositionOverrides(PRESENTATION_VISUAL_PRESETS[0].id, { slide: base, stage: {}, index: 2, count: 6 }), presentationBlocks: BLOCKS.metrics, presentationQualityVersion: 1 };
    try { assertPresentationExportQuality({ slides: [broken], roots: [] }); } catch (error) {
      expect(error.code).toBe('export_quality');
      expect(error.message).toMatch(/Abra o slide 1/);
      return;
    }
    throw new Error('deveria ter barrado');
  });
});
