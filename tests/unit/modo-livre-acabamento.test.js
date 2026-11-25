// Modo livre de apresentação: acabamento antes de publicar (revisão visual da
// folha livre-f3). Página de ícones, adornos narrativos das famílias, fecho do
// Cultural, cartão do Modular ao lado da foto, citação e número grande.
// Os decks são os mesmos da conferência (qa-harness-local/livre-f3).
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PresentationBlocks from '../../src/components/PresentationBlocks.jsx';
import { applyPresentationVisualPresetToDoc } from '../../src/utils/presentation-state.js';
import { applyPlanEmphasisToDraft, freeDeckViolations, freePaletteOverrides, DEFAULT_DECK_DESIGN, freeTextLines, FREE_SLIDE_FIELDS } from '../../src/utils/free-design.js';
import { groundPresentationBlocks } from '../../src/utils/factual-grounding.js';
import { auditPresentationLayout } from '../../src/utils/presentation-quality.js';
import { familyLayout, familySpec } from '../../src/utils/presentation-families.js';
import { freeFontSpec } from '../../src/utils/free-design.js';

const apoteose = JSON.parse(readFileSync(new URL('../fixtures/apoteose-estrutura.json', import.meta.url), 'utf8'));
const FOTO = 'data:image/png;base64,iVBORw0KGgo=';
const palavras = (n) => { const base = 'festa cidade ritmo encontro noite cultura'; let out = ''; while (out.length < n) out += (out ? ' ' : '') + base; return out.slice(0, n).trim(); };
const MATERIAL = 'O Festival de verão reúne mais de 40 mil pessoas por edição em 12 noites de programação nas praças do centro. Palcos abertos, feira de produtores e oficinas para crianças. "A praça cheia é o melhor palco da cidade", diz Ana Souza, curadora do festival.';
const BLOCOS = {
  3: { type: 'quote', text: 'A praça cheia é o melhor palco da cidade', author: 'Ana Souza, curadora do festival' },
  5: { type: 'bignumber', value: '40 mil', label: 'pessoas por edição', detail: 'Em 12 noites de programação nas praças do centro' },
  7: { type: 'icons', items: [
    { icon: 'music', title: 'Palcos abertos', body: 'Música em cada praça do centro.' },
    { icon: 'leaf', title: 'Feira de produtores', body: 'Comida e bebida da região.' },
    { icon: 'users', title: 'Oficinas', body: 'Atividades para crianças.' },
  ] },
};
const TITULOS = { 3: 'Quem faz o festival', 5: 'Um público que só cresce', 7: 'O que acontece nas praças' };
const APOIOS = { 3: 'A curadoria parte das praças e de quem vive o centro.', 5: 'Moradores, turistas e famílias de todos os bairros.', 7: 'Três frentes ocupam o centro durante a semana.' };
const DESIGN = [
  { family: 'cinematic', ground: 'photo', photo: 'full', block: 'none', emphasis: ['ritmo'] },
  { family: 'editorial', ground: 'bg', photo: 'half', block: 'none', emphasis: ['encontro noite'] },
  { family: 'typographic', ground: 'inverse', photo: 'small', block: 'none', emphasis: [] },
  { family: 'editorial', ground: 'surface', photo: 'none', block: 'quote', emphasis: [] },
  { family: 'modular', ground: 'bg', photo: 'half', block: 'none', emphasis: [] },
  { family: 'swiss', ground: 'bg', photo: 'none', block: 'bignumber', emphasis: [] },
  { family: 'luxury', ground: 'bg', photo: 'half', block: 'none', emphasis: ['cidade'] },
  { family: 'technical', ground: 'surface', photo: 'none', block: 'icons', emphasis: [], icons: ['music', 'leaf', 'users'] },
  { family: 'photo', ground: 'bg', photo: 'none', block: 'metrics', emphasis: [] },
  { family: 'executive', ground: 'accent', photo: 'half', block: 'none', emphasis: ['festa'] },
];
const DECK_IA = {
  palette: { bg: '#F7F3EA', surface: '#E2D7C1', ink: '#1A1712', muted: '#4E4738', accent: '#B4235A', accent2: '#1F4E5F', inverse: '#1A1712', inverseInk: '#F7F3EA' },
  fonts: { display: 'Space Grotesk', text: 'IBM Plex Sans' },
  mood: 'Warm dusk light over crowded streets, magenta accents, documentary framing.',
};
const slides = (v3 = false) => apoteose.slides.map((s, i) => ({
  id: `livre-${i + 1}`, num: i + 1,
  title: v3 && TITULOS[i] ? TITULOS[i] : palavras(s.titulo).replace(/^./, c => c.toUpperCase()),
  subtitle: v3 && APOIOS[i] ? APOIOS[i] : palavras(s.apoio).replace(/^./, c => c.toUpperCase()),
  bodyAfterImage: v3 && BLOCOS[i] ? '' : palavras(s.final),
  ...(s.foto && !(v3 && BLOCOS[i]) ? { bgImage: FOTO, imageQuery: 'editorial photo' } : {}),
  presentationBlocks: v3 && BLOCOS[i] ? [BLOCOS[i]] : s.bloco ? [{ type: 'metrics', items: [1, 2, 3].map(n => ({ label: `Rótulo ${n}`, value: `${n * 12}%`, detail: palavras(55) })) }] : [],
  presentationPlan: { ...(v3 ? { schemaVersion: 3, promptVersion: 'presentation-plan-v3', design: { icons: [], ...DESIGN[i] } } : {}), visualRole: s.visualRole, purpose: s.purpose, question: 'Por quê?', keyMessage: 'Mensagem.' },
}));
const KIT = { contextMd: 'Fundo: #0D1B2A\nDestaque: #E0A458\nTítulo: #F4F1DE' };
const compor = extra => applyPresentationVisualPresetToDoc({ presentationPath: 'auto', brand: { showHandle: false }, ...extra }, 'presentation_free', undefined, { initialize: true }).slides;
const v3 = () => compor({ slides: groundPresentationBlocks(applyPlanEmphasisToDraft({ slides: slides(true) }).slides, { factualSource: MATERIAL }).slides, presentationDeckDesign: DECK_IA });
const padrao = () => compor({ slides: slides() });
const kit = () => compor({ slides: slides(), styleKit: KIT });

