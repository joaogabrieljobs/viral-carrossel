// Spec 1.1, entrega 4 (leitura). Medição da QA no Cinemático, a 1920 px:
// descrição das colunas de evidência (slide 9 da Apoteose) com ~21 px e
// contraste ~4,0 para 1; apoio das páginas de conteúdo com foto em 28 px,
// numa coluna que deixa vazia a metade de baixo do lado esquerdo.
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PresentationBlocks from '../../src/components/PresentationBlocks.jsx';
import {
  EVIDENCE_DETAIL_MIN_PX, FAMILY_KEYS, PAGE_KINDS, familyEvidenceStyle, familyLayout, familySpec,
} from '../../src/utils/presentation-families.js';
import { applyPresentationVisualPresetToSlides } from '../../src/utils/presentation-state.js';
import { wcagContrast } from '../../src/utils/wcag.js';

const DETALHES = ['Curadoria de público fortalece a festa', 'Remixes sem fronteiras rígidas', 'Identidade própria que gera desejo'];
const METRICAS = [{ type: 'metrics', items: DETALHES.map((detail, i) => ({ label: `Rótulo ${i + 1}`, value: `Valor ${i + 1}`, detail })) }];
const ETAPAS = [{ type: 'steps', items: DETALHES.map((body, i) => ({ title: `Etapa ${i + 1}`, body })) }];

const estilo = (attrs) => Object.fromEntries((attrs.match(/style="([^"]*)"/)?.[1] || '').split(';').filter(Boolean).map((par) => {
  const i = par.indexOf(':');
  return [par.slice(0, i), par.slice(i + 1)];
}));
const hex = (value) => {
  const m = /^#([0-9a-f]{6})$/i.exec(String(value || '').trim());
  if (m) return m[1];
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(String(value || ''));
  return rgb ? rgb.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('') : null;
};
/** Cor que o olho vê: a tinta com a opacidade aplicada sobre a superfície. */
const efetiva = (cor, superficie, opacidade = 1) => {
  const a = hex(cor); const b = hex(superficie);
  return '#' + [0, 2, 4].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * opacidade + parseInt(b.slice(i, i + 2), 16) * (1 - opacidade))
    .toString(16).padStart(2, '0')).join('');
};

function descricoes(family, blocks, ink) {
  const p = familySpec(family).palette;
  const st = familyEvidenceStyle(family);
  const html = renderToStaticMarkup(React.createElement(PresentationBlocks, {
    blocks, rect: { x: 40, y: 33, w: 54, h: 54 }, frame: { w: 1920, h: 1080 }, family, ink, background: p.bg, fontFamily: 'Barlow', forExport: true,
  }));
  const superficie = st.panel ? st.panelColor : p.bg;
  return DETALHES.map((texto) => {
    const m = html.match(new RegExp(`<span([^>]*)>${texto}</span>`));
    expect(m, `descrição "${texto}" em ${family}`).toBeTruthy();
    const css = estilo(m[1]);
    const cor = css.color || (st.panel ? st.ink : ink);
    const tamanho = parseFloat(css['font-size'] || '26');
    return { tamanho, contraste: wcagContrast(efetiva(cor, superficie, Number(css.opacity ?? 1)), superficie) };
  });
}

