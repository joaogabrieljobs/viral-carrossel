// Modo livre, fase 2: defeitos visuais abertos na conferência da fase 1
// (qa-harness-local/livre-f1/folha-padrao.png e folha-kit.png).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyPresentationVisualPresetToDoc, applyPresentationVisualPresetToSlides } from '../../src/utils/presentation-state.js';
import {
  DEFAULT_DECK_DESIGN, FREE_PRESENTATION_PRESET_ID, FREE_SURFACE_MIN_CONTRAST, freeDeckViolations, normalizeDeckDesign,
} from '../../src/utils/free-design.js';
import { chromeElements, chromeTokensForSlide } from '../../src/utils/presentation-chrome.js';
import { FAMILY_KEYS } from '../../src/utils/presentation-families.js';
import { getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { wcagContrast } from '../../src/utils/wcag.js';

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
  title: palavras(s.titulo).replace(/^./, c => c.toUpperCase()),
  subtitle: palavras(s.apoio).replace(/^./, c => c.toUpperCase()),
  bodyAfterImage: palavras(s.final),
  ...(s.foto ? { bgImage: FOTO, imageQuery: 'editorial photo' } : {}),
  presentationBlocks: s.bloco ? [{ type: 'metrics', items: [1, 2, 3].map(n => ({ label: `Rótulo ${n}`, value: `${n * 12}%`, detail: palavras(55) })) }] : [],
  presentationPlan: { visualRole: s.visualRole, purpose: s.purpose, question: 'Por quê?', keyMessage: 'Mensagem.' },
}));
const LIVRE = FREE_PRESENTATION_PRESET_ID;
const KIT_ESCURO = { contextMd: 'Fundo: #0D1B2A\nDestaque: #E0A458\nTítulo: #F4F1DE' };
const padrao = () => applyPresentationVisualPresetToSlides(deck(), LIVRE, 'auto');
const kit = () => applyPresentationVisualPresetToDoc({ presentationPath: 'auto', brand: {}, slides: deck(), styleKit: KIT_ESCURO }, LIVRE).slides;
const DECKS = [['padrão', padrao], ['kit escuro', kit]];
const FRAME = { w: 1920, h: 1080 };
const elementos = (s, i) => chromeElements(s.presentationChrome, { frame: FRAME, tokens: chromeTokensForSlide(s, { index: i, total: 10 }), overrides: s.presentationPaletteOverrides, lang: 'pt' });
const pct = v => parseFloat(String(v));
const dentro = (x, y, z) => z && z.w > 0 && z.h > 0 && x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
/** Cor atrás de um ponto: último bloco do chrome que o cobre, senão o fundo da página. */
const blocoAtras = (els, x, y) => [...els].reverse().find(e => !e.text && e.key !== 'ground' && e.style.background && !String(e.style.background).includes('gradient')
  && x >= pct(e.style.left) && x <= pct(e.style.left) + parseFloat(e.style.width) / 19.2 && y >= pct(e.style.top) && y <= pct(e.style.top) + parseFloat(e.style.height) / 10.8);
const atras = (s, els, x, y) => blocoAtras(els, x, y)?.style.background || s.customBg;
const mix = (a, b, t) => {
  const c = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [A, B] = [c(a), c(b)];
  return `#${A.map((v, i) => Math.round(v * t + B[i] * (1 - t)).toString(16).padStart(2, '0')).join('')}`;
};