/** Altura (% do slide) do texto de apoio desenhado na zona, pela fonte do deck. */
const apoioPct = (s) => {
  const px = s.subSize * 1920 * 0.028 / 100;
  const leading = (s.subLeading || 150) / 100;
  const widthPx = 1920 * s.canvas.zones.subtitle.w / 100 - 24;
  const font = s.presentationDeckDesign.fonts.text;
  const tail = String(s.bodyAfterImage || '').trim();
  const h = freeTextLines(s.subtitle, widthPx, px, font, 'text') * px * leading
    + (tail ? 0.8 * px + freeTextLines(tail, widthPx, px * 0.85, font, 'text') * px * 0.85 * leading : 0);
  return h / 1080 * 100;
};
const fundo = z => z.y + z.h;
/** Altura (% do slide) das linhas do título desenhadas na zona, pela fonte do deck. */
const tituloPct = (s) => {
  const display = freeFontSpec(s.presentationDeckDesign.fonts.display, 'display');
  const px = s.titleSize * 1920 * 0.084 / 100;
  const lines = freeTextLines(s.title, 1920 * s.canvas.zones.title.w / 100 - 24, px, display.family, 'display', { trackingEm: (display.tracking || 0) / 100, upper: display.case === 'upper' });
  return lines * px * (familySpec(s.presentationFreeDesign.family).type.titleLeading || 1.05) / 1080 * 100;
};
const NARRATIVOS = /CENA|TAB\.|FIG\.|§|NOTA|FIM/;

