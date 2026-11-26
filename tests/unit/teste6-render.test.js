// Teste 6 da Apoteose, itens 3, 4 e 7 (composição do modo livre):
// - 3: no slide 9 (foto cheia, texto à direita) apoio e corpo saíram com
//   ~14 px num slide de 2000 px: a caixa era pequena e o ajuste automático
//   encolhia o texto;
// - 4: número "05" em pílula no Modular e moldura marrom (mistura fora da
//   paleta) atrás da foto no Cultural;
// - 7: faixas escuras do Cinemático em cima e embaixo da foto cheia.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyPresentationVisualPresetToDoc } from '../../src/utils/presentation-state.js';
import { freeFontSpec, freeTextLines, normalizeDeckDesign } from '../../src/utils/free-design.js';

const T6 = JSON.parse(readFileSync(new URL('../fixtures/apoteose-teste6.json', import.meta.url), 'utf8'));
const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';
const slidesOf = (free = true) => T6.slides.map((s, i) => ({
  id: `t6-${i + 1}`, num: i + 1, title: s.title, subtitle: s.subtitle, bodyAfterImage: s.bodyAfterImage, eyebrow: '',
  presentationBlocks: structuredClone(s.presentationBlocks),
  ...(s.design.photo !== 'none' ? { bgImage: PHOTO, imageQuery: 'photo' } : {}),
  presentationPlan: { schemaVersion: free ? 3 : 2, promptVersion: free ? 'presentation-plan-v3' : 'presentation-plan-v2', visualRole: s.visualRole, purpose: s.purpose,
    question: 'Por quê?', keyMessage: 'Mensagem.', scene: s.design.photo !== 'none' ? { subject: 'people' } : null, ...(free ? { design: s.design } : {}) },
}));
const livre = () => applyPresentationVisualPresetToDoc({ presentationPath: 'auto', brand: { showHandle: false }, presentationDeckDesign: T6.deckDesign, slides: slidesOf(true) },
  'presentation_free', undefined, { initialize: true });

const subPx = slide => slide.subSize * 1920 * 0.028 / 100;
const titlePx = slide => slide.titleSize * 1920 * 0.084 / 100;
const isLetterbox = d => d.t === 'block' && d.w >= 99 && d.h <= 12;
const SUPPORT_FLOOR_PX = 25;

describe('item 3: foto cheia com texto num lado tem o piso de leitura das outras páginas', () => {
  it('slide 9: apoio e corpo com 25 px ou mais e cabendo na caixa (o ajuste automático não encolhe)', () => {
    const deck = livre();
    const s = deck.slides[8];
    expect(s.presentationFreeDesign.ground).toBe('photo');
    const zone = s.canvas.zones.subtitle;
    const px = subPx(s);
    expect(px).toBeGreaterThanOrEqual(SUPPORT_FLOOR_PX);
    const text = freeFontSpec(deck.presentationDeckDesign.fonts.text, 'text');
    const width = 1920 * zone.w / 100 - 24;
    const leading = (s.subLeading || 150) / 100;
    const needed = freeTextLines(s.subtitle, width, px, text.family) * px * leading
      + 0.8 * px + freeTextLines(s.bodyAfterImage, width, px * 0.85, text.family) * px * 0.85 * leading;
    expect(needed).toBeLessThanOrEqual(1080 * zone.h / 100 - 14);
    // O título fica acima do apoio, sem sobrepor, e lê grande.
    expect(s.canvas.zones.title.y + s.canvas.zones.title.h).toBeLessThanOrEqual(zone.y + 0.01);
    expect(titlePx(s)).toBeGreaterThanOrEqual(56);
    // O texto fica no lado protegido pela proteção lateral.
    expect(s.overlayMode).toBe('side');
  });

  it('capa (slide 1) também: apoio com 25 px ou mais', () => {
    const s = livre().slides[0];
    expect(subPx(s)).toBeGreaterThanOrEqual(SUPPORT_FLOOR_PX);
  });
});

describe('item 4: adornos do modo livre só com a paleta do deck, sem numeração-ornamento', () => {
  const deck = livre();
  const paleta = new Set(Object.values(normalizeDeckDesign(deck.presentationDeckDesign).palette));

  it('nenhum número de página/seção como adorno (o "05" do Modular sai)', () => {
    for (const s of deck.slides) {
      const numerals = (s.presentationChrome?.chrome || []).filter(d => ['text', 'pill'].includes(d.t) && /^[\s{}a-z/·§|-]*$/.test(String(d.text || '').replace(/\{(index|section|total)\}/g, '')) && /\{(index|section|total)\}/.test(String(d.text || '')));
      expect(numerals, `slide ${s.num}`).toEqual([]);
    }
  });

  it('molduras, blocos, círculos e fios só com cores da paleta do deck (a moldura marrom sai)', () => {
    for (const s of deck.slides) {
      for (const d of s.presentationChrome?.chrome || []) {
        if (!['block', 'circle', 'frame', 'rule', 'grid'].includes(d.t)) continue;
        expect(paleta.has(String(d.color).toUpperCase()), `slide ${s.num} ${d.t} ${d.color}`).toBe(true);
      }
    }
    const s4 = deck.slides[3];
    expect((s4.presentationChrome.chrome || []).map(d => d.color)).not.toContain('#4A3532');
  });

  it('o bloco que só segurava o número some junto (sem cartão vazio)', () => {
    const s5 = deck.slides[4];
    expect(s5.presentationFreeDesign.family).toBe('modular');
    expect((s5.presentationChrome.chrome || []).filter(d => d.t === 'block' && d.radius && d.w <= 12 && d.h <= 14)).toEqual([]);
  });
});

describe('item 7: foto cheia do modo livre sem faixas de cinema', () => {
  it('slides 1 e 9 (Cinemático, fundo foto) ocupam o quadro inteiro', () => {
    const deck = livre();
    for (const i of [0, 8]) {
      const s = deck.slides[i];
      expect(s.presentationFreeDesign.family).toBe('cinematic');
      expect(s.canvas.zones.photo).toEqual({ x: 0, y: 0, w: 100, h: 100 });
      expect((s.presentationChrome.chrome || []).filter(isLetterbox), `slide ${i + 1}`).toEqual([]);
    }
  });

  it('o Cinemático comum mantém as faixas', () => {
    const comum = applyPresentationVisualPresetToDoc({ presentationPath: 'auto', brand: { showHandle: false }, slides: slidesOf(false) }, 'presentation_cinematic', undefined, { initialize: true });
    expect((comum.slides[0].presentationChrome.chrome || []).filter(isLetterbox)).toHaveLength(2);
  });
});
