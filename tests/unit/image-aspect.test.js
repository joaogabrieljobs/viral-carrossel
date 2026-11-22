import { describe, it, expect } from 'vitest';
import {
  formatImageAspectRatio, imageAspectRatioForSlide, imageFramingDirection,
  nearestSupportedRatio, photoPanelAspect, PANEL_MISMATCH_THRESHOLD,
} from '../../shared/image-aspect.js';
import { VISUAL_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import { applySocialVisualComposition } from '../../src/utils/social-visual-composition.js';
import { PRESENTATION_VISUAL_PRESETS, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { presentationPhotoAspectRatio } from '../../src/utils/presentation-composition.js';

const zona = (x, y, w, h) => ({ canvas: { applied: true, zones: { photo: { x, y, w, h } } } });

describe('proporção da imagem segue o painel onde ela aparece', () => {
  it('formato suportado mais próximo', () => {
    expect(nearestSupportedRatio(1.63)).toBe('3:2');
    expect(nearestSupportedRatio(1.9)).toBe('16:9');
    expect(nearestSupportedRatio(1)).toBe('1:1');
    expect(nearestSupportedRatio(0.64)).toBe('2:3');
    expect(nearestSupportedRatio(0.37)).toBe('9:16');
    expect(nearestSupportedRatio(0)).toBe('16:9');
  });

  it('sem painel conhecido vale a proporção do formato', () => {
    expect(imageAspectRatioForSlide({}, 'carrossel')).toBe('4:5');
    expect(imageAspectRatioForSlide({}, 'quadrado')).toBe('1:1');
    expect(imageAspectRatioForSlide({}, 'stories')).toBe('9:16');
    expect(imageAspectRatioForSlide({}, 'apresentacao')).toBe('16:9');
    expect(formatImageAspectRatio('desconhecido')).toBe('4:5');
    // Zona 1×1 é o marcador de "sem foto".
    expect(imageAspectRatioForSlide(zona(96, 94, 1, 1), 'carrossel')).toBe('4:5');
    // Canvas não aplicado não vale como painel.
    expect(imageAspectRatioForSlide({ canvas: { zones: { photo: { x: 0, y: 0, w: 100, h: 49 } } } }, 'carrossel')).toBe('4:5');
  });

  it('capa em sangria mantém a proporção do formato', () => {
    expect(imageAspectRatioForSlide(zona(0, 0, 100, 100), 'carrossel')).toBe('4:5');
    expect(photoPanelAspect(zona(0, 0, 100, 100), 'carrossel').fullBleed).toBe(true);
  });

  it('R2: a faixa do miolo recebe paisagem, não retrato', () => {
    // Antes: 2:3 numa faixa 100×49 mostrava ~40% da altura e cortava o rosto.
    expect(imageAspectRatioForSlide(zona(0, 0, 100, 49), 'carrossel')).toBe('3:2');
    expect(photoPanelAspect(zona(0, 0, 100, 49), 'carrossel').mismatch).toBeLessThan(PANEL_MISMATCH_THRESHOLD);
  });

  it('coluna estreita pede o formato mais alto e reconhece que ainda haverá corte', () => {
    const coluna = zona(0, 0, 46, 100);
    expect(imageAspectRatioForSlide(coluna, 'carrossel')).toBe('9:16');
    const painel = photoPanelAspect(coluna, 'carrossel');
    expect(painel.zoneRatio).toBeCloseTo(0.368, 3);
    expect(painel.mismatch).toBeGreaterThan(0.4);
  });

  it.each(VISUAL_PRESETS.filter((p) => p.productKind !== 'apresentacao').map((p) => [p.id, p]))('composição social %s: cada painel recebe o formato mais próximo', (id, preset) => {
    const cards = [0, 1, 2, 3, 4].map((i) => ({ id: `s${i}`, title: 'T', subtitle: 'S', imageQuery: i === 2 ? '' : 'q' }));
    const slides = applySocialVisualComposition(cards, { preset, brand: applyVisualPreset({ name: 'Padrão', handle: '' }, id) });
    for (const slide of slides) {
      const pedido = imageAspectRatioForSlide(slide, 'carrossel');
      if (slide.socialComposition === 'cover-photo') expect(pedido).toBe('4:5');
      if (slide.socialComposition === 'photo-story') {
        // Com selo no rodapé a foto cede altura e o painel chega a 16:9.
        expect(['3:2', '16:9']).toContain(pedido);
        expect(photoPanelAspect(slide, 'carrossel').mismatch).toBeLessThan(PANEL_MISMATCH_THRESHOLD);
      }
      if (slide.socialComposition === 'portrait-editorial') expect(pedido).toBe('9:16');
      if (slide.socialComposition === 'typographic') expect(pedido).toBe('4:5');
    }
  });

  it.each(PRESENTATION_VISUAL_PRESETS.filter((p) => !p.isCustom).map((p) => [p.id]))('deck %s: mesma escolha da função que a criação já usava', (presetId) => {
    for (const [index, visualRole] of ['cover', 'content', 'demo', 'divider', 'closing'].entries()) {
      const base = { id: `p${index}`, title: 'T', subtitle: 'S', imageQuery: 'cena', presentationPlan: { visualRole, purpose: 'explain' } };
      const slide = { ...base, ...getPresentationCompositionOverrides(presetId, { slide: base, index, count: 5 }) };
      expect(imageAspectRatioForSlide(slide, 'apresentacao')).toBe(presentationPhotoAspectRatio(slide));
    }
  });

  it('R2: a capa do deck gerada pelo editor deixa de ser 16:9 num painel vertical', () => {
    const base = { id: 'capa', title: 'T', subtitle: 'S', imageQuery: 'cena', presentationPlan: { visualRole: 'cover', purpose: 'introduction' } };
    const capa = { ...base, ...getPresentationCompositionOverrides('presentation_executive_minimal', { slide: base, index: 0, count: 5 }) };
    expect(capa.canvas.zones.photo).toMatchObject({ w: 42, h: 100 });
    expect(imageAspectRatioForSlide(capa, 'apresentacao')).toBe('2:3');
  });

  it('deck sem composição versionada ou com foto suprimida fica em 16:9', () => {
    expect(imageAspectRatioForSlide(zona(64, 0, 36, 100), 'apresentacao')).toBe('16:9');
    expect(imageAspectRatioForSlide({ ...zona(64, 0, 36, 100), presentationCompositionVersion: 2, presentationSuppressPhoto: true }, 'apresentacao')).toBe('16:9');
  });
});

describe('instrução de enquadramento', () => {
  it('sempre pede o essencial legível depois do recorte', () => {
    expect(imageFramingDirection({}, 'carrossel')).toMatch(/identifying features and the essential action readable after cropping/);
    expect(imageFramingDirection({}, 'carrossel')).toMatch(/Protect faces, hands and key product features/);
  });

  it('coluna estreita: assunto no terço central', () => {
    expect(imageFramingDirection(zona(0, 0, 46, 100), 'carrossel')).toMatch(/tall, narrow column.*central vertical third/);
  });

  it('faixa muito larga: assunto na faixa central', () => {
    expect(imageFramingDirection(zona(0, 30, 100, 20), 'carrossel')).toMatch(/wide, shallow band.*central horizontal band/);
  });

  it('painel bem atendido não recebe aviso de corte', () => {
    const texto = imageFramingDirection(zona(0, 0, 100, 49), 'carrossel');
    expect(texto).not.toMatch(/cropped/);
  });

  it('capa com texto sobre a foto: assunto acima da zona de texto, metade de baixo calma', () => {
    const capa = { canvas: { applied: true, zones: { photo: { x: 0, y: 0, w: 100, h: 100 }, title: { x: 7, y: 47, w: 86, h: 28 } } } };
    expect(imageFramingDirection(capa, 'carrossel')).toMatch(/Type overlays the lower half.*above that zone.*lower half visually quiet/);
  });
});