describe('acabamento: página de ícones (v3, página 8)', () => {
  const s = v3()[7];
  const { title, subtitle, evidence } = s.canvas.zones;

  it('o bloco ocupa a largura útil abaixo do título, alinhado à grade do título', () => {
    expect(s.presentationFreeDesign.block).toBe('icons');
    // O texto do título começa 12 px dentro da zona; o bloco começa nessa linha.
    expect(Math.abs(evidence.x - (title.x + 0.625))).toBeLessThanOrEqual(0.5);
    // Margem direita igual à esquerda.
    expect(Math.abs((100 - fundoX(evidence)) - evidence.x)).toBeLessThanOrEqual(0.7);
    expect(evidence.w).toBeGreaterThanOrEqual(80);
  });

  it('apoio da página logo abaixo do título e acima do bloco', () => {
    expect(subtitle.x).toBe(title.x);
    expect(subtitle.y - fundo(title)).toBeGreaterThanOrEqual(0);
    expect(subtitle.y - fundo(title)).toBeLessThanOrEqual(4);
    expect(fundo(subtitle)).toBeLessThanOrEqual(evidence.y);
  });

  it('página equilibrada: o bloco vai até o pé da área de leitura e nada cruza o bloco', () => {
    expect(fundo(evidence)).toBeGreaterThanOrEqual(85);
    expect(fundo(evidence)).toBeLessThanOrEqual(92);
    const cruza = s.presentationChrome.chrome.filter(d => (d.t === 'rule' || d.t === 'block')
      && d.x < evidence.x + evidence.w && d.x + d.w > evidence.x && d.y < fundo(evidence) && d.y + d.h > evidence.y);
    expect(cruza).toEqual([]);
    expect(auditPresentationLayout(s, { index: 7 }).issues).toEqual([]);
  });
});
function fundoX(z) { return z.x + z.w; }

