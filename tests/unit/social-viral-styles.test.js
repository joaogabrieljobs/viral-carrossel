import { describe, it, expect } from 'vitest';
import { VISUAL_PRESETS, applyVisualPreset, getSlideOverridesForPreset } from '../../src/styles/visual-presets.jsx';
import { applySocialVisualComposition, restyleSocialSlides } from '../../src/utils/social-visual-composition.js';
import { VIRAL_STYLES, VIRAL_STYLE_KEYS, PILL_ROLE_VISIBLE } from '../../src/utils/social-viral-styles.js';
import { socialCardLayout, SOCIAL_FUNCTIONS } from '../../src/utils/social-families.js';
import { socialChromeTokens, socialChromeElements, socialGround, contrastRatio } from '../../src/utils/social-chrome.js';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';
import { footerChromeReservePct } from '../../src/utils/card-chrome.js';
import { resolvePresetChrome } from '../../src/utils/preset-tokens.js';

const FORMATOS = ['carrossel', 'quadrado', 'stories'];
const fim = (z) => z.y + z.h;
const cruza = (a, b) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;
const preset = (id) => VISUAL_PRESETS.find((p) => p.id === id);
const card = (title, subtitle = '', foto = false) => ({ id: title.slice(0, 14), title, subtitle, bodyAfterImage: '', imageQuery: foto ? 'cena' : '' });

// O mesmo conteúdo da página de render dos 12 estilos.
const sequencia = (carga = 'balanceado') => {
  const longoT = carga === 'longo' ? ' Uma mensagem mais longa para conferir as quebras e a hierarquia.' : '';
  const curto = carga === 'curto';
  return [
    card(`Ninguém lê o seu post inteiro${longoT}`, curto ? 'E tudo bem.' : 'E tudo bem. O primeiro card decide se existe o segundo.', true),
    card(`O polegar é mais rápido que a sua introdução${longoT}`, curto ? 'Abrir com contexto custa atenção.' : 'Abrir com contexto custa a atenção que a ideia principal precisaria.'),
    card(`Mostre a coisa${longoT}`, 'Uma imagem concreta segura mais que três adjetivos.', true),
    card('Corte a primeira frase.', ''),
    card(`Antes de publicar${longoT}`, '- Uma ideia por card\n- Título que se lê em um segundo\n- Final que diz o próximo passo'),
    card(`Escreva para quem chegou agora${longoT}`, curto ? 'Cada card se sustenta.' : 'Cada card precisa funcionar para quem caiu nele direto, sem ter visto o anterior.'),
    card(`Agora volte ao primeiro card${longoT}`, 'E pergunte se ele merece o segundo.', true),
  ];
};

/** Assinatura preenchida: cada {exemplo:TEXTO} do estilo digitado pela pessoa. */
function marcaPreenchida(id) {
  const brand = { ...applyVisualPreset({ name: 'Estúdio exemplo', handle: '@estudioexemplo' }, id) };
  for (const k of ['cultureHeaderLeft', 'cultureHeaderCenter', 'cultureHeaderYear', 'footerPillText', 'footerBarLeft', 'footerBarCenter', 'footerBarRight']) {
    if (typeof brand[k] === 'string') brand[k] = brand[k].replace(/\{exemplo:([^{}]*)\}/gi, '$1');
  }
  return brand;
}

describe('12 estilos — catálogo e identidade', () => {
  it('os 12 IDs não mudam, estão visíveis e cada um tem composição própria', () => {
    const ids = ['sports_editorial', 'case_study_neon', 'mood_sepia', 'bold_promo_rosa', 'reflexivo_cream', 'tabloid_keywords',
      'editorial_magazine', 'luxury_hybrid', 'viral_hype_dark', 'cinematic_hybrid', 'authority_black', 'minimal_clean'];
    expect(VIRAL_STYLE_KEYS).toEqual(ids);
    for (const id of ids) {
      const p = preset(id);
      expect(p, id).toBeTruthy();
      expect(p.hidden).toBeFalsy();
      expect(VIRAL_STYLES[id].presetId).toBe(id);
    }
  });

  it('não são o mesmo card com outra cor: arquétipos e dispositivos variam entre estilos', () => {
    const assinaturas = new Set(VIRAL_STYLE_KEYS.map((id) => {
      const s = VIRAL_STYLES[id];
      return JSON.stringify([s.devices, s.align, s.pick.photo, s.pick.opener, s.grounds, s.pillRole]);
    }));
    expect(assinaturas.size).toBe(12);
  });

  it('uma página usa só as duas fontes do estilo', () => {
    for (const id of VIRAL_STYLE_KEYS) {
      const b = preset(id).brand;
      expect(new Set([b.titleFont, b.bodyFont].filter(Boolean)).size).toBeLessThanOrEqual(2);
    }
  });
});

