import { describe, it, expect } from 'vitest';
import { VISUAL_PRESETS, applyVisualPreset, getSlideOverridesForPreset } from '../../src/styles/visual-presets.jsx';
import {
  // Esta suíte descreve a composição v3, a que os projetos salvos carregam. Os
  // 12 estilos geram agora com a v4 (social-library-v4.test.js, com as mesmas
  // garantias de rodapé, sobreposição e piso de leitura).
  applySocialVisualCompositionV3 as applySocialVisualComposition,
  restyleSocialSlides,
  PORTRAIT_CENTER_MAX_SUPPORT_CHARS,
  SOCIAL_COMPOSITION_TYPOGRAPHY,
  SOCIAL_COMPOSITION_VERSION,
} from '../../src/utils/social-visual-composition.js';
import { footerChromeReservePct } from '../../src/utils/card-chrome.js';
import { resolvePresetChrome } from '../../src/utils/preset-tokens.js';

// Composição v3 dos doze estilos (projetos salvos). As 9 famílias editoriais
// nunca tiveram v3.
const SOCIAIS = VISUAL_PRESETS.filter((p) => p.productKind !== 'apresentacao' && !p.socialFamily);
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
      // Na capa a caixa do apoio acompanha o texto (5,5 a 14); no miolo, 14 no mínimo.
      expect(subtitle.h).toBeGreaterThanOrEqual(slide.socialComposition === 'cover-photo' ? 5.5 : 14);
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
    // Apoio de uma linha: caixa de 5,5% colada na base (86), título logo acima.
    expect(capa.canvas.zones.subtitle).toMatchObject({ y: 80.5, h: 5.5 });
    expect(capa.canvas.zones.title).toMatchObject({ y: 41, h: 38 });
    // No miolo a foto cede a altura; título e apoio conservam o tamanho.
    expect(miolo.socialComposition).toBe('photo-story');
    // Reserva 14% → base 86 → o miolo (limite 90) sobe 4.
    expect(miolo.canvas.zones.photo.h).toBe(42);
    expect(miolo.canvas.zones.title).toMatchObject({ y: 44.5, h: 21.5 });
    expect(miolo.canvas.zones.subtitle).toMatchObject({ y: 67.5, h: 18.5 });
  });

  it('assinatura oculta por falta de marca não desloca nada', () => {
    const p = preset('tabloid_keywords');
    const [capa] = applySocialVisualComposition(cards(), { preset: p, brand: applyVisualPreset(MARCAS.vazia, p.id), formato: 'carrossel' });
    expect(capa.canvas.zones.title.y).toBe(46);
    expect(capa.canvas.zones.subtitle.y).toBe(85.5);
  });

  it('hashtag digitada pela pessoa volta a reservar o rodapé', () => {
    const p = preset('tabloid_keywords');
    const brand = { ...applyVisualPreset(MARCAS.vazia, p.id), footerPillText: '#minhatag' };
    const [capa] = applySocialVisualComposition(cards(), { preset: p, brand, formato: 'carrossel' });
    // Selo sem seta: reserva 13% → base 87 → sobe 4.
    expect(capa.canvas.zones.subtitle.y + capa.canvas.zones.subtitle.h).toBe(87);
    expect(capa.canvas.zones.title.y).toBe(42);
  });

  it('sem marca informada usa a assinatura do próprio preset', () => {
    const p = preset('viral_hype_dark');
    const [capa] = applySocialVisualComposition(cards(), { preset: p });
    expect(capa.canvas.zones.subtitle.y).toBe(80.5);
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
    expect(result[0].titleSize).toBe(SOCIAL_COMPOSITION_TYPOGRAPHY['cover-photo'].titleSize);
    expect(result[1]).toBe(manual);
  });

  it('sem nada a restaurar devolve o mesmo array', () => {
    const slides = gerados();
    expect(restoreSocialCompositionTypography(slides)).toBe(slides);
    const legado = [{ id: 'x', titleSize: 100, subSize: 100, bodyAfterSize: 100 }];
    expect(restoreSocialCompositionTypography(legado)).toBe(legado);
  });
});

