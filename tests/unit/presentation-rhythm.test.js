// Spec 1.1, entrega 2 (ritmo de layout). Na Apoteose (QA 24/11, Cinemático),
// os slides 2, 3, 5, 6, 7 e 8 saíram com a mesma geometria: texto numa coluna
// de 30% à esquerda e foto em 60% à direita. Nenhuma regra olhava as vizinhas.
// A regra vale na hora de compor (geração e "aplicar estilo"), nunca na leitura.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  contentAwarePresentationZones,
  resolvePresentationCompositionKind,
} from '../../src/utils/presentation-composition.js';
import { getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { applyPresentationVisualPresetToSlides } from '../../src/utils/presentation-state.js';
import { PAGE_KINDS, familyFromPresetId } from '../../src/utils/presentation-families.js';
import { ensureDocShape } from '../../src/utils/doc-schema.js';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';

const apoteose = JSON.parse(readFileSync(new URL('../fixtures/apoteose-estrutura.json', import.meta.url), 'utf8'));
const FOTO = 'data:image/png;base64,iVBORw0KGgo=';
const palavras = (n) => {
  const base = 'festa cidade ritmo encontro noite cultura';
  let out = '';
  while (out.length < n) out += (out ? ' ' : '') + base;
  return out.slice(0, n).trim();
};
const deck = () => apoteose.slides.map((s, i) => ({
  id: `apoteose-${i + 1}`,
  title: palavras(s.titulo),
  subtitle: palavras(s.apoio),
  bodyAfterImage: palavras(s.final),
  ...(s.foto ? { bgImage: FOTO, imageQuery: 'editorial photo' } : {}),
  presentationBlocks: s.bloco ? [{ type: 'metrics', items: [1, 2, 3].map(n => ({ label: `Rótulo ${n}`, value: `Valor ${n}`, detail: palavras(55) })) }] : [],
  presentationPlan: { visualRole: s.visualRole, purpose: s.purpose, question: 'Por quê?', keyMessage: 'Mensagem.' },
}));

/** O que o olho vê como "mesma página": lado e largura da foto, texto sobre a foto, chão e coluna do texto. */
const geometria = (slide) => {
  const z = slide.canvas?.zones || {};
  const foto = slide.presentationSuppressPhoto ? 'sem foto' : `${Math.round(z.photo.x)}:${Math.round(z.photo.w)}`;
  return [slide.presentationGround || 'bg', foto, Number(slide.overlay) > 0 ? 'scrim' : '', Math.round(z.title.x), Math.round(z.subtitle.x)].join('|');
};
const trincas = (slides) => slides.map(geometria).flatMap((g, i, all) => (i >= 2 && g === all[i - 1] && g === all[i - 2] ? [i + 1] : []));

describe('ritmo de layout do deck (spec 1.1, entrega 2)', () => {
  it.each([
    ['presentation_cinematic'], ['presentation_executive_minimal'], ['presentation_editorial_magazine'],
  ])('Apoteose em %s: nenhuma geometria três vezes seguidas ao aplicar o estilo', (preset) => {
    const slides = applyPresentationVisualPresetToSlides(deck(), preset, 'auto');
    expect(trincas(slides), slides.map(geometria).join('\n')).toEqual([]);
    // Capa, fechamento e página com bloco nativo não entram no rodízio.
    expect(slides[0].presentationComposition).toBe('cover');
    expect(slides[8].presentationComposition).toBe('data');
    expect(slides[9].presentationComposition).toBe('closing');
    // A foto que o roteiro pediu continua na página.
    slides.forEach((slide, i) => { if (apoteose.slides[i].foto) expect(slide.presentationSuppressPhoto, `slide ${i + 1}`).toBe(false); });
    // Só geometrias que a família já tem: a página alternada é uma das seis funções, com as zonas da própria família.
    const family = familyFromPresetId(preset);
    slides.forEach((slide, i) => {
      expect(PAGE_KINDS).toContain(slide.presentationComposition);
      if (i === 8) return;
      expect(slide.canvas.zones).toEqual(contentAwarePresentationZones(slide.presentationComposition, deck()[i], family));
    });
  });

  it('no Cinemático, a terceira página de conteúdo seguida vira foto em tela cheia com scrim', () => {
    const slides = applyPresentationVisualPresetToSlides(deck(), 'presentation_cinematic', 'auto');
    const kinds = slides.map(slide => slide.presentationComposition);
    expect(kinds).toEqual(['cover', 'content', 'content', 'content', 'content', 'content', 'demo', 'content', 'data', 'closing']);
    expect(slides[6].canvas.zones.photo).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(slides[6].overlay).toBeGreaterThan(0);
  });

  it('página sem foto alterna para a página de frase da família quando a demonstração teria a mesma geometria', () => {
    const semFoto = deck().slice(1, 8).map(({ bgImage, imageQuery, ...slide }) => slide);
    const slides = applyPresentationVisualPresetToSlides([deck()[0], ...semFoto, deck()[9]], 'presentation_cinematic', 'auto');
    expect(trincas(slides), slides.map(geometria).join('\n')).toEqual([]);
    expect(slides.slice(1, 8).map(slide => slide.presentationComposition)).toContain('divider');
  });

  it('na geração, cada slide recebe as composições anteriores; sem vizinhas, nada muda', () => {
    const slides = deck();
    const previous = [];
    const kinds = slides.map((slide, index) => {
      const out = getPresentationCompositionOverrides('presentation_cinematic', { slide, stage: {}, index, count: slides.length, previous });
      previous.push(out);
      return out.presentationComposition;
    });
    expect(kinds[6]).toBe('demo');
    // Chamada antiga (sem vizinhas): comportamento de antes.
    expect(getPresentationCompositionOverrides('presentation_cinematic', { slide: slides[6], stage: {}, index: 6, count: 10 }).presentationComposition).toBe('content');
    expect(resolvePresentationCompositionKind({ slide: slides[6], index: 6, count: 10 })).toBe('content');
  });

  it('bloco nativo continua na página de dados, mesmo depois de duas páginas de dados', () => {
    const comBloco = deck()[8];
    const previous = [7, 8].map(index => getPresentationCompositionOverrides('presentation_cinematic', { slide: comBloco, stage: {}, index, count: 12 }));
    const out = getPresentationCompositionOverrides('presentation_cinematic', { slide: comBloco, stage: {}, index: 9, count: 12, previous });
    expect(out.presentationComposition).toBe('data');
  });

  it('posição ajustada à mão pela pessoa é respeitada', () => {
    const slides = deck();
    slides[6] = { ...slides[6], elementOffsets: { photo: { x: 4, y: 0 } } };
    const out = applyPresentationVisualPresetToSlides(slides, 'presentation_cinematic', 'auto');
    expect(out[6].presentationComposition).toBe('content');
  });

  it('projeto salvo não muda de layout ao abrir', () => {
    // Deck salvo antes da regra: sete páginas de conteúdo iguais em sequência.
    const salvo = deck().map((slide, index) => ({
      ...slide, ...getPresentationCompositionOverrides('presentation_cinematic', { slide, stage: {}, index, count: 10 }),
    }));
    expect(salvo.slice(1, 8).map(slide => slide.presentationComposition)).toEqual(Array(7).fill('content'));
    const doc = ensureDocShape(JSON.parse(JSON.stringify({ fmt: 'apresentacao', productKind: 'apresentacao', creativePreset: 'apresentacao', visualPreset: 'presentation_cinematic', slides: salvo })));
    doc.slides.forEach((slide, index) => {
      const vista = slideForFormatDisplay(slide, 'apresentacao', doc.formatViews, doc.creativePreset);
      expect(vista.presentationComposition).toBe(salvo[index].presentationComposition);
      expect(vista.canvas.zones).toEqual(salvo[index].canvas.zones);
    });
  });
});
