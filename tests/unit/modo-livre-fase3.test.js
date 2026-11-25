// Modo livre de apresentação, fase 3 (docs/product/modo-livre-apresentacao.md):
// blocos novos citação (quote), número grande (bignumber) e ícones (icons).
// Validação, guarda de fatos, pedido à IA, desenho, contraste, piso de leitura,
// zonas e auditorias de exportação.
import { createHash } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PresentationBlocks from '../../src/components/PresentationBlocks.jsx';
import LegacyPresentationBlocks from '../../src/components/LegacyPresentationBlocks.jsx';
import {
  auditPresentationLayout, buildPresentationBlocksPrompt, mapPresentationBlockStrings,
  normalizePresentationBlocks, presentationBlockStrings,
} from '../../src/utils/presentation-quality.js';
import { groundPresentationBlocks } from '../../src/utils/factual-grounding.js';
import { hasBlocks } from '../../src/utils/presentation-composition.js';
import { FREE_ICONS, FREE_PRESENTATION_PRESET_ID, freeDeckViolations, normalizeSlideDesign } from '../../src/utils/free-design.js';
import { PRESENTATION_ICON_NAMES } from '../../src/utils/presentation-icons.js';
import { applyPresentationVisualPresetToSlides } from '../../src/utils/presentation-state.js';
import { freePaletteOverrides, DEFAULT_DECK_DESIGN } from '../../src/utils/free-design.js';
import { wcagContrast } from '../../src/utils/wcag.js';

const QUOTE = { type: 'quote', text: 'A praça cheia é o melhor palco da cidade.', author: 'Ana Souza, curadora' };
const BIG = { type: 'bignumber', value: '40 mil', label: 'pessoas por edição', detail: 'Público somado das 12 noites' };
const ICONS = { type: 'icons', items: [
  { icon: 'music', title: 'Palcos abertos', body: 'Shows gratuitos em cada praça.' },
  { icon: 'leaf', title: 'Feira de produtores', body: 'Comida local do começo ao fim.' },
  { icon: 'users', title: 'Oficinas', body: 'Atividades para crianças.' },
] };
const MATERIAL = 'O festival reúne mais de 40 mil pessoas por edição em 12 noites. Palcos abertos, feira de produtores e oficinas para crianças. "A praça cheia é o melhor palco da cidade", disse Ana Souza, curadora do festival.';

describe('fase 3: validação dos blocos novos', () => {
  it('aceita citação, número grande e ícones dentro do contrato', () => {
    expect(normalizePresentationBlocks([QUOTE])).toEqual([QUOTE]);
    expect(normalizePresentationBlocks([{ ...QUOTE, author: '' }])).toEqual([{ ...QUOTE, author: '' }]);
    expect(normalizePresentationBlocks([BIG])).toEqual([BIG]);
    expect(normalizePresentationBlocks([ICONS])).toEqual([ICONS]);
  });

  it('a citação perde só as aspas de fora; texto, autoria e números ficam', () => {
    expect(normalizePresentationBlocks([{ ...QUOTE, text: `“${QUOTE.text}”` }])[0].text).toBe(QUOTE.text);
    expect(normalizePresentationBlocks([{ ...QUOTE, text: `"${QUOTE.text}"` }])[0].text).toBe(QUOTE.text);
  });

  it('rejeita inteiro o bloco fora do contrato, sem cortar palavras', () => {
    expect(normalizePresentationBlocks([{ ...QUOTE, text: 'x'.repeat(241) }])).toEqual([]);
    expect(normalizePresentationBlocks([{ ...QUOTE, text: '' }])).toEqual([]);
    expect(normalizePresentationBlocks([{ ...BIG, value: 'muitas' }])).toEqual([]);
    expect(normalizePresentationBlocks([{ ...BIG, value: '1234567890123456789' }])).toEqual([]);
    expect(normalizePresentationBlocks([{ ...BIG, label: '' }])).toEqual([]);
    expect(normalizePresentationBlocks([{ ...ICONS, items: ICONS.items.slice(0, 1) }])).toEqual([]);
    expect(normalizePresentationBlocks([{ ...ICONS, items: [...ICONS.items, ...ICONS.items] }])).toEqual([]);
    expect(normalizePresentationBlocks([{ ...ICONS, items: [{ ...ICONS.items[0], icon: 'skull' }, ICONS.items[1]] }])).toEqual([]);
    expect(normalizePresentationBlocks([{ ...ICONS, items: [{ ...ICONS.items[0], title: '' }, ICONS.items[1]] }])).toEqual([]);
  });

  it('ícones só da lista fechada de 26 lucide (a mesma da fase 2)', () => {
    expect(PRESENTATION_ICON_NAMES).toHaveLength(26);
    expect(FREE_ICONS).toEqual(PRESENTATION_ICON_NAMES);
  });

  it('texto dos blocos novos entra nas conferências de texto (ler e trocar)', () => {
    expect(presentationBlockStrings(QUOTE)).toEqual([QUOTE.text, QUOTE.author]);
    expect(presentationBlockStrings(BIG)).toEqual([BIG.value, BIG.label, BIG.detail]);
    expect(presentationBlockStrings(ICONS)).toEqual(ICONS.items.flatMap(item => [item.title, item.body]));
    const upper = mapPresentationBlockStrings(ICONS, value => value.toUpperCase());
    expect(upper.items[0]).toEqual({ icon: 'music', title: 'PALCOS ABERTOS', body: 'SHOWS GRATUITOS EM CADA PRAÇA.' });
    expect(mapPresentationBlockStrings(BIG, value => `${value}!`)).toEqual({ type: 'bignumber', value: '40 mil!', label: 'pessoas por edição!', detail: 'Público somado das 12 noites!' });
  });
});

