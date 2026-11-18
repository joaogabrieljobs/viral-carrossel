import { describe, it, expect } from 'vitest';
import { VISUAL_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import {
  applySocialVisualComposition,
  PORTRAIT_CENTER_MAX_SUPPORT_CHARS,
  SOCIAL_COMPOSITION_VERSION,
} from '../../src/utils/social-visual-composition.js';
import { footerChromeReservePct } from '../../src/utils/card-chrome.js';
import { resolvePresetChrome } from '../../src/utils/preset-tokens.js';

const SOCIAIS = VISUAL_PRESETS.filter((p) => p.productKind !== 'apresentacao');
const FORMATOS = ['carrossel', 'quadrado', 'stories'];
const MARCAS = {
  vazia: { name: 'Padrão', handle: '' },
  completa: { name: 'Ateliê Traço', handle: 'atelietraco' },
};
/** Assinatura inteira preenchida pela pessoa: o pior caso para o rodapé. */
const ASSINATURA_CHEIA = {
  cultureHeaderLeft: 'MINHA EDITORIA', cultureHeaderCenter: 'Ateliê Traço', cultureHeaderYear: '2026',
  footerPillText: 'ARRASTA PRO LADO', footerPillArrow: true,
  footerBarLeft: 'Tema|Retratos', footerBarCenter: 'Por|Ateliê Traço', footerBarRight: 'Salve|↓',
};

// capa com foto · miolo com foto · miolo sem foto · miolo com foto · fecho com foto
const cards = (apoio = 'Explicação completa.') => [0, 1, 2, 3, 4].map((i) => ({
  id: `s${i}`, title: 'Uma ideia clara', subtitle: apoio, bodyAfterImage: i > 1 ? 'Condição importante.' : '',
  imageQuery: i === 2 ? '' : 'cena ilustrativa',
}));

const fim = (z) => z.y + z.h;

describe('composição social — o texto nunca fica sob o rodapé', () => {
  const casos = [];
  for (const preset of SOCIAIS) {
    for (const formato of FORMATOS) {
      for (const [nome, marcaBase] of Object.entries(MARCAS)) {
        casos.push([preset, formato, nome, applyVisualPreset(marcaBase, preset.id)]);
      }
      casos.push([preset, formato, 'assinatura cheia', { ...applyVisualPreset(MARCAS.completa, preset.id), ...ASSINATURA_CHEIA }]);
    }
  }

  it.each(casos.map(([p, f, n, m]) => [`${p.id} · ${f} · marca ${n}`, p, f, m]))('%s', (_, preset, formato, brand) => {
    const base = 100 - footerChromeReservePct(resolvePresetChrome(brand), formato);
    const result = applySocialVisualComposition(cards(), { preset, brand, formato });
    for (const slide of result) {
      const { photo, title, subtitle } = slide.canvas.zones;
      for (const z of [photo, title, subtitle]) {
        expect(z.x).toBeGreaterThanOrEqual(0);
        expect(z.y).toBeGreaterThanOrEqual(0);
        expect(z.x + z.w).toBeLessThanOrEqual(100);
        expect(fim(z)).toBeLessThanOrEqual(100);
        expect(z.h).toBeGreaterThan(0);
      }
      // Base do texto acima da faixa do rodapé.
      expect(fim(title)).toBeLessThanOrEqual(base);
      expect(fim(subtitle)).toBeLessThanOrEqual(base);
      // Título e apoio não se cruzam.
      expect(fim(title)).toBeLessThanOrEqual(subtitle.y);
      // Texto fora da foto, exceto na capa em sangria, onde a foto é o fundo.
      if (slide.socialComposition === 'photo-story') expect(fim(photo)).toBeLessThanOrEqual(title.y);
      if (slide.socialComposition === 'portrait-editorial') expect(photo.x + photo.w).toBeLessThanOrEqual(title.x);
      // A zona de apoio continua utilizável depois de ceder espaço.
      expect(subtitle.h).toBeGreaterThanOrEqual(14);
      expect(slide.socialCompositionVersion).toBe(SOCIAL_COMPOSITION_VERSION);
      expect(slide.canvas.source).toBe('social-preset');
    }
  });
});

describe('composição social — exemplos de reserva', () => {
  const preset = (id) => VISUAL_PRESETS.find((p) => p.id === id);

  it('selo com seta sobe a capa cinco pontos no Feed', () => {
    const p = preset('viral_hype_dark');
    const [capa, , , miolo] = applySocialVisualComposition(cards(), { preset: p, brand: applyVisualPreset(MARCAS.vazia, p.id), formato: 'carrossel' });
    expect(capa.canvas.zones.title.y).toBe(42);
    expect(capa.canvas.zones.subtitle).toMatchObject({ y: 72, h: 14 });
    // No miolo a foto cede a altura; título e apoio conservam o tamanho.
    expect(miolo.socialComposition).toBe('photo-story');
    expect(miolo.canvas.zones.photo.h).toBe(45);
    expect(miolo.canvas.zones.title).toMatchObject({ y: 49, h: 20 });
    expect(miolo.canvas.zones.subtitle).toMatchObject({ y: 72, h: 14 });
  });

  it('assinatura oculta por falta de marca não desloca nada', () => {
    const p = preset('tabloid_keywords');
    const [capa] = applySocialVisualComposition(cards(), { preset: p, brand: applyVisualPreset(MARCAS.vazia, p.id), formato: 'carrossel' });
    expect(capa.canvas.zones.title.y).toBe(47);
    expect(capa.canvas.zones.subtitle.y).toBe(77);
  });

  it('hashtag digitada pela pessoa volta a reservar o rodapé', () => {
    const p = preset('tabloid_keywords');
    const brand = { ...applyVisualPreset(MARCAS.vazia, p.id), footerPillText: '#minhatag' };
    const [capa] = applySocialVisualComposition(cards(), { preset: p, brand, formato: 'carrossel' });
    // Selo sem seta: reserva 13% → base 87 → sobe 4.
    expect(capa.canvas.zones.subtitle.y + capa.canvas.zones.subtitle.h).toBe(87);
    expect(capa.canvas.zones.title.y).toBe(43);
  });

  it('sem marca informada usa a assinatura do próprio preset', () => {
    const p = preset('viral_hype_dark');
    const [capa] = applySocialVisualComposition(cards(), { preset: p });
    expect(capa.canvas.zones.subtitle.y).toBe(72);
  });
});

describe('composição social — alinhamento vem do preset', () => {
  const centralizados = ['mood_sepia', 'reflexivo_cream', 'editorial_magazine', 'authority_black', 'minimal_clean'];

  it.each(SOCIAIS.map((p) => [p.id, p]))('%s segue o alinhamento declarado', (id, preset) => {
    const esperado = preset.slideDefaults?.align === 'center' ? 'center' : 'left';
    expect(centralizados.includes(id)).toBe(esperado === 'center');
    const result = applySocialVisualComposition(cards('Apoio curto.'), { preset, brand: applyVisualPreset(MARCAS.vazia, id) });
    for (const slide of result) {
      expect(slide.align).toBe(esperado);
      const vertical = slide.socialComposition === 'cover-photo' ? 'b' : 't';
      expect(slide.layout).toBe(`${vertical}${esperado === 'center' ? 'c' : 'l'}`);
    }
  });

  it('coluna estreita com apoio longo volta para a esquerda', () => {
    const preset = VISUAL_PRESETS.find((p) => p.id === 'editorial_magazine');
    const noLimite = 'a'.repeat(PORTRAIT_CENTER_MAX_SUPPORT_CHARS);
    const acima = 'a'.repeat(PORTRAIT_CENTER_MAX_SUPPORT_CHARS + 1);
    const slide = (subtitle) => [{ id: 'capa', title: 'Capa', subtitle: 'x', imageQuery: 'q' }, { id: 'miolo', title: 'Miolo', subtitle, bodyAfterImage: '', imageQuery: 'q' }, { id: 'fim', title: 'Fim', subtitle: 'x', imageQuery: '' }];
    const [, centro] = applySocialVisualComposition(slide(noLimite), { preset });
    const [, esquerda] = applySocialVisualComposition(slide(acima), { preset });
    expect(centro.socialComposition).toBe('portrait-editorial');
    expect(centro.align).toBe('center');
    expect(esquerda.align).toBe('left');
    expect(esquerda.layout).toBe('tl');
  });

  it('marcadores de destaque não contam como caracteres do apoio', () => {
    const preset = VISUAL_PRESETS.find((p) => p.id === 'mood_sepia');
    const texto = `**${'a'.repeat(PORTRAIT_CENTER_MAX_SUPPORT_CHARS)}**`;
    const [, miolo] = applySocialVisualComposition([{ id: 'c', title: 'C', subtitle: 'x', imageQuery: 'q' }, { id: 'm', title: 'M', subtitle: texto, imageQuery: 'q' }, { id: 'f', title: 'F', subtitle: 'x', imageQuery: '' }], { preset });
    expect(miolo.align).toBe('center');
  });

  it('a regra só vale para a coluna estreita', () => {
    const preset = VISUAL_PRESETS.find((p) => p.id === 'minimal_clean');
    const longo = 'a'.repeat(200);
    const [, miolo] = applySocialVisualComposition([{ id: 'c', title: 'C', subtitle: 'x', imageQuery: 'q' }, { id: 'm', title: 'M', subtitle: longo, imageQuery: 'q' }, { id: 'f', title: 'F', subtitle: 'x', imageQuery: '' }], { preset });
    expect(miolo.socialComposition).toBe('photo-story');
    expect(miolo.align).toBe('center');
  });
});

import { isFlattenedSocialSlide, restoreSocialCompositionTypography, SOCIAL_COMPOSITION_TYPOGRAPHY } from '../../src/utils/social-visual-composition.js';

describe('projetos achatados — restaurar hierarquia do estilo', () => {
  const preset = VISUAL_PRESETS.find((p) => p.id === 'editorial_magazine');
  const gerados = () => applySocialVisualComposition(cards(), { preset });
  // O que a antiga sincronização fazia: tudo em 100, entrelinhas da marca.
  const achatar = (slide) => ({ ...slide, titleSize: 100, subSize: 100, bodyAfterSize: 100, titleLeading: 112, subLeading: 145 });

  it('a composição nunca produz a assinatura do achatamento', () => {
    for (const slide of gerados()) expect(isFlattenedSocialSlide(slide)).toBe(false);
    for (const t of Object.values(SOCIAL_COMPOSITION_TYPOGRAPHY)) expect([t.titleSize, t.subSize, t.bodyAfterSize]).not.toEqual([100, 100, 100]);
  });

  it('restaura tamanhos e entrelinhas sem tocar em zonas, texto ou foto', () => {
    const originais = gerados();
    const achatados = originais.map(achatar);
    expect(achatados.every(isFlattenedSocialSlide)).toBe(true);
    expect(restoreSocialCompositionTypography(achatados)).toEqual(originais);
  });

  it('só toca cards com a assinatura; ajuste manual fica', () => {
    const [capa, miolo] = gerados();
    const manual = { ...miolo, titleSize: 120 };
    const result = restoreSocialCompositionTypography([achatar(capa), manual]);
    expect(result[0].titleSize).toBe(88);
    expect(result[1]).toBe(manual);
  });

  it('sem nada a restaurar devolve o mesmo array', () => {
    const slides = gerados();
    expect(restoreSocialCompositionTypography(slides)).toBe(slides);
    const legado = [{ id: 'x', titleSize: 100, subSize: 100, bodyAfterSize: 100 }];
    expect(restoreSocialCompositionTypography(legado)).toBe(legado);
  });
});