describe('acabamento: ícones maiores, em selo na cor de destaque suave', () => {
  const palette = freePaletteOverrides(DEFAULT_DECK_DESIGN);
  const render = (extra = {}) => renderToStaticMarkup(React.createElement(PresentationBlocks, {
    blocks: [BLOCOS[7]], rect: { x: 6.6, y: 40, w: 86.8, h: 48 }, frame: { w: 1920, h: 1080 }, ink: palette.muted, strongInk: palette.ink, background: palette.surface,
    fontFamily: 'Inter, sans-serif', family: 'cinematic', accent: palette.accent, paletteOverrides: palette, artDirectionVersion: 2, ...extra,
  }));
  const html = render();
  const attr = (tag, name) => Number(tag.match(new RegExp(`${name}="([\\d.]+)"`))?.[1]);
  const styleOf = (attrName) => { const at = html.indexOf(attrName); return html.slice(html.lastIndexOf('<', at), html.indexOf('>', at)).match(/style="([^"]*)"/)?.[1] || ''; };
  const px = (style, prop) => Number(style.match(new RegExp(`(?:^|;)${prop}:([\\d.]+)px`))?.[1]);

  it('selo de pelo menos 150 px (2,5× o ícone de 60 px) e desenho de pelo menos 80 px', () => {
    const badge = styleOf('data-vc-icon=');
    expect(px(badge, 'width')).toBeGreaterThanOrEqual(150);
    expect(px(badge, 'height')).toBe(px(badge, 'width'));
    expect(badge).toMatch(/border-radius:50%/);
    // Cor sólida (o html2canvas não mistura transparência de forma fiel).
    expect(badge).toMatch(/background-color:#[0-9A-Fa-f]{6}/);
    for (const svg of html.match(/<svg[^>]*>/g)) expect(attr(svg, 'width')).toBeGreaterThanOrEqual(80);
  });

  it('título do item maior (≥ 36 px) e o traço lê contra o selo (≥ 3:1)', async () => {
    const { wcagContrast } = await import('../../src/utils/wcag.js');
    expect(px(styleOf('data-vc-icons-title'), 'font-size')).toBeGreaterThanOrEqual(36);
    const badgeBg = styleOf('data-vc-icon=').match(/background-color:(#[0-9A-Fa-f]{6})/)[1];
    const stroke = html.match(/<svg[^>]*stroke="(#[0-9A-Fa-f]{6})"/)[1];
    expect(wcagContrast(stroke, badgeBg)).toBeGreaterThanOrEqual(3);
  });

  it('coluna estreita: o selo encolhe para caber na coluna', () => {
    const narrow = renderToStaticMarkup(React.createElement(PresentationBlocks, {
      blocks: [{ ...BLOCOS[7], items: [...BLOCOS[7].items, { icon: 'star', title: 'Mais', body: 'Uma linha.' }] }], rect: { x: 40, y: 34, w: 51, h: 52 }, frame: { w: 1920, h: 1080 },
      ink: palette.muted, strongInk: palette.ink, background: palette.surface, fontFamily: 'Inter', family: 'luxury', paletteOverrides: palette, artDirectionVersion: 2,
    }));
    const at = narrow.indexOf('data-vc-icon=');
    const badge = narrow.slice(narrow.lastIndexOf('<', at), narrow.indexOf('>', at));
    const column = (0.51 * 1920 - 3 * 32) / 4;
    expect(px(badge.match(/style="([^"]*)"/)[1], 'width')).toBeLessThanOrEqual(column * 0.6);
  });
});

describe('acabamento: adornos narrativos das famílias fora do modo livre', () => {
  it('nenhuma página do modo livre leva CENA, FIG., TAB., §, NOTA ou FIM, nem o número da página em pílula', () => {
    for (const deck of [v3(), padrao(), kit()]) {
      for (const s of deck) {
        const textos = s.presentationChrome.chrome.filter(d => d.t === 'text' || d.t === 'pill');
        expect(textos.filter(d => NARRATIVOS.test(d.text)), s.id).toEqual([]);
        expect(textos.filter(d => d.t === 'pill' && /\{index\}/.test(d.text)), s.id).toEqual([]);
      }
    }
  });

  it('o número de seção do divisor técnico fica, sem o "§"', () => {
    const doc = applyPresentationVisualPresetToDoc({ presentationPath: 'auto', brand: {}, slides: slides().map((s, i) => (i === 5
      ? { ...s, presentationPlan: { ...s.presentationPlan, schemaVersion: 3, design: { family: 'technical', ground: 'bg', photo: 'none', block: 'none', emphasis: [], icons: [] } } } : s)) },
    'presentation_free', undefined, { initialize: true });
    const s = doc.slides[5];
    if (s.presentationFreeDesign.family === 'technical' && s.presentationComposition === 'divider') {
      expect(s.presentationChrome.chrome.some(d => d.t === 'text' && d.text === '{section}')).toBe(true);
    }
  });

  it('presets comuns mantêm os adornos da família', () => {
    expect(familyLayout('cinematic', 'data', { structured: true }).chrome.some(d => d.text === 'CENA {index}')).toBe(true);
    expect(familyLayout('technical', 'data', { structured: true }).chrome.some(d => d.text === 'TAB. {index}')).toBe(true);
    expect(familyLayout('modular', 'data', { structured: true }).chrome.some(d => d.text === '{index}')).toBe(true);
  });
});

describe('acabamento: fecho do Cultural (padrão, página 10)', () => {
  const s = padrao()[9];
  const { title, subtitle } = s.canvas.zones;
  it('o apoio fica logo abaixo das linhas do título', () => {
    expect(s.presentationFreeDesign.family).toBe('cultural');
    expect(s.presentationComposition).toBe('closing');
    expect(subtitle.y - fundo(title)).toBeGreaterThanOrEqual(0);
    expect(subtitle.y - (title.y + tituloPct(s))).toBeLessThanOrEqual(8);
  });
  it('título e apoio ficam no meio da foto ao lado (sem pender para cima)', () => {
    const { photo } = s.canvas.zones;
    const acima = title.y - photo.y;
    const abaixo = fundo(photo) - (subtitle.y + apoioPct(s));
    expect(Math.abs(acima - abaixo), `acima ${acima} abaixo ${abaixo}`).toBeLessThanOrEqual(4);
  });
});

describe('acabamento: Modular com foto ao lado (kit, página 7)', () => {
  const s = kit()[6];
  const { title, subtitle, photo } = s.canvas.zones;
  const card = s.presentationChrome.chrome.find(d => d.t === 'block' && d.y <= title.y && fundo(d) >= subtitle.y + 1);
  it('a coluna da esquerda é um cartão do tamanho da foto, com título e apoio dentro', () => {
    expect(s.presentationFreeDesign.family).toBe('modular');
    expect(card).toBeTruthy();
    expect(Math.abs(card.y - photo.y)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(fundo(card) - fundo(photo))).toBeLessThanOrEqual(0.5);
    expect(title.x).toBeGreaterThan(card.x);
  });
  it('título e apoio no meio do cartão; o título lê contra o cartão', async () => {
    const { wcagContrast } = await import('../../src/utils/wcag.js');
    const acima = title.y - card.y;
    const abaixo = fundo(card) - (subtitle.y + apoioPct(s));
    expect(Math.abs(acima - abaixo), `acima ${acima} abaixo ${abaixo}`).toBeLessThanOrEqual(6);
    expect(apoioPct(s)).toBeLessThanOrEqual(subtitle.h + 0.5);
    expect(s.presentationFreeTextSurfaces.title.toLowerCase()).toBe(card.color.toLowerCase());
    expect(wcagContrast(s.titleColor, card.color)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('acabamento: citação e número grande (v3, páginas 4 e 6)', () => {
  const deck = v3();
  it('citação: apoio e citação começam na mesma linha, e a linha fica no meio da área abaixo do título', () => {
    const s = deck[3];
    const { title, subtitle, evidence } = s.canvas.zones;
    expect(s.presentationFreeDesign.block).toBe('quote');
    expect(s.presentationBlockAnchor).toBe('start');
    expect(subtitle.y).toBe(evidence.y);
    expect(evidence.y - fundo(title)).toBeGreaterThan(4);
    // O fio vertical do Editorial acompanha a linha.
    const fio = s.presentationChrome.chrome.find(d => d.t === 'rule' && d.h > d.w);
    expect(fio.y).toBe(evidence.y);
    expect(fundo(fio)).toBeLessThanOrEqual(fundo(evidence));
    expect(auditPresentationLayout(s, { index: 3 }).issues).toEqual([]);
  });

  it('número grande no Suíço: título no alto, número e apoio terminam na mesma linha de baixo', () => {
    const s = deck[5];
    const { title, subtitle, evidence } = s.canvas.zones;
    expect(s.presentationFreeDesign.block).toBe('bignumber');
    expect(s.presentationBlockAnchor).toBe('end');
    expect(evidence.y).toBe(title.y);
    expect(Math.abs((subtitle.y + apoioPct(s)) - fundo(evidence))).toBeLessThanOrEqual(1.5);
    expect(auditPresentationLayout(s, { index: 5 }).issues).toEqual([]);
  });

  it('o bloco desenha a âncora pedida', () => {
    const palette = freePaletteOverrides(DEFAULT_DECK_DESIGN);
    const html = anchor => renderToStaticMarkup(React.createElement(PresentationBlocks, {
      blocks: [BLOCOS[5]], rect: { x: 30, y: 9, w: 66, h: 82 }, frame: { w: 1920, h: 1080 }, ink: palette.muted, strongInk: palette.ink, background: palette.bg,
      fontFamily: 'Inter', family: 'swiss', paletteOverrides: palette, artDirectionVersion: 2, anchor,
    }));
    expect(html('end')).toContain('justify-content:flex-end');
    expect(html('start')).toContain('justify-content:flex-start');
    expect(html(undefined)).toContain('justify-content:center');
  });

  it('a âncora é campo do modo livre e sai quando o deck volta a um preset comum', () => {
    expect(FREE_SLIDE_FIELDS).toContain('presentationBlockAnchor');
  });

  it('o deck continua válido', () => {
    expect(freeDeckViolations(deck)).toEqual([]);
    expect(deck.flatMap((s, i) => auditPresentationLayout(s, { index: i }).issues)).toEqual([]);
  });
});