describe('descrição das colunas de evidência (spec 1.1, entrega 4)', () => {
  it('o piso é o menor corpo de leitura que alguma família já usa no 16:9', () => {
    const corpos = FAMILY_KEYS.flatMap((family) => PAGE_KINDS.flatMap((kind) => [false, true].flatMap((photo) => [false, true]
      .map((structured) => familyLayout(family, kind, { photo, structured }).bodyPx))));
    expect(EVIDENCE_DETAIL_MIN_PX).toBe(Math.min(...corpos));
    expect(EVIDENCE_DETAIL_MIN_PX).toBe(25);
  });

  const casos = FAMILY_KEYS.flatMap((family) => {
    const p = familySpec(family).palette;
    // Tinta do texto e tinta secundária da família, sempre que ela lê no fundo.
    return [p.ink, p.muted].filter((ink) => wcagContrast(ink, p.bg) >= 4.5).flatMap((ink) => [['métricas', METRICAS], ['etapas', ETAPAS]]
      .map(([nome, blocks]) => [family, ink, nome, blocks]));
  });

  it.each(casos)('%s, tinta %s, %s: descrição com pelo menos 25 px e contraste de 4,5 para 1', (family, ink, _nome, blocks) => {
    for (const { tamanho, contraste } of descricoes(family, blocks, ink)) {
      expect(contraste, `contraste ${contraste.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      expect(tamanho).toBeGreaterThanOrEqual(25);
    }
  });

  it('Cinemático, tinta secundária: a descrição sai com o piso e passa de 4,5', () => {
    const [primeira] = descricoes('cinematic', METRICAS, familySpec('cinematic').palette.muted);
    expect(primeira.tamanho).toBe(25);
    expect(primeira.contraste).toBeGreaterThanOrEqual(4.5);
  });
});

describe('apoio da página de conteúdo com foto (spec 1.1, entrega 4)', () => {
  const texto = JSON.parse(readFileSync(new URL('../fixtures/apoteose-estrutura.json', import.meta.url), 'utf8'));
  const palavras = (n) => 'festa cidade ritmo encontro noite cultura brasileira '.repeat(20).slice(0, n).trim();
  const deck = () => texto.slides.map((s, i) => ({
    id: `a-${i}`, title: palavras(s.titulo), subtitle: palavras(s.apoio), bodyAfterImage: palavras(s.final),
    ...(s.foto ? { bgImage: 'data:image/png;base64,iVBORw0KGgo=' } : {}),
    presentationBlocks: s.bloco ? [{ type: 'metrics', items: [{ label: 'A', value: 'B', detail: 'C' }] }] : [],
    presentationPlan: { visualRole: s.visualRole, purpose: s.purpose, question: 'Q', keyMessage: 'K' },
  }));
  const px = (slide) => Math.round(slide.subSize / 100 * 1920 * 0.028 * 10) / 10;

  it('no Cinemático, a zona de apoio desce até o fim da área de leitura e o texto cresce para ocupá-la', () => {
    const slides = applyPresentationVisualPresetToSlides(deck(), 'presentation_cinematic', 'auto');
    // Páginas de conteúdo com a foto ao lado do texto (60% à direita).
    const conteudo = slides.filter((slide) => slide.presentationComposition === 'content' && slide.canvas.zones.photo.w === 60);
    expect(conteudo.length).toBeGreaterThanOrEqual(4);
    for (const slide of conteudo) {
      const z = slide.canvas.zones.subtitle;
      expect(z.y + z.h, slide.id).toBeCloseTo(90, 5);
      // Nunca abaixo do corpo da família (28 px) nem acima do maior corpo que a biblioteca usa (32 px).
      expect(px(slide), slide.id).toBeGreaterThanOrEqual(28);
      expect(px(slide), slide.id).toBeLessThanOrEqual(32);
    }
    // Apoio curto (slide 8, 57 caracteres) sobe ao teto; o do slide 6 (124) também cresce.
    // O do slide 2 (179 + 73 caracteres) já enche a coluna: ganha altura, fica em 28 px.
    expect(px(slides[7])).toBeCloseTo(32, 0);
    expect(px(slides[5])).toBeGreaterThan(28);
    expect(px(slides[1])).toBeCloseTo(28, 0);
  });

  it('sem texto (limites pedidos antes da redação) a página não muda', () => {
    const vazio = deck().map((slide) => ({ ...slide, subtitle: '', bodyAfterImage: '' }));
    const slides = applyPresentationVisualPresetToSlides(vazio, 'presentation_cinematic', 'auto');
    expect(px(slides[1])).toBeCloseTo(28, 0);
    expect(slides[1].canvas.zones.subtitle).toEqual({ x: 6, y: 58, w: 30, h: 30 });
  });
});