describe('fase 3: guarda de fatos — citação e número grande só com fonte no material', () => {
  const slides = blocks => blocks.map(block => ({ title: 'Título', subtitle: '', presentationBlocks: [block] }));
  it('citação literal do material fica, com a autoria', () => {
    const out = groundPresentationBlocks(slides([QUOTE]), { factualSource: MATERIAL });
    expect(out.slides[0].presentationBlocks).toEqual([QUOTE]);
    expect(out.dropped).toEqual([]);
  });
  it('citação que não está no material cai (o bloco vira none)', () => {
    const out = groundPresentationBlocks(slides([{ ...QUOTE, text: 'O festival muda a vida de quem vem.' }]), { factualSource: MATERIAL });
    expect(out.slides[0].presentationBlocks).toEqual([]);
    expect(out.dropped).toEqual([{ slideIndex: 0, type: 'quote', reason: 'citação sem fonte no material' }]);
  });
  it('autoria inventada sai; a frase do material fica', () => {
    const out = groundPresentationBlocks(slides([{ ...QUOTE, author: 'Prefeito João Lima' }]), { factualSource: MATERIAL });
    expect(out.slides[0].presentationBlocks).toEqual([{ ...QUOTE, author: '' }]);
  });
  it('número grande do material fica; número que não está no material cai', () => {
    expect(groundPresentationBlocks(slides([BIG]), { factualSource: MATERIAL }).slides[0].presentationBlocks).toEqual([BIG]);
    expect(groundPresentationBlocks(slides([{ ...BIG, value: '12' }]), { factualSource: MATERIAL }).slides[0].presentationBlocks).toEqual([{ ...BIG, value: '12' }]);
    const out = groundPresentationBlocks(slides([{ ...BIG, value: '55 mil' }]), { factualSource: MATERIAL });
    expect(out.slides[0].presentationBlocks).toEqual([]);
    expect(out.dropped[0]).toMatchObject({ type: 'bignumber' });
    expect(groundPresentationBlocks(slides([{ ...BIG, value: '7' }]), { factualSource: MATERIAL }).slides[0].presentationBlocks).toEqual([]);
  });
  it('sem material não há o que conferir: nada muda (deck já existente)', () => {
    const input = slides([{ ...QUOTE, text: 'Qualquer frase.' }]);
    expect(groundPresentationBlocks(input, {}).slides).toBe(input);
  });
  it('blocos antigos e ícones passam (a revisão de fatos já os confere)', () => {
    const metrics = { type: 'metrics', items: [{ label: 'Público', value: '40 mil', detail: '' }] };
    expect(groundPresentationBlocks(slides([metrics, ICONS]), { factualSource: MATERIAL }).dropped).toEqual([]);
  });
});