describe('12 estilos — geometria em todos os formatos, cargas e assinaturas', () => {
  const casos = [];
  for (const id of VIRAL_STYLE_KEYS) for (const formato of FORMATOS) for (const carga of ['curto', 'balanceado', 'longo']) for (const assinatura of [false, true]) casos.push([id, formato, carga, assinatura]);

  it.each(casos)('%s · %s · %s · assinatura %s', (id, formato, carga, assinatura) => {
    const p = preset(id);
    const brand = assinatura ? marcaPreenchida(id) : applyVisualPreset({ name: 'Estúdio exemplo', handle: '' }, id);
    const slides = applySocialVisualComposition(sequencia(carga), { preset: p, brand }).map((s) => slideForFormatDisplay(s, formato, {}, 'livre'));
    const base = 100 - footerChromeReservePct(resolvePresetChrome(brand), formato);
    for (const s of slides) {
      const { photo, title, subtitle } = s.canvas.zones;
      for (const z of [photo, title, subtitle]) {
        expect(z.x).toBeGreaterThanOrEqual(0); expect(z.y).toBeGreaterThanOrEqual(0);
        expect(z.x + z.w).toBeLessThanOrEqual(100.01); expect(fim(z)).toBeLessThanOrEqual(100.01);
        expect(z.h).toBeGreaterThan(0);
      }
      expect(fim(title)).toBeLessThanOrEqual(base + 0.01);
      expect(fim(subtitle)).toBeLessThanOrEqual(base + 0.01);
      expect(cruza(title, subtitle), `${s.socialArt.archetype} título×apoio`).toBe(false);
      if (!/Bleed/.test(s.socialArt.archetype) && photo.w > 2) {
        expect(cruza(photo, title), `${s.socialArt.archetype} foto×título`).toBe(false);
        expect(cruza(photo, subtitle), `${s.socialArt.archetype} foto×apoio`).toBe(false);
      }
      // Pisos de leitura (px num card de 1080): título dominante e apoio legível.
      const tituloPx = 0.084 * s.titleSize * 10.8; const apoioPx = 0.028 * s.subSize * 10.8;
      expect(apoioPx).toBeGreaterThanOrEqual(29.9);
      expect(tituloPx).toBeGreaterThanOrEqual(52);
      expect(tituloPx / apoioPx, `${s.socialArt.archetype} hierarquia`).toBeGreaterThanOrEqual(1.6);
      if (formato === 'stories') { expect(title.y).toBeGreaterThanOrEqual(13.99); expect(fim(subtitle)).toBeLessThanOrEqual(82.01); }
      // Entrelinha do título nunca abaixo da do estilo (acentos em caixa alta).
      expect(s.titleLeading).toBeGreaterThanOrEqual(p.brand.textTitleLeading);
      expect(s.socialCompositionVersion).toBe(4);
      expect(s.socialFamily).toBe(id);
    }
    if (carga !== 'longo') expect(slides.filter((s) => s.socialArt.density === 'over').map((s) => s.socialArt.archetype)).toEqual([]);
  });
});

