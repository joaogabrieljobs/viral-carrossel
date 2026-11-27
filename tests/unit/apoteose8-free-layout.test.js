import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PresentationBlocks from '../../src/components/PresentationBlocks.jsx';
import { freePresentationCompositionOverrides, freeTextLines } from '../../src/utils/free-design.js';
import { contentAwarePresentationLayout } from '../../src/utils/presentation-composition.js';
import { normalizePresentationBlocks } from '../../src/utils/presentation-quality.js';
import { FAMILY_KEYS } from '../../src/utils/presentation-families.js';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/apoteose-teste8.json', import.meta.url), 'utf8'));
const doc = fixture.doc;
const deck = doc.presentationPlan.deckDesign;
// O slide apagado não foi recuperado do banco: texto visível na captura
// 22.03.09 + os sete pares literais do material. A geometria é produzida aqui.
const rows = [...doc.material.content.matchAll(/^- ([^,\n]+), (sem [^\n]+)$/gm)].map(match => [match[1], match[2]]);
const pairs = { type: 'comparison', variant: 'pairs', headers: ['Traço', 'Ressalva'], rows };
const personality = {
  title: 'Brasileira, sofisticada, exclusiva',
  subtitle: 'A personalidade da Apoteose vive nos contrastes: é brasileira sem ser caricata, sofisticada sem ser pretensiosa, exclusiva sem ser arrogante.',
  bodyAfterImage: '', presentationBlocks: [pairs], presentationPlan: doc.presentationPlan.slides[6],
};
const inputAt = index => {
  const saved = doc.slides.find(slide => slide.presentationPlan?.index === index)
    || doc.slides[index < 7 ? index - 1 : index - 2];
  const plan = doc.presentationPlan.slides[index - 1];
  return { ...saved, presentationPlan: plan, imageQuery: plan.scene ? Object.values(plan.scene).join('. ') : '' };
};
const compose = (slide, index = 7, previous = doc.slides.slice(0, index - 1)) => ({ ...slide,
  ...freePresentationCompositionOverrides({}, { slide, index: index - 1, count: 10, previous, deckDesign: deck }),
});
const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x)
  && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
const px = size => size * 1920 * 0.028 / 100;

describe('Apoteose8: comparação executiva preserva conteúdo e área de leitura', () => {
  it('a fixture tem sete pares válidos, sem depender de opção freeDesign inexistente', () => {
    expect(rows).toHaveLength(7);
    expect(normalizePresentationBlocks([pairs])).toEqual([pairs]);
  });

  it('cabe o cabeçalho e sete linhas sem encolher as fontes de 24/28 px', () => {
    const out = compose(personality);
    expect(out.presentationFreeDesign.family).toBe('executive');
    expect(out.presentationBlocks).toEqual([pairs]);
    expect(out.subtitle).toBe(personality.subtitle);
    const { evidence, title, subtitle } = out.canvas.zones;
    // Limite inferior do CSS real: header 24×1.4 +14; 7×(28×1.4 +24).
    expect(evidence.h * 10.8).toBeGreaterThanOrEqual(490);
    expect(evidence.x).toBe(6);
    expect(evidence.w).toBe(88);
    expect(evidence.y + evidence.h).toBeLessThanOrEqual(90);
    expect(overlap(evidence, title)).toBe(false);
    expect(overlap(evidence, subtitle)).toBe(false);
    const html = renderToStaticMarkup(React.createElement(PresentationBlocks, {
      blocks: out.presentationBlocks, rect: evidence, frame: { w: 1920, h: 1080 },
      ink: '#fff', strongInk: '#fff', background: '#2A2158', fontFamily: 'Inter Tight', family: 'executive',
    }));
    expect(html).toContain('font-size:28px');
    expect(html).toContain('font-size:24px');
    rows.flat().forEach(text => expect(html).toContain(text));
  });

  it.each(FAMILY_KEYS)('%s: sete pares têm a altura mínima, com introdução preservada', family => {
    const slide = { ...personality, presentationPlan: { ...personality.presentationPlan,
      design: { ...personality.presentationPlan.design, family } } };
    const out = compose(slide, 7, []);
    expect(out.canvas.zones.evidence.h * 10.8).toBeGreaterThanOrEqual(490);
    expect(out.presentationBlocks[0].rows).toEqual(rows);
    expect(out.subtitle).toBe(personality.subtitle);
  });
});