describe('fase 1 → 2: adornos da família leem (CENA nn em laranja sobre preto)', () => {
  it.each(DECKS)('%s: todo texto do chrome tem contraste ≥ 4,5:1 (≥ 3:1 nos numerais grandes) ou sai', (_, fazer) => {
    const slides = fazer();
    slides.forEach((s, i) => {
      const els = elementos(s, i);
      const fotoAtiva = !s.presentationSuppressPhoto && s.canvas.zones.photo?.w > 0;
      for (const e of els.filter(item => item.text)) {
        const x = pct(e.style.left) + 0.5;
        const y = pct(e.style.top) + 0.5;
        // Pílula tem o próprio fundo; o texto dela mede contra ele.
        const pilula = !!e.style.background;
        const sobreFoto = !pilula && fotoAtiva && dentro(x, y, s.canvas.zones.photo) && !blocoAtras(els, x, y);
        expect(sobreFoto, `slide ${i + 1}: "${e.text}" sobre a foto sem faixa`).toBe(false);
        const fundo = pilula ? e.style.background : atras(s, els, x, y);
        const cor = e.style.opacity != null && e.style.opacity < 1 ? mix(e.style.color, fundo, e.style.opacity) : e.style.color;
        const minimo = e.style.fontSize >= 48 ? 3 : 4.5;
        expect(wcagContrast(cor, fundo), `slide ${i + 1}: "${e.text}" ${cor} sobre ${fundo}`).toBeGreaterThanOrEqual(minimo);
        if (e.style.background && e.style.borderRadius) expect(wcagContrast(e.style.color, e.style.background)).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  it.each(DECKS)('%s: fio de acento não some no fundo (fundo de destaque incluso)', (_, fazer) => {
    fazer().forEach((s, i) => {
      const els = elementos(s, i);
      for (const e of els.filter(item => !item.text && item.key.startsWith('rule'))) {
        const fundo = atras(s, els.filter(item => item !== e), pct(e.style.left) + 0.1, pct(e.style.top));
        expect(wcagContrast(e.style.background, fundo), `slide ${i + 1}: ${e.key} ${e.style.background} sobre ${fundo}`).toBeGreaterThanOrEqual(1.5);
      }
    });
  });
});

describe('fase 1 → 2: fio de acento em página de fundo de destaque, em todas as famílias', () => {
  it.each(FAMILY_KEYS)('%s: nenhum fio some no fundo de destaque', (family) => {
    for (const [index, role] of [[0, 'cover'], [4, 'content'], [9, 'closing']]) {
      const s = getPresentationCompositionOverrides(LIVRE, {
        slide: { title: 'Festa na cidade', subtitle: 'Ritmo e encontro', presentationPlan: { visualRole: role, purpose: 'context', design: { family, ground: 'accent', photo: 'none', block: 'none', emphasis: [], icons: [] } } },
        stage: {}, index, count: 10, previous: [],
      });
      const els = elementos(s, index);
      for (const e of els.filter(item => !item.text && item.key.startsWith('rule'))) {
        const fundo = atras(s, els.filter(item => item !== e), pct(e.style.left) + 0.1, pct(e.style.top));
        expect(wcagContrast(e.style.background, fundo), `${family} ${role} ${s.presentationFreeDesign.ground}: ${e.key} ${e.style.background} sobre ${fundo}`).toBeGreaterThanOrEqual(1.5);
      }
      for (const e of els.filter(item => item.text)) {
        expect(wcagContrast(e.style.color, atras(s, els, pct(e.style.left) + 0.5, pct(e.style.top) + 0.5)), `${family} ${role}: "${e.text}"`).toBeGreaterThanOrEqual(e.style.fontSize >= 48 ? 3 : 4.5);
      }
    }
  });
});

describe('fase 1 → 2: faixas do Cinemático são escuras também com kit escuro', () => {
  it('as faixas de letterbox usam a cor mais escura do deck', () => {
    const slides = kit();
    const faixas = slides.flatMap((s, i) => elementos(s, i).filter(e => !e.text && e.style.width === '1920px' && parseFloat(e.style.height) < 130 && e.key.startsWith('block')));
    expect(faixas.length).toBeGreaterThan(0);
    for (const f of faixas) expect(wcagContrast(f.style.background, '#FFFFFF'), f.style.background).toBeGreaterThan(wcagContrast(f.style.background, '#000000'));
  });
});

describe('fase 1 → 2: fundo e superfície distintos', () => {
  it('a paleta garante diferença perceptível entre bg e surface, sem perder leitura', () => {
    for (const raw of [DEFAULT_DECK_DESIGN, { palette: { bg: '#0D1B2A', ink: '#F4F1DE', accent: '#E0A458' } }, { palette: { bg: '#FFFFFF', surface: '#FCFCFC' } }, { palette: { bg: '#000000' } }]) {
      const p = normalizeDeckDesign(raw).palette;
      expect(wcagContrast(p.bg, p.surface), `${p.bg} × ${p.surface}`).toBeGreaterThanOrEqual(FREE_SURFACE_MIN_CONTRAST);
      expect(wcagContrast(p.ink, p.surface)).toBeGreaterThanOrEqual(4.5);
      expect(wcagContrast(p.muted, p.surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(FREE_SURFACE_MIN_CONTRAST).toBeGreaterThanOrEqual(1.15);
    expect(normalizeDeckDesign(DEFAULT_DECK_DESIGN)).toEqual(DEFAULT_DECK_DESIGN);
  });

  it('o validador conta bg e surface como um fundo só quando eles quase não se distinguem', () => {
    const fundos = (surface) => padrao().map((s, i) => ({
      ...s,
      presentationFreeDesign: { ...s.presentationFreeDesign, ground: i === 0 ? 'inverse' : i % 2 ? 'surface' : 'bg' },
      presentationPaletteOverrides: { ...s.presentationPaletteOverrides, surface },
    }));
    const p = padrao()[0].presentationPaletteOverrides;
    expect(freeDeckViolations(fundos(p.surface)).map(v => v.code)).not.toContain('free_grounds_variety');
    expect(freeDeckViolations(fundos(p.bg)).map(v => v.code)).toContain('free_grounds_variety');
    expect(freeDeckViolations(padrao())).toEqual([]);
  });
});

describe('fase 1 → 2: títulos do Tipográfico com a fonte do deck', () => {
  it.each(DECKS)('%s: título de página de conteúdo até 128 px (capa e divisor até 176 px)', (_, fazer) => {
    fazer().forEach((s, i) => {
      const px = s.titleSize * 1920 * 0.084 / 100;
      const teto = ['cover', 'divider'].includes(s.presentationComposition) ? 176 : 128;
      expect(px, `slide ${i + 1} (${s.presentationFreeDesign.family})`).toBeLessThanOrEqual(teto + 0.5);
    });
  });
});

describe('fase 1 → 2: leitura longa sem vazios grandes', () => {
  it.each(DECKS)('%s: apoio começa logo abaixo do título e ocupa a coluna', (_, fazer) => {
    fazer().forEach((s, i) => {
      const { title, subtitle } = s.canvas.zones;
      const mesmaColuna = Math.min(title.x + title.w, subtitle.x + subtitle.w) - Math.max(title.x, subtitle.x) > 0 && subtitle.y > title.y;
      // Cartões do Modular: título e apoio em cartões próprios, de propósito.
      const emCartao = s.presentationFreeTextSurfaces?.subtitle !== s.customBg;
      if (!mesmaColuna || emCartao || s.presentationFreeDesign.ground === 'photo' || s.presentationFreeDesign.block !== 'none' || !['content', 'demo'].includes(s.presentationComposition)) return;
      const tituloPx = s.titleSize * 1920 * 0.084 / 100;
      const linhas = Math.max(1, Math.ceil(s.title.length * 0.55 * tituloPx / (1920 * title.w / 100 - 24)));
      const fimDoTitulo = title.y + (linhas * tituloPx * 1.1) / 10.8;
      // Estimativa folgada: inclui o respiro que o renderer reserva abaixo da
      // última linha (~0,44 do corpo do título) e uma linha a mais quando o
      // título fica no limite. Na fase 1 o Executivo passava de 20%.
      expect(subtitle.y - fimDoTitulo, `slide ${i + 1} (${s.presentationFreeDesign.family})`).toBeLessThanOrEqual(15);
      // As zonas não se sobrepõem (a conferência de exportação mede as duas).
      expect(title.y + title.h, `slide ${i + 1}: zona do título invade o apoio`).toBeLessThanOrEqual(subtitle.y + 0.01);
    });
  });
});

describe('fase 1 → 2: a foto troca de lado', () => {
  it.each(DECKS)('%s: fotos laterais dos dois lados, nunca 4 seguidas do mesmo lado', (_, fazer) => {
    const lados = fazer().filter(s => !s.presentationSuppressPhoto && ['small', 'half'].includes(s.presentationFreeDesign.photo))
      .map(s => (s.canvas.zones.photo.x + s.canvas.zones.photo.w / 2 < 50 ? 'esquerda' : 'direita'));
    expect(new Set(lados).size, lados.join(',')).toBe(2);
    expect(lados.filter(l => l === 'esquerda').length).toBeGreaterThanOrEqual(2);
    lados.forEach((l, i) => { if (i >= 3) expect(lados.slice(i - 3, i + 1).every(x => x === l), lados.join(',')).toBe(false); });
  });
});
