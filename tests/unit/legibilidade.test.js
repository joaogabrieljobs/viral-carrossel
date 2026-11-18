import { describe, it, expect } from 'vitest';
import { PRESENTATION_VISUAL_PRESETS, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { VISUAL_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import { applySocialVisualComposition } from '../../src/utils/social-visual-composition.js';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';
import { presentationSupportTextSize, PRESENTATION_SUPPORT_MIN_VIEW_SIZE } from '../../src/utils/presentation-composition.js';
import { auditRenderedPresentationLayout, PRESENTATION_TEXT_FLOOR_RATIO } from '../../src/utils/presentation-quality.js';
import { FORMATS } from '../../src/utils/formats.js';

// Mesmas bases do renderer (ClassicCanvasInner): subtítulo 2,8% e apoio 1,8% da largura.
const subtituloPx = (slide, w) => w * 0.028 * ((slide.subSize ?? 100) / 100);
const apoioPx = (slide, w) => w * 0.018 * ((slide.bodyAfterSize ?? 100) / 100);

describe('piso de leitura — o que a composição gera nasce legível', () => {
  // Rodada R2: o apoio saiu com ~19 px no card de 1080 e ~18 px no slide de 1920.
  const PISO_SOCIAL = FORMATS.carrossel.w * 0.024; // 26 px
  const PISO_DECK = FORMATS.apresentacao.w * PRESENTATION_TEXT_FLOOR_RATIO; // 24 px

  it.each(VISUAL_PRESETS.filter((p) => p.productKind !== 'apresentacao').map((p) => [p.id, p]))('carrossel %s: subtítulo e apoio acima de 26 px', (id, preset) => {
    const cards = [0, 1, 2, 3, 4].map((i) => ({ id: `s${i}`, title: 'Título', subtitle: 'Apoio.', bodyAfterImage: 'Condição.', imageQuery: i === 2 ? '' : 'q' }));
    for (const slide of applySocialVisualComposition(cards, { preset, brand: applyVisualPreset({ name: 'Padrão', handle: '' }, id) })) {
      expect(subtituloPx(slide, 1080)).toBeGreaterThanOrEqual(PISO_SOCIAL);
      expect(apoioPx(slide, 1080)).toBeGreaterThanOrEqual(PISO_SOCIAL);
    }
  });

  const papeis = ['cover', 'content', 'divider', 'data', 'demo', 'closing'];
  it.each(PRESENTATION_VISUAL_PRESETS.filter((p) => !p.isCustom).map((p) => [p.id]))('apresentação %s: apoio chega à tela com 24 px ou mais', (presetId) => {
    for (const [index, visualRole] of papeis.entries()) {
      const slide = { id: `p${index}`, title: 'Título do slide', subtitle: 'Explicação.', bodyAfterImage: 'Condição que precisa ser lida.', presentationPlan: { visualRole, purpose: 'explain' } };
      const composto = { ...slide, ...getPresentationCompositionOverrides(presetId, { slide, index, count: papeis.length }) };
      // O que o renderer recebe: a vista 16:9 reescala os tamanhos do slide.
      const naTela = slideForFormatDisplay(composto, 'apresentacao', {}, 'apresentacao');
      expect(naTela.bodyAfterSize).toBeGreaterThanOrEqual(PRESENTATION_SUPPORT_MIN_VIEW_SIZE);
      expect(apoioPx(naTela, 1920)).toBeGreaterThanOrEqual(PISO_DECK);
    }
  });

  it('o apoio segue o corpo do preset quando ele é maior que o piso', () => {
    // 81,02 é o corpo do Executivo Minimalista: 28 px em 1920.
    expect(presentationSupportTextSize({ bodyAfterSize: 81.02 })).toBe(180);
    expect(presentationSupportTextSize({ bodyAfterSize: 60 })).toBe(156);
    expect(presentationSupportTextSize({})).toBe(160);
    expect(presentationSupportTextSize({ bodyAfterSize: 'x' })).toBe(160);
  });
});

describe('aviso de texto pequeno na apresentação — nunca bloqueia', () => {
  const caixa = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  const texto = (fontSize, conteudo = 'texto') => ({ fontSize, childNodes: [{ nodeType: 3, textContent: conteudo }], querySelectorAll: () => [] });
  function slideSimulado({ apoio = 28, zona = 'subtitle' } = {}) {
    const paragrafos = [texto(38.7, 'Explicação do slide.'), texto(apoio, 'Condição importante.')];
    const node = {
      textContent: 'Explicação do slide. Condição importante.', childNodes: [],
      getAttribute: (nome) => (nome === 'data-vc-quality-zone' ? zona : null),
      getBoundingClientRect: () => caixa(100, 400, 1600, 300), scrollHeight: 300, clientHeight: 300, scrollWidth: 1600, clientWidth: 1600,
      querySelectorAll: () => paragrafos, contains: () => false,
    };
    const surface = {
      clientWidth: 1920, matches: () => true, getAttribute: () => 'slide-1',
      getBoundingClientRect: () => caixa(0, 0, 1920, 1080),
      querySelectorAll: (seletor) => (seletor === '[data-vc-quality-zone]' ? [node] : []),
    };
    return { root: surface, getStyle: (el) => ({ fontSize: el.fontSize ? `${el.fontSize}px` : '' }) };
  }

  it('apoio de 28 px passa sem ocorrência', () => {
    const env = slideSimulado({ apoio: 28 });
    expect(auditRenderedPresentationLayout([env.root], env)).toEqual({ ok: true, issues: [] });
  });

  it('apoio de 18 px gera aviso e o slide continua exportável', () => {
    const env = slideSimulado({ apoio: 18 });
    const { ok, issues } = auditRenderedPresentationLayout([env.root], env);
    expect(ok).toBe(true);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'text-below-floor', severity: 'warning', slideIndex: 0 });
  });

  it('no limite de 24 px não avisa', () => {
    const env = slideSimulado({ apoio: 24 });
    expect(auditRenderedPresentationLayout([env.root], env).issues).toEqual([]);
  });

  it('blocos de dados têm escala própria e ficam fora do aviso', () => {
    const env = slideSimulado({ apoio: 18, zona: 'evidence' });
    expect(auditRenderedPresentationLayout([env.root], env).issues).toEqual([]);
  });
});