describe('Apoteose8: fotos planejadas cabem junto do conteúdo', () => {
  it('Modular mantém ícones e foto small em áreas separadas', () => {
    const input = inputAt(4), before = JSON.stringify(input);
    const out = compose(input, 4);
    expect(out.presentationFreeDesign.family).toBe('modular');
    expect(out.presentationFreeDesign.photo).toBe('small');
    expect(out.presentationSuppressPhoto).toBe(false);
    expect(out.presentationBlocks).toEqual(input.presentationBlocks);
    const { photo, title, subtitle, evidence } = out.canvas.zones;
    expect(photo.w * photo.h / 100).toBeGreaterThan(8);
    [title, subtitle, evidence].forEach(zone => expect(overlap(photo, zone)).toBe(false));
    expect(JSON.stringify(input)).toBe(before);
  });

  it('a introdução da música cresce para leitura de pelo menos 32 px usando o vão antes dos ícones', () => {
    const input = inputAt(4), out = compose(input, 4);
    expect(px(out.subSize)).toBeGreaterThanOrEqual(32);
    expect(out.subtitle).toBe(input.subtitle);
    expect(out.canvas.zones.subtitle.x).toBe(70);
    expect(out.canvas.zones.subtitle.w).toBe(26);
    expect(out.canvas.zones.evidence.h).toBeGreaterThanOrEqual(40);
  });

  it('não diminui o título musical por uma largura média quando a fonte medida cabe', () => {
    const out = compose(inputAt(4), 4);
    expect(out.titleSize * 1920 * 0.084 / 100).toBeGreaterThanOrEqual(60);
  });

  it('o público conserva foto half quando a leitura real cabe na coluna', () => {
    const input = inputAt(5), out = compose(input, 5);
    expect(out.presentationFreeDesign.family).toBe('photo');
    expect(out.presentationFreeDesign.photo).toBe('half');
    expect(out.canvas.zones.photo.w * out.canvas.zones.photo.h / 100).toBeGreaterThanOrEqual(30);
    expect(out.subtitle).toBe(input.subtitle);
    expect(out.bodyAfterImage).toBe(input.bodyAfterImage);
    expect(overlap(out.canvas.zones.photo, out.canvas.zones.subtitle)).toBe(false);
  });
});

describe('Apoteose8: escala calculada só na recomposição Livre', () => {
  it.each([3, 5, 7])('título da página %i nunca recebe NaN/undefined', index => {
    const out = compose(index === 7 ? personality : inputAt(index), index);
    expect(Number.isFinite(out.titleSize)).toBe(true);
    expect(out.titleSize).toBeGreaterThan(0);
    expect(out.presentationTypographyByComposition[out.presentationComposition].title.sizePercent).toBe(out.titleSize);
  });

  it('usa o espaço de leitura do Suíço para aumentar apoio, sem mudar suas colunas', () => {
    const input = inputAt(6), out = compose(input, 6);
    expect(px(out.subSize)).toBeGreaterThanOrEqual(36);
    expect(out.canvas.zones.subtitle.x).toBe(input.canvas.zones.subtitle.x);
    expect(out.canvas.zones.subtitle.w).toBe(input.canvas.zones.subtitle.w);
    const zone = out.canvas.zones.subtitle, font = out.presentationDeckDesign.fonts.text;
    const lines = freeTextLines(out.subtitle, 1920 * zone.w / 100 - 24, px(out.subSize), font);
    expect(lines * px(out.subSize) * out.subLeading / 100).toBeLessThan(zone.h * 10.8);
  });

  it('preserva o comportamento dos estilos fixos e não modifica o snapshot salvo', () => {
    const before = JSON.stringify(doc);
    const classic = contentAwarePresentationLayout('data', personality, 'executive');
    expect(classic.evidence).toEqual({ x: 6, y: 46, w: 88, h: 42 });
    const publicClassic = contentAwarePresentationLayout('content', inputAt(5), 'photo');
    expect(publicClassic.photo.w * publicClassic.photo.h / 100).toBe(13);
    compose(inputAt(6), 6);
    expect(JSON.stringify(doc)).toBe(before);
  });
});