describe('fase 3: pedido à IA', () => {
  it('fora do modo livre o pedido de blocos é o mesmo de antes', () => {
    expect(createHash('sha256').update(buildPresentationBlocksPrompt()).digest('hex').slice(0, 16)).toBe('dcbe58805e94baab');
    expect(buildPresentationBlocksPrompt()).not.toMatch(/quote|bignumber|icons/);
  });
  it('no modo livre o pedido descreve os 3 blocos, a lista de ícones e a regra de fonte', () => {
    const p = buildPresentationBlocksPrompt({ free: true });
    expect(p.startsWith(buildPresentationBlocksPrompt())).toBe(true);
    expect(p).toContain('"type":"quote"');
    expect(p).toContain('"type":"bignumber"');
    expect(p).toContain('"type":"icons"');
    for (const name of PRESENTATION_ICON_NAMES) expect(p).toContain(name);
    expect(p).toMatch(/literal/);
    expect(p).toMatch(/design\.block/);
  });
});

const FRAME = { w: 1920, h: 1080 };
const RECT = { x: 40, y: 32, w: 54, h: 52 };
const palette = freePaletteOverrides(DEFAULT_DECK_DESIGN);
const render = (block, extra = {}) => renderToStaticMarkup(React.createElement(PresentationBlocks, {
  blocks: [block], rect: RECT, frame: FRAME, ink: palette.muted, strongInk: palette.ink, background: palette.surface,
  fontFamily: 'Inter, sans-serif', family: 'executive', accent: palette.accent, paletteOverrides: palette, artDirectionVersion: 2,
  numericTypography: { fontFamily: '"Fraunces", Georgia, serif', weight: 380 }, ...extra,
}));
const styleOf = (html, attr) => {
  const at = html.indexOf(attr);
  const tag = html.slice(html.lastIndexOf('<', at), html.indexOf('>', at));
  return tag.match(/style="([^"]*)"/)?.[1] || '';
};
const px = (style, prop) => Number(style.match(new RegExp(`(?:^|;)${prop}:([\\d.]+)px`))?.[1]);
const color = (style, prop = 'color') => style.match(new RegExp(`(?:^|;)${prop}:(#[0-9A-Fa-f]{6})`))?.[1];