describe('12 estilos — sequência viral', () => {
  it.each(VIRAL_STYLE_KEYS)('%s: afirmação curta vira pôster que ocupa o card', (id) => {
    const p = preset(id);
    const out = applySocialVisualComposition(sequencia(), { preset: p, brand: applyVisualPreset({}, id) });
    const afirmacao = out.find((s) => s.socialFunction === 'statement');
    expect(afirmacao.canvas.zones.title.h).toBeGreaterThanOrEqual(55);
    expect(0.084 * afirmacao.titleSize * 10.8).toBeGreaterThanOrEqual(110);
    // Geometrias diferentes dentro do mesmo estilo.
    expect(new Set(out.map((s) => s.socialArt.archetype)).size).toBeGreaterThanOrEqual(4);
  });

  it.each(VIRAL_STYLE_KEYS)('%s: miolo só de texto não deixa a metade de baixo vazia', (id) => {
    const out = applySocialVisualComposition(sequencia(), { preset: preset(id), brand: applyVisualPreset({}, id) });
    for (const s of out.filter((x) => ['opener', 'development', 'list'].includes(x.socialFunction))) {
      const { title, subtitle } = s.canvas.zones;
      const topo = title.y + (title.h - Math.min(title.h, s.socialArt.titleUsed ?? title.h)) * (s.socialZoneAnchors?.title === 'end' ? 1 : 0);
      const baseTexto = subtitle.y + Math.min(subtitle.h, 30);
      const centro = (topo + baseTexto) / 2;
      expect(centro, `${s.socialArt.archetype}`).toBeGreaterThanOrEqual(26);
      expect(centro).toBeLessThanOrEqual(70);
    }
  });

  it('selo com papel na sequência: arrastar não aparece no fechamento; CTA só no fechamento', () => {
    expect(PILL_ROLE_VISIBLE.swipe('closing')).toBe(false);
    expect(PILL_ROLE_VISIBLE.swipe('cover')).toBe(true);
    expect(PILL_ROLE_VISIBLE.cta('opener')).toBe(false);
    expect(PILL_ROLE_VISIBLE.cta('closing')).toBe(true);
    const hype = applySocialVisualComposition(sequencia(), { preset: preset('viral_hype_dark'), brand: applyVisualPreset({}, 'viral_hype_dark') });
    expect(hype.map((s) => s.hideFooterPill)).toEqual([false, false, false, false, false, false, true]);
    // CTA do Case Study preenchido pela pessoa ("VEJA O CASO COMPLETO"): só no fechamento.
    const caso = applySocialVisualComposition(sequencia(), { preset: preset('case_study_neon'), brand: marcaPreenchida('case_study_neon') });
    expect(caso.map((s) => s.hideFooterPill)).toEqual([true, true, true, true, true, true, false]);
    // O papel vem do texto do selo: hashtag é etiqueta (capa e fechamento).
    const mood = applySocialVisualComposition(sequencia(), { preset: preset('mood_sepia'), brand: { ...applyVisualPreset({}, 'mood_sepia'), footerPillText: '#padaria' } });
    expect(mood.map((s) => s.hideFooterPill)).toEqual([false, true, true, true, true, true, false]);
  });

  it('seta de arraste da capa só em estilo sem selo de arrastar', () => {
    const hype = applySocialVisualComposition(sequencia(), { preset: preset('viral_hype_dark'), brand: applyVisualPreset({}, 'viral_hype_dark') });
    expect(hype[0].showSwipeCue).toBe(false);
    const sports = applySocialVisualComposition(sequencia(), { preset: preset('sports_editorial'), brand: applyVisualPreset({}, 'sports_editorial') });
    expect(sports.map((s) => s.showSwipeCue)).toEqual([true, false, false, false, false, false, false]);
  });
});

