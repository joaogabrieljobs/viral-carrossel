import { describe, expect, it } from 'vitest';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { VISUAL_PRESETS, SOCIAL_FAMILY_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import { formatFrame } from '../../src/utils/social-families.js';
import { LOGO_TEXT_MIN_GAP_PX, applySocialVisualComposition, logoBoxPct, socialFormatPatch } from '../../src/utils/social-visual-composition.js';

const PRESETS = [...VISUAL_PRESETS, ...SOCIAL_FAMILY_PRESETS];
const LOGO = 'data:image/png;base64,AAAA';
const APOIO = 'O que antes ficava atrás do balcão virou a melhor propaganda da casa, e a fila começa antes de o forno acender.';
const CARDS = [
  { title: 'A padaria que abriu a cozinha para a rua inteira ver', subtitle: 'Um ensaio sobre processo à vista.', imageQuery: '' },
  { title: 'O que mudou quando o balcão saiu da frente do forno', subtitle: APOIO, imageQuery: '' },
  { title: 'Durante anos, o balcão escondia o trabalho de quem acordava cedo', subtitle: APOIO, imageQuery: '' },
  { title: 'A massa descansa à vista de todos', subtitle: 'A janela virou parte da loja.', imageQuery: 'cena', bgImage: LOGO },
  { title: 'Ver o pão nascer muda o preço que a gente aceita pagar', subtitle: '', imageQuery: '' },
  { title: 'Uma cozinha aberta é a melhor vitrine que existe', subtitle: 'Salve para depois e mande para quem tem padaria.', imageQuery: '' },
];

function compor(presetId, logo, formato = 'carrossel') {
  const preset = PRESETS.find((p) => p.id === presetId);
  const brand = { ...applyVisualPreset({ name: 'Padaria', handle: '' }, preset.id), ...(logo ? { logo: LOGO, logoPosition: logo.pos, logoSize: logo.size } : { logo: null }) };
  const cards = CARDS.map((c, i) => ({ ...mkSlide(i + 1, brand), ...c }));
  return applySocialVisualComposition(cards, { preset, brand, formato });
}

/** Distância (px num card de 1080) entre a caixa da logo e uma caixa de texto; 0 = encostadas ou sobrepostas. */
function distancia(zone, box, F) {
  const px = (pct, total) => (pct / 100) * total;
  const dx = Math.max(0, px(box.x0, F.w) - px(zone.x + zone.w, F.w), px(zone.x, F.w) - px(box.x1, F.w));
  const dy = Math.max(0, px(box.y0, F.h) - px(zone.y + zone.h, F.h), px(zone.y, F.h) - px(box.y1, F.h));
  return Math.hypot(dx, dy);
}

describe('QA-2411 carrossel 8: a caixa da logo é a que o card desenha', () => {
  const F = formatFrame('carrossel');
  it('canto, margem de 4,5% da largura e lado igual ao tamanho da logo', () => {
    const tl = logoBoxPct({ pos: 'tl', size: 260 }, F);
    expect([tl.x0, tl.x1, tl.y0, tl.y1].map((v) => Math.round(v * 10) / 10)).toEqual([4.5, 28.6, 3.6, 22.9]);
    const br = logoBoxPct({ pos: 'br', size: 260 }, F);
    expect([br.x0, br.x1, br.y0, br.y1].map((v) => Math.round(v * 10) / 10)).toEqual([71.4, 95.5, 77.1, 96.4]);
    expect(logoBoxPct(null, F)).toBeNull();
    expect(logoBoxPct({ pos: 'c', size: 260 }, F)).toBeNull();
    expect(LOGO_TEXT_MIN_GAP_PX).toBeGreaterThanOrEqual(20);
  });
});

describe('QA-2411 carrossel 8: margem mínima entre a logo e o título', () => {
  const casos = [];
  for (const presetId of ['social_revista', 'sports_editorial', 'minimal_clean', 'social_manchete']) {
    for (const pos of ['tl', 'tr', 'bl', 'br']) for (const size of [260, 150]) casos.push([presetId, pos, size]);
  }

  it.each(casos)('%s, logo %s de %i px: título e apoio ficam a pelo menos a margem mínima da logo', (presetId, pos, size) => {
    const F = formatFrame('carrossel');
    const box = logoBoxPct({ pos, size }, F);
    compor(presetId, { pos, size }).forEach((slide, i) => {
      const { title, subtitle } = slide.canvas.zones;
      expect(distancia(title, box, F), `card ${i + 1} (${slide.socialArt.archetype}): título`).toBeGreaterThanOrEqual(LOGO_TEXT_MIN_GAP_PX - 0.5);
      // Logo embaixo: o bloco inteiro sobe, o apoio não fica atrás dela.
      if (pos.startsWith('b') && String(slide.subtitle || '').trim()) {
        expect(distancia(subtitle, box, F), `card ${i + 1} (${slide.socialArt.archetype}): apoio`).toBeGreaterThanOrEqual(LOGO_TEXT_MIN_GAP_PX - 0.5);
      }
      expect(title.h, `card ${i + 1}: a caixa do título continua útil`).toBeGreaterThanOrEqual(10);
    });
  });

  it('Quadrado e Stories seguem a mesma regra', () => {
    for (const formato of ['quadrado', 'stories']) {
      const F = formatFrame(formato);
      for (const pos of ['tl', 'br']) {
        const box = logoBoxPct({ pos, size: 260 }, F);
        compor('sports_editorial', { pos, size: 260 }).forEach((slide, i) => {
          const view = { ...slide, ...socialFormatPatch(slide, formato) };
          expect(distancia(view.canvas.zones.title, box, F), `${formato} ${pos} card ${i + 1}`).toBeGreaterThanOrEqual(LOGO_TEXT_MIN_GAP_PX - 0.5);
        });
      }
    }
  });

  it('sem logo, a composição é a de sempre; logo pequena que já tinha folga não mexe no título', () => {
    const semLogo = compor('social_revista', null);
    const pequena = compor('social_revista', { pos: 'tr', size: 150 });
    // Miolo da Revista: o título já começa abaixo de uma logo de 150 px.
    expect(pequena[2].canvas.zones.title.y).toBeGreaterThan(16);
    expect(semLogo.every((slide) => slide.socialArt.logo == null)).toBe(true);
    expect(DEFAULT_BRAND.logoSize).toBe(260);
  });
});