// Conferência visual de 18/11/2026: título pequeno (69 px num card de 1080),
// título e apoio em ilhas separadas por um vão fixo, sombra dura e véu cinza
// sobre a foto inteira. A versão 3 agrupa o bloco de texto e sobe a escala.
describe('composição social v3 — bloco agrupado e escala tipográfica', () => {
  const pxTitulo = (slide) => 0.084 * slide.titleSize;
  const pxApoio = (slide) => 0.028 * slide.subSize;

  it.each(SOCIAIS.map((p) => [p.id, p]))('%s: título encosta no apoio e os dois crescem a partir da mesma linha', (_, preset) => {
    const brand = applyVisualPreset(MARCAS.completa, preset.id);
    for (const slide of applySocialVisualComposition(cards(), { preset, brand, formato: 'carrossel' })) {
      const { title, subtitle } = slide.canvas.zones;
      expect(subtitle.y - fim(title)).toBeGreaterThanOrEqual(0);
      expect(subtitle.y - fim(title)).toBeLessThanOrEqual(2);
      // Título ancorado embaixo da sua caixa, apoio em cima: sem vão entre eles.
      expect(slide.socialZoneAnchors).toEqual({ title: 'end', subtitle: 'start' });
      expect(slide.socialCompositionVersion).toBe(3);
    }
  });

  it('o título domina: pelo menos 2,8× o apoio fora da coluna estreita', () => {
    const preset = SOCIAIS.find((p) => p.id === 'viral_hype_dark');
    const brand = applyVisualPreset(MARCAS.completa, preset.id);
    for (const slide of applySocialVisualComposition(cards(), { preset, brand, formato: 'carrossel' })) {
      expect(pxTitulo(slide) / pxApoio(slide)).toBeGreaterThanOrEqual(2.8);
      expect(slide.titleLeading).toBeLessThanOrEqual(106);
    }
  });

  it('na coluna ao lado da foto o título ainda passa de 2× o apoio', () => {
    const preset = SOCIAIS.find((p) => p.id === 'editorial_magazine');
    const brand = applyVisualPreset(MARCAS.completa, preset.id);
    const coluna = applySocialVisualComposition(cards(), { preset, brand, formato: 'carrossel' })
      .filter((s) => s.socialComposition === 'portrait-editorial');
    expect(coluna.length).toBeGreaterThan(0);
    for (const slide of coluna) expect(pxTitulo(slide) / pxApoio(slide)).toBeGreaterThanOrEqual(2);
  });

  it('capa: degradê só atrás do texto, sem sombra dura; seta de arrastar só na capa', () => {
    const preset = SOCIAIS.find((p) => p.id === 'viral_hype_dark');
    const brand = applyVisualPreset(MARCAS.completa, preset.id);
    const [capa, ...resto] = applySocialVisualComposition(cards(), { preset, brand, formato: 'carrossel' });
    expect(capa.socialComposition).toBe('cover-photo');
    expect(capa.overlayMode).toBe('scrim');
    expect(capa.textShadow).toBe(false);
    expect(capa.showSwipeCue).toBe(true);
    for (const slide of resto) expect(slide.showSwipeCue).toBe(false);
  });

  it('foto no topo com cabeçalho do padrão recebe escurecimento só na faixa do cabeçalho', () => {
    const preset = SOCIAIS.find((p) => p.id === 'bold_promo_rosa');
    const brand = applyVisualPreset(MARCAS.completa, preset.id);
    const miolo = applySocialVisualComposition(cards(), { preset, brand, formato: 'carrossel' })
      .find((s) => s.socialComposition === 'photo-story');
    expect(miolo.overlayMode).toBe('top');
    expect(miolo.overlay).toBeGreaterThan(0);
    const semCabecalho = applySocialVisualComposition(cards(), {
      preset, formato: 'carrossel',
      brand: { ...brand, cultureHeaderLeft: '', cultureHeaderCenter: '', cultureHeaderYear: '', showPageBadge: false },
    }).find((s) => s.socialComposition === 'photo-story');
    expect(semCabecalho.overlay).toBe(0);
  });

  it('capa: a caixa do apoio cresce com o texto e nunca passa de 14%', () => {
    const preset = SOCIAIS.find((p) => p.id === 'viral_hype_dark');
    const brand = applyVisualPreset(MARCAS.vazia, preset.id);
    const altura = (apoio) => applySocialVisualComposition(cards(apoio), { preset, brand: { ...brand, footerPillText: '' }, formato: 'carrossel' })[0].canvas.zones.subtitle;
    const curta = altura('Apoio curto.');
    const media = altura('Um apoio de tamanho médio, com duas linhas no card, para ver a base do texto junto do rodapé.');
    const longa = altura('x'.repeat(600));
    expect(curta.h).toBe(5.5);
    expect(media.h).toBeGreaterThan(curta.h);
    expect(longa.h).toBe(14);
    // A base da caixa não muda: o bloco cresce para cima.
    for (const z of [curta, media, longa]) expect(z.y + z.h).toBe(91);
  });
});