describe('12 estilos — cor-assinatura e contraste', () => {
  it.each(VIRAL_STYLE_KEYS)('%s: chão de cor da afirmação mantém contraste ≥ 4,5', (id) => {
    const brand = applyVisualPreset({}, id);
    const out = applySocialVisualComposition(sequencia(), { preset: preset(id), brand });
    for (const s of out) {
      if (s.customBg) expect(contrastRatio(s.customBg, s.titleColor)).toBeGreaterThanOrEqual(4.5);
      // Card de chão normal não grava cor de título: vale a cor-assinatura do estilo.
      else expect(s.titleColor).toBeUndefined();
    }
  });

  it('chãos usados pelos estilos têm tinta legível', () => {
    for (const id of VIRAL_STYLE_KEYS) {
      const brand = applyVisualPreset({}, id);
      for (const g of new Set(['bg', ...Object.values(VIRAL_STYLES[id].grounds)])) {
        const inks = socialGround(brand, g);
        expect(contrastRatio(inks.bg, inks.ink), `${id} ${g}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('título em cor-assinatura escura sobre foto ganha proteção mais densa', () => {
    const cine = applySocialVisualComposition(sequencia(), { preset: preset('cinematic_hybrid'), brand: applyVisualPreset({}, 'cinematic_hybrid') });
    const sports = applySocialVisualComposition(sequencia(), { preset: preset('sports_editorial'), brand: applyVisualPreset({}, 'sports_editorial') });
    expect(cine[0].overlay).toBeGreaterThan(sports[0].overlay);
    expect(cine[0].overlayMode).toBe('scrim');
  });
});

describe('12 estilos — apoio, ornamentos e texto de amostra', () => {
  it('Editorial Magazine: parágrafo longo sai da caixa alta; linha curta mantém', () => {
    const out = applySocialVisualComposition(sequencia(), { preset: preset('editorial_magazine'), brand: applyVisualPreset({}, 'editorial_magazine') });
    expect(out[1].subtitleCase).toBe('normal');
    expect(out[6].subtitleCase).toBeUndefined();
  });

  it('sem itálico falso: Luxury e Cinematic usam Inter/Inter Tight, sem face itálica', () => {
    for (const id of ['luxury_hybrid', 'cinematic_hybrid']) {
      const out = applySocialVisualComposition(sequencia(), { preset: preset(id), brand: applyVisualPreset({}, id) });
      for (const s of out) expect(s.subtitleItalic).toBe(false);
    }
  });

  it('texto de amostra do preset nunca é impresso; o escrito pela pessoa é', () => {
    const amostra = { ...getSlideOverridesForPreset('bold_promo_rosa'), ...getSlideOverridesForPreset('case_study_neon') };
    const t0 = socialChromeTokens({}, { slide: { eyebrowText: amostra.eyebrowText, strikethroughText: 'DE R$00', afterTitleText: 'POR R$00 (SUA OFERTA)' } });
    expect(t0.eyebrow).toBe(''); expect(t0.oferta).toBe('');
    const t1 = socialChromeTokens({}, { slide: { eyebrowText: 'Caso da padaria', strikethroughText: 'De R$ 120', afterTitleText: 'por R$ 90' } });
    expect(t1.eyebrow).toBe('Caso da padaria'); expect(t1.oferta).toBe('De R$ 120  por R$ 90');
    // A etiqueta de oferta só é desenhada com oferta escrita.
    const art = { chrome: socialCardLayout('bold_promo_rosa', 'cover', { photo: true }).chrome, ground: 'bg' };
    const sem = socialChromeElements(art, { frame: { w: 1080, h: 1350 }, brand: applyVisualPreset({}, 'bold_promo_rosa'), tokens: t0 });
    const com = socialChromeElements(art, { frame: { w: 1080, h: 1350 }, brand: applyVisualPreset({}, 'bold_promo_rosa'), tokens: t1 });
    expect(com.length - sem.length).toBe(2);
    expect(com.some((e) => e.text === 'De R$ 120  por R$ 90')).toBe(true);
  });

  it('estrela neon do Case Study aparece na capa, na afirmação e no fechamento', () => {
    const out = applySocialVisualComposition(sequencia(), { preset: preset('case_study_neon'), brand: applyVisualPreset({}, 'case_study_neon') });
    for (const s of out) expect(s.socialArt.chrome.some((d) => d.t === 'star'), s.socialFunction).toBe(['cover', 'statement', 'closing'].includes(s.socialFunction));
  });
});

describe('12 estilos — formatos recompostos e troca de estilo', () => {
  it.each(VIRAL_STYLE_KEYS)('%s: Quadrado e Stories têm geometria própria, não o Feed reduzido', (id) => {
    const out = applySocialVisualComposition(sequencia(), { preset: preset(id), brand: applyVisualPreset({}, id) });
    for (const formato of ['quadrado', 'stories']) {
      const diferentes = out.filter((s) => JSON.stringify(slideForFormatDisplay(s, formato, {}, 'livre').canvas.zones) !== JSON.stringify(s.canvas.zones));
      expect(diferentes.length, formato).toBeGreaterThanOrEqual(5);
    }
  });

  it('trocar de estilo preserva texto, foto e a escolha feita card a card', () => {
    const src = sequencia();
    src[3] = { ...src[3], visualPresetId: 'minimal_clean', socialCompositionVersion: 4 };
    const comp = applySocialVisualComposition(src, { preset: preset('sports_editorial'), brand: applyVisualPreset({}, 'sports_editorial') });
    const novo = restyleSocialSlides(comp, { preset: preset('tabloid_keywords'), brand: applyVisualPreset({}, 'tabloid_keywords'), overrides: getSlideOverridesForPreset('tabloid_keywords') });
    novo.forEach((s, i) => { expect(s.title).toBe(src[i].title); expect(s.subtitle).toBe(src[i].subtitle); expect(s.imageQuery).toBe(src[i].imageQuery); });
    expect(novo[0].socialFamily).toBe('tabloid_keywords');
  });

  it('identidade própria (cor e fonte da marca) também recebe a composição do estilo', () => {
    const marca = { bg: '#101820', titleColor: '#F2AA4C', subtitleColor: '#F4F1EA', textColor: '#C9C4B8', accent: '#F2AA4C', titleFont: '"Space Grotesk", sans-serif', bodyFont: '"Inter", sans-serif' };
    const out = applySocialVisualComposition(sequencia(), { preset: preset('viral_hype_dark'), brand: marca });
    expect(out.every((s) => s.socialFamily === 'viral_hype_dark' && s.socialCompositionVersion === 4)).toBe(true);
    const afirmacao = out.find((s) => s.socialFunction === 'statement');
    expect(contrastRatio(afirmacao.customBg, afirmacao.titleColor)).toBeGreaterThanOrEqual(4.5);
  });
});