describe('fase 3: desenho dos blocos novos', () => {
  it('citação: frase em destaque, autoria com piso de 25 px, contraste de leitura', () => {
    const html = render(QUOTE);
    expect(html).toContain('data-vc-presentation-block="quote"');
    expect(html).toContain('data-vc-quality-zone="evidence"');
    expect(html).toContain('<blockquote');
    const text = styleOf(html, 'data-vc-quote-text');
    const author = styleOf(html, 'data-vc-quote-author');
    expect(px(text, 'font-size')).toBeGreaterThanOrEqual(40);
    expect(px(author, 'font-size')).toBeGreaterThanOrEqual(25);
    expect(wcagContrast(color(text), palette.surface)).toBeGreaterThanOrEqual(4.5);
    expect(wcagContrast(color(author), palette.surface)).toBeGreaterThanOrEqual(4.5);
    expect(html).toContain(QUOTE.text);
    expect(html).toContain(QUOTE.author);
  });

  it('número grande: o número enorme lê (≥ 3:1, texto grande); rótulo e apoio ≥ 4,5 e ≥ 25 px', () => {
    const html = render(BIG);
    const value = styleOf(html, 'data-vc-bignumber-value');
    const label = styleOf(html, 'data-vc-bignumber-label');
    const detail = styleOf(html, 'data-vc-bignumber-detail');
    expect(px(value, 'font-size')).toBeGreaterThanOrEqual(96);
    expect(wcagContrast(color(value), palette.surface)).toBeGreaterThanOrEqual(3);
    expect(px(label, 'font-size')).toBeGreaterThanOrEqual(25);
    expect(px(detail, 'font-size')).toBeGreaterThanOrEqual(25);
    expect(wcagContrast(color(label), palette.surface)).toBeGreaterThanOrEqual(4.5);
    expect(wcagContrast(color(detail), palette.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('número grande longo encolhe para caber na largura da zona, sem quebrar', () => {
    const html = render({ ...BIG, value: 'R$ 1.299.990' });
    const value = styleOf(html, 'data-vc-bignumber-value');
    expect(px(value, 'font-size') * 'R$ 1.299.990'.length * 0.62).toBeLessThanOrEqual((RECT.w / 100) * FRAME.w);
    expect(value).toContain('white-space:nowrap');
  });

  it('ícones: SVG inline com cor sólida (o html2canvas captura), título e uma linha legíveis', () => {
    const html = render(ICONS);
    const svgs = html.match(/<svg[^>]*>/g) || [];
    expect(svgs).toHaveLength(3);
    for (const svg of svgs) {
      const stroke = svg.match(/stroke="(#[0-9A-Fa-f]{6})"/)?.[1];
      expect(stroke).toBeTruthy();
      expect(wcagContrast(stroke, palette.surface)).toBeGreaterThanOrEqual(3);
      expect(svg).toMatch(/width="\d/);
      expect(svg).not.toContain('currentColor');
    }
    const title = styleOf(html, 'data-vc-icons-title');
    const body = styleOf(html, 'data-vc-icons-body');
    expect(px(title, 'font-size')).toBeGreaterThanOrEqual(25);
    expect(px(body, 'font-size')).toBeGreaterThanOrEqual(25);
    expect(wcagContrast(color(body), palette.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('células editáveis no editor, como tabela e métricas; nada editável no arquivo', () => {
    const editable = render(ICONS, { onChange: () => {} });
    expect((editable.match(/data-vc-inline-editable="true"/g) || []).length).toBe(6);
    expect(editable).toContain('aria-label="Trocar ícone 1"');
    expect(render(QUOTE, { onChange: () => {} })).toContain('aria-label="Editar autoria"');
    expect(render(BIG, { onChange: () => {}, forExport: true })).not.toContain('data-vc-inline-editable');
  });

  it('células de texto entram na auditoria de contraste do arquivo', () => {
    for (const block of [QUOTE, BIG, ICONS]) expect(render(block)).toContain('data-vc-evidence-cell="true"');
  });

  it('deck antigo (direção de arte 1) não quebra com bloco novo', () => {
    const html = renderToStaticMarkup(React.createElement(LegacyPresentationBlocks, { blocks: [QUOTE], rect: RECT, frame: FRAME, ink: '#111111', background: '#FFFFFF', fontFamily: 'Inter' }));
    expect(html).toBe('');
  });
});

describe('fase 3: blocos novos na composição do modo livre', () => {
  const slide = (block, i) => ({
    id: `s${i}`, title: `Título ${i + 1}`, subtitle: 'Apoio curto da página.',
    presentationBlocks: block ? [block] : [], presentationPlan: { visualRole: i === 0 ? 'cover' : i === 5 ? 'closing' : 'content', purpose: 'context' },
  });
  const deck = () => [null, QUOTE, BIG, ICONS, null, null].map(slide);

  it('hasBlocks conhece os blocos novos', () => {
    for (const block of [QUOTE, BIG, ICONS]) expect(hasBlocks({ presentationBlocks: [block] })).toBe(true);
  });

  it('o design da página segue o bloco que existe: sem bloco escrito, o bloco proposto cai para none', () => {
    expect(normalizeSlideDesign({ block: 'bignumber' }, { title: 'Público de 40 mil' }).block).toBe('none');
    expect(normalizeSlideDesign({ block: 'bignumber' }, { title: 'Público', presentationBlocks: [BIG] }).block).toBe('bignumber');
    expect(normalizeSlideDesign({ block: 'quote' }, { title: 'Frase', presentationBlocks: [QUOTE] }).block).toBe('quote');
    expect(normalizeSlideDesign({ block: 'icons', icons: [] }, { title: 'x', presentationBlocks: [ICONS] })).toMatchObject({ block: 'icons', icons: ['music', 'leaf', 'users'] });
  });

  it('cada bloco ganha a zona de dados, cabe no slide e passa na auditoria de exportação', () => {
    const out = applyPresentationVisualPresetToSlides(deck(), FREE_PRESENTATION_PRESET_ID, 'auto');
    [1, 2, 3].forEach((i) => {
      const s = out[i];
      expect(s.presentationComposition).toBe('data');
      expect(s.presentationFreeDesign.block).toBe(['quote', 'bignumber', 'icons'][i - 1]);
      expect(s.canvas.zones.evidence.w).toBeGreaterThanOrEqual(50);
      expect(s.canvas.zones.evidence.h).toBeGreaterThanOrEqual(25);
      expect(auditPresentationLayout(s, { index: i }).issues).toEqual([]);
    });
    expect(freeDeckViolations(out)).toEqual([]);
  });

  it('presets comuns também desenham o bloco novo quando ele existe (caminho natural)', () => {
    const out = applyPresentationVisualPresetToSlides(deck(), 'presentation_executive_minimal', 'auto');
    expect(out[2].presentationComposition).toBe('data');
    expect(auditPresentationLayout(out[2], { index: 2 }).ok).toBe(true);
  });
});