// Uso real de 18/11/2026 (projeto em Stories, Mood Sépia): depois de gerar, a
// pessoa aplicou um padrão a todos os cards. O app zerava a composição e
// voltava ao layout clássico, mas os cards guardavam "sem véu e sem sombra" da
// composição: título creme direto sobre a foto, ilegível.
describe('trocar o padrão num projeto já gerado', () => {
  const comFoto = (slides) => slides.map((s, i) => (i === 2 ? s : { ...s, bgImageId: `img-${i}` }));
  const gerar = (id, formato = 'stories') => {
    const preset = SOCIAIS.find((p) => p.id === id);
    const brand = applyVisualPreset(MARCAS.completa, preset.id);
    return comFoto(applySocialVisualComposition(cards(), { preset, brand, formato }));
  };

  it('outro padrão do Moont recompõe os cards em vez de voltar ao layout clássico', () => {
    const gerados = gerar('viral_hype_dark');
    const novo = SOCIAIS.find((p) => p.id === 'mood_sepia');
    const brand = applyVisualPreset(MARCAS.completa, novo.id);
    const result = restyleSocialSlides(gerados, { preset: novo, brand, formato: 'stories', overrides: getSlideOverridesForPreset(novo.id) });
    expect(result).toHaveLength(gerados.length);
    // Reaplicar um dos 12 estilos recompõe com a composição v4 do estilo novo
    // (projeto gerado antes continua v3 até a pessoa reaplicar).
    for (const slide of result) {
      expect(slide.canvas?.source).toBe('social-preset');
      expect(slide.socialVisualPresetId).toBe('mood_sepia');
      expect(slide.socialCompositionVersion).toBe(4);
      expect(slide.socialFamily).toBe('mood_sepia');
    }
    // Mood Sépia põe a foto em coluna larga no miolo (Stories: foto no topo).
    expect(result[1].socialComposition).toMatch(/^v4:vPhoto/);
  });

  it('padrão sem composição própria volta ao clássico com véu e sombra sobre a foto', () => {
    const gerados = gerar('viral_hype_dark');
    const personalizado = { id: 'custom_x', isCustom: true, slideDefaults: { layout: 'bc', align: 'center' } };
    const result = restyleSocialSlides(gerados, { preset: personalizado, brand: {}, formato: 'stories', overrides: { canvas: null, layout: 'bc', align: 'center', titleSize: 100 } });
    for (const slide of result) {
      expect(slide.canvas).toBeNull();
      expect(slide.socialComposition).toBeUndefined();
      expect(slide.socialZoneAnchors).toBeUndefined();
      expect(slide.overlayMode).toBeUndefined();
      if (slide.bgImageId) {
        expect(slide.overlay).toBeGreaterThanOrEqual(60);
        expect(slide.textShadow).toBe(true);
      }
    }
  });

  it('projeto que nunca teve composição só recebe o reset do padrão', () => {
    const manuais = [{ id: 'a', title: 'T', overlay: 20, textShadow: false, bgImageId: 'x' }];
    const novo = SOCIAIS.find((p) => p.id === 'mood_sepia');
    const result = restyleSocialSlides(manuais, { preset: novo, brand: {}, formato: 'carrossel', overrides: { layout: 'bc' } });
    expect(result).toEqual([{ id: 'a', title: 'T', overlay: 20, textShadow: false, bgImageId: 'x', layout: 'bc' }]);
  });
});
