import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { VISUAL_PRESETS, SOCIAL_FAMILY_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import { applySocialVisualComposition } from '../../src/utils/social-visual-composition.js';
import { socialChromeElements, socialChromeTokens } from '../../src/utils/social-chrome.js';
import { chromeElements, chromeTokensForSlide } from '../../src/utils/presentation-chrome.js';
import { applyPresentationVisualPreset, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { resolveRequestedContentLanguage } from '../../src/utils/generation-prompts.js';
import { SOCIAL_FAMILY_KEYS, socialCardLayout } from '../../src/utils/social-families.js';
import { VIRAL_STYLES } from '../../src/utils/social-viral-styles.js';
import { FAMILY_KEYS, PAGE_KINDS, familyLayout } from '../../src/utils/presentation-families.js';
import { localizeFixedLabel, localizeLabelTemplate } from '../../src/utils/fixed-labels.js';

// QA 24/11 (deck A): rótulos fixos do desenho ("ARRASTA PRO LADO", "CENA 02",
// "§02 · CONTEXTO") saíam em português em carrossel e apresentação escritos em
// inglês ou espanhol. Seguem o idioma do conteúdo, pelo mesmo detector do
// rótulo "Passo N" (B4). O que a pessoa digitou nunca é traduzido.
const TEXTOS = {
  en: [
    ['The bakery that opened its kitchen', 'What used to stay behind the counter became the best ad for the house.'],
    ['For years, the counter hid the work', 'The bread arrived ready at the window and nobody saw how it was made, or why it took so long.'],
    ['The dough rests in plain view', 'The window became part of the shop, and the line now starts before the oven is on.'],
    ['What changed in the routine', '1. Open the kitchen wall.\n2. Bake in front of the line.\n3. Tell what goes into each loaf.'],
    ['An open kitchen is a shop window', ''],
    ['Save this for your next visit', 'Come and watch the first batch with us this Saturday.'],
  ],
  es: [
    ['La panadería que abrió la cocina', 'Lo que antes quedaba detrás del mostrador se volvió la mejor publicidad de la casa.'],
    ['Durante años, el mostrador escondía el trabajo', 'El pan llegaba listo a la vitrina y nadie veía cómo se hacía, ni por qué tardaba tanto.'],
    ['La masa descansa a la vista', 'La ventana se volvió parte de la tienda y la fila empieza antes de que el horno se encienda.'],
    ['Lo que cambió en la rutina', '1. Abrir la pared de la cocina.\n2. Hornear frente a la fila.\n3. Contar lo que lleva cada pan.'],
    ['Una cocina abierta es una vitrina', ''],
    ['Guarda esto para tu próxima visita', 'Ven a ver la primera hornada con nosotros este sábado.'],
  ],
  pt: [
    ['A padaria que abriu a cozinha', 'O que antes ficava atrás do balcão virou a melhor propaganda da casa.'],
    ['Durante anos, o balcão escondia o trabalho', 'O pão chegava pronto à vitrine e ninguém via como era feito, nem por que demorava tanto.'],
    ['A massa descansa à vista', 'A janela virou parte da loja, e a fila agora começa antes de o forno acender.'],
    ['O que mudou na rotina', '1. Abrir a parede da cozinha.\n2. Assar na frente da fila.\n3. Contar o que vai em cada pão.'],
    ['Uma cozinha aberta é uma vitrine', ''],
    ['Salve para a sua próxima visita', 'Venha ver a primeira fornada com a gente neste sábado.'],
  ],
};
const LANG = { en: 'en', es: 'es', pt: 'pt-BR' };
const PRESETS = [...VISUAL_PRESETS, ...SOCIAL_FAMILY_PRESETS];
const FRAME = { w: 1080, h: 1350 };

function carrossel(presetId, lang, brandExtra = {}) {
  const preset = PRESETS.find((p) => p.id === presetId);
  const brand = { ...applyVisualPreset({ ...DEFAULT_BRAND, name: 'Padaria Aurora', handle: '', showHandle: false }, preset.id), ...brandExtra };
  const cards = TEXTOS[lang].map(([title, subtitle], i) => ({ ...mkSlide(i + 1, brand), id: `c${i + 1}`, title, subtitle, imageQuery: '' }));
  return { brand, slides: applySocialVisualComposition(cards, { preset, brand }) };
}
const rotulosSociais = ({ slides, brand }, lang) => slides.map((slide, index) => socialChromeElements(slide.socialArt, {
  frame: FRAME, brand, lang, tokens: socialChromeTokens(brand, { index, total: slides.length, slide }), fonts: { title: 'Oswald', body: 'Inter' },
}).filter((item) => item.text).map((item) => item.text).join(' | '));

describe('QA 24/11 deck A: rótulos fixos no idioma do conteúdo', () => {
  it('o idioma dos rótulos vem do detector do "Passo N" (B4), lendo o texto dos cards', async () => {
    const { contentLabelLanguage } = await import('../../src/utils/content-label-language.js');
    for (const [key, code] of Object.entries(LANG)) {
      const slides = TEXTOS[key].map(([title, subtitle]) => ({ title, subtitle }));
      expect(contentLabelLanguage(slides), key).toBe(code);
      expect(contentLabelLanguage(slides), key).toBe(resolveRequestedContentLanguage({ content: slides.map((s) => `${s.title}\n${s.subtitle}`).join('\n') }).code);
    }
    // Sem texto suficiente para decidir, vale o padrão do projeto (português).
    expect(contentLabelLanguage([{ title: 'Obrigado' }])).toBe('pt-BR');
    expect(contentLabelLanguage([])).toBe('pt-BR');
    expect(contentLabelLanguage(null)).toBe('pt-BR');
  });

  it('Cinema (carrossel): "CENA 02" vira "SCENE 02" em inglês e "ESCENA 02" em espanhol', () => {
    expect(rotulosSociais(carrossel('social_cinema', 'en'), 'en')[1]).toBe('SCENE 02');
    expect(rotulosSociais(carrossel('social_cinema', 'es'), 'es')[1]).toBe('ESCENA 02');
    expect(rotulosSociais(carrossel('social_cinema', 'pt'), 'pt-BR')[1]).toBe('CENA 02');
    // Sem idioma informado (projeto antigo, miniatura) continua em português.
    expect(rotulosSociais(carrossel('social_cinema', 'pt'))[1]).toBe('CENA 02');
  });

  it('Ficha técnica: o rótulo de cada função segue o idioma', () => {
    const en = rotulosSociais(carrossel('social_ficha', 'en'), 'en');
    expect(en.slice(1)).toEqual(['§02 · CONTEXT', '§03 · POINT', '§04 · STEPS', '§05 · THESIS', '§06 · CLOSING']);
    const es = rotulosSociais(carrossel('social_ficha', 'es'), 'es');
    expect(es.slice(1)).toEqual(['§02 · CONTEXTO', '§03 · PUNTO', '§04 · PASOS', '§05 · TESIS', '§06 · CIERRE']);
    const pt = rotulosSociais(carrossel('social_ficha', 'pt'), 'pt-BR');
    expect(pt.slice(1)).toEqual(['§02 · CONTEXTO', '§03 · PONTO', '§04 · ETAPAS', '§05 · TESE', '§06 · FECHO']);
  });

  it('o nome da marca e o que a pessoa escreveu nunca são traduzidos, mesmo iguais a um rótulo', () => {
    // Marca chamada "CENA" entra pelo token {marca?} da capa da Ficha.
    const ficha = carrossel('social_ficha', 'en', { name: 'CENA' });
    expect(rotulosSociais(ficha, 'en')[0]).toBe('§01 · CENA');
  });

  it('Cinemático (apresentação): "CENA 01" segue o idioma do conteúdo', () => {
    const preset = 'presentation_cinematic';
    const brand = applyPresentationVisualPreset({ ...DEFAULT_BRAND, showHandle: false, logo: null }, preset);
    const base = { ...mkSlide(1, brand), title: 'The bakery that opened its kitchen', subtitle: 'A study.', presentationPlan: { visualRole: 'cover' } };
    const slide = { ...base, ...getPresentationCompositionOverrides(preset, { slide: base, stage: { visualRole: 'cover' }, index: 0, count: 4 }) };
    const textos = (lang) => chromeElements(slide.presentationChrome, { frame: { w: 1920, h: 1080 }, lang, tokens: chromeTokensForSlide(slide, { index: 0, total: 4 }) })
      .filter((item) => item.text).map((item) => item.text);
    expect(textos('en')).toEqual(['SCENE 01']);
    expect(textos('es')).toEqual(['ESCENA 01']);
    expect(textos('pt-BR')).toEqual(['CENA 01']);
    expect(textos(undefined)).toEqual(['CENA 01']);
  });

  it('todo rótulo com palavras que uma família desenha tem tradução (carrossel e apresentação)', () => {
    const moldes = new Set();
    const guardar = (chrome) => (chrome || []).filter((d) => d.t === 'text' || d.t === 'pill').forEach((d) => moldes.add(d.text));
    for (const family of [...SOCIAL_FAMILY_KEYS, ...Object.keys(VIRAL_STYLES)]) {
      for (const fn of ['cover', 'opener', 'development', 'photo', 'statement', 'list', 'comparison', 'closing']) {
        for (const formato of ['carrossel', 'quadrado', 'stories']) for (const photo of [false, true]) for (const variant of [0, 1]) {
          guardar(socialCardLayout(family, fn, { formato, photo, variant, structured: fn === 'comparison' }).chrome);
        }
      }
    }
    for (const family of FAMILY_KEYS) for (const kind of PAGE_KINDS) for (const format of ['16:9', '4:5', '1:1', '9:16']) for (const photo of [false, true]) {
      guardar(familyLayout(family, kind, { format, photo }).chrome);
      guardar(familyLayout(family, kind, { format, photo, structured: true }).chrome);
    }
    const comPalavra = [...moldes].filter((molde) => /\p{L}{2,}/u.test(molde.replace(/\{\w+\??\}/g, '')));
    // Rótulo novo numa família cai aqui: ou ganha tradução em fixed-labels.js, ou entra como abreviação neutra.
    expect(comPalavra.sort()).toEqual(['CENA {index}', 'CENA {n}', 'FIG. 0{index}', 'FIG. {index}', 'FIM · {index}', 'NOTA', 'TAB. {index}',
      '§{n} · COMPARAÇÃO', '§{n} · CONTEXTO', '§{n} · ETAPAS', '§{n} · FECHO', '§{n} · FIGURA', '§{n} · PONTO', '§{n} · TESE']);
    // "FIG." e "TAB." são abreviações que valem em português, inglês e espanhol.
    const neutro = /^(FIG|TAB)\. /;
    for (const molde of comPalavra.filter((item) => neutro.test(item))) expect(localizeLabelTemplate(molde, 'en'), molde).toBe(molde);
    for (const molde of comPalavra.filter((item) => !neutro.test(item))) {
      expect(localizeLabelTemplate(molde, 'en'), molde).not.toBe(molde);
      expect(localizeLabelTemplate(molde, 'es'), molde).toMatch(/ESCENA|CONTEXTO|PUNTO|FIGURA|TESIS|PASOS|COMPARACIÓN|CIERRE|FIN|NOTA/);
      expect(localizeLabelTemplate(molde, 'pt-BR'), molde).toBe(molde);
      expect(localizeLabelTemplate(molde, undefined), molde).toBe(molde);
    }
  });

  it('a troca vale para o rótulo inteiro, nunca para um pedaço de palavra', () => {
    expect(localizeLabelTemplate('CENAS {n}', 'en')).toBe('CENAS {n}');
    expect(localizeLabelTemplate('{kicker} · CENA {index}', 'en')).toBe('{kicker} · SCENE {index}');
    expect(localizeLabelTemplate('FIM · {index}', 'en')).toBe('END · {index}');
    expect(localizeLabelTemplate('FIM · {index}', 'es')).toBe('FIN · {index}');
    expect(localizeLabelTemplate('NOTA', 'en')).toBe('NOTE');
    expect(localizeFixedLabel('ARRASTA PRO LADO', 'en')).toBe('SWIPE');
    expect(localizeFixedLabel('ARRASTA PRO LADO', 'es')).toBe('DESLIZA');
    expect(localizeFixedLabel('ARRASTA PRO LADO', 'pt-BR')).toBe('ARRASTA PRO LADO');
    expect(localizeFixedLabel('ARRASTA PRO LADO →', 'en')).toBe('ARRASTA PRO LADO →');
    expect(localizeFixedLabel('toString', 'en')).toBe('toString');
    expect(localizeFixedLabel('', 'en')).toBe('');
    expect(localizeFixedLabel(undefined, 'en')).toBe(undefined);
  });

  describe('selo "ARRASTA PRO LADO" do Viral Hype Dark, no card de verdade', () => {
    const render = async ({ slides, brand }, lang, index = 0, forExport = false) => {
      const { ContentLabelLanguageContext } = await import('../../src/utils/content-label-language.js');
      const card = React.createElement(SlideCardInner, { slide: slides[index], brand, fmt: 'carrossel', creativePreset: 'livre', num: index + 1, total: slides.length, forExport });
      return renderToStaticMarkup(lang ? React.createElement(ContentLabelLanguageContext.Provider, { value: lang }, card) : card);
    };

    it('inglês: "SWIPE" na capa e no card interno, na prévia e na exportação', async () => {
      const deck = carrossel('viral_hype_dark', 'en');
      for (const index of [0, 1]) for (const forExport of [false, true]) {
        const html = await render(deck, 'en', index, forExport);
        expect(html, `card ${index + 1}`).toContain('SWIPE');
        expect(html, `card ${index + 1}`).not.toContain('ARRASTA PRO LADO');
      }
    });

    it('espanhol: "DESLIZA"', async () => {
      const html = await render(carrossel('viral_hype_dark', 'es'), 'es');
      expect(html).toContain('DESLIZA');
      expect(html).not.toContain('ARRASTA PRO LADO');
    });

    it('português (e card sem idioma informado) continua "ARRASTA PRO LADO"', async () => {
      expect(await render(carrossel('viral_hype_dark', 'pt'), 'pt-BR')).toContain('ARRASTA PRO LADO');
      expect(await render(carrossel('viral_hype_dark', 'pt'), null)).toContain('ARRASTA PRO LADO');
    });

    it('selo digitado pela pessoa fica como ela escreveu, em qualquer idioma', async () => {
      for (const typed of ['ARRASTA PRA VER', 'Arrasta pro lado', 'ARRASTA PRO LADO E SALVA']) {
        const html = await render(carrossel('viral_hype_dark', 'en', { footerPillText: typed }), 'en');
        expect(html, typed).toContain(typed);
        expect(html, typed).not.toContain('SWIPE');
      }
    });
  });
});
