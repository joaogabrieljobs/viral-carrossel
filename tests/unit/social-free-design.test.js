import { describe, expect, it } from 'vitest';
import {
  SOCIAL_FREE_PRESET_ID, SOCIAL_FREE_FAMILY_KEYS, SOCIAL_FREE_LAYOUT_KEYS,
  isFreeSocialPreset, isFreeSocialSlide, normalizeSocialFreeDesign,
  applyFreeSocialDesign, socialFreeDeckViolations, socialFreePhotoPatch,
} from '../../src/utils/social-free-design.js';
import { applySocialVisualComposition, restyleSocialSlides, socialFormatPatch } from '../../src/utils/social-visual-composition.js';
import { isFreePresentationPreset, slideSkipsImageGeneration } from '../../src/utils/free-design.js';
import { applyFormatEdit, slideForFormatDisplay } from '../../src/utils/format-view.js';
import { hasPresentationDesign } from '../../src/utils/presentation-format.js';
import { wcagContrast } from '../../src/utils/wcag.js';
import { footerChromeReservePct, STORIES_FOOTER_LIFT } from '../../src/utils/card-chrome.js';
import { resolvePresetChrome } from '../../src/utils/preset-tokens.js';
import { getTextFont } from '../../src/utils/card-text-fonts.js';
import { socialChromeElements, socialChromeTokens } from '../../src/utils/social-chrome.js';

const PRESET = { id: 'social_free', productKind: 'carrossel', isFree: true };
const FORMATS = ['carrossel', 'quadrado', 'stories'];
const SAFE = { carrossel: [8.5, 8.5], quadrado: [9, 9], stories: [14, 18] };
const DECK = {
  palette: { bg: '#242247', surface: '#36345B', ink: '#FFFFFF', muted: '#DDDFEB', accent: '#EA792C', accent2: '#55BFC4', inverse: '#F2EFED', inverseInk: '#242247' },
  fonts: { display: 'Inter Tight', text: 'Inter' }, mood: 'Composição editorial clara e próxima.',
};
const families = ['cinema', 'editorial', 'revista', 'ficha', 'swiss', 'documental', 'poster', 'executive'];
const cards = () => families.map((family, index) => ({
  id: `c${index}`, num: index + 1,
  title: index === 0 ? 'Uma ideia para compartilhar' : index === 7 ? 'Converse com a nossa equipe' : `Uma ideia no card ${index + 1}`,
  subtitle: index === 7 ? 'Envie uma mensagem para conhecer a proposta.' : 'Uma explicação concreta, com espaço para o leitor acompanhar.',
  bodyAfterImage: '', eyebrow: index ? 'A PROPOSTA' : '',
  imageQuery: [0, 2, 5].includes(index) ? 'An original scene, no lettering.' : '',
  visualBible: { identity: 'A mesma pessoa descrita no briefing.' }, personAnchor: 'anchor-asset',
}));
const plan = () => ({
  version: 1, kind: 'social_free', deckDesign: DECK,
  visualDirection: { palette: [{ role: 'base', hex: '#242247' }, { role: 'subject_light', hex: '#EA792C' }, { role: 'graphic', hex: '#55BFC4' }], graphics: 'One thin geometric outline.', finish: 'Smooth flat finish.', avoid: 'Text baked into the image.' },
  cards: families.map((family, index) => ({ index, role: index === 0 ? 'hook' : index === 7 ? 'cta' : 'development', eyebrow: index ? 'A PROPOSTA' : '',
    scene: [0, 2, 5].includes(index) ? { subject: 'An adult from the supplied casting brief.', light: 'Soft directional light.' } : null,
    avoid: ['Lettering'], design: { family, ground: index === 0 ? 'photo' : [1, 7].includes(index) ? 'art' : index === 6 ? 'accent' : 'bg', photo: [0, 2, 5].includes(index) ? index === 0 ? 'full' : 'half' : 'none', block: 'none', emphasis: [], icons: [] },
  })),
});
const compose = (formato = 'carrossel', slides = cards(), extra = {}) => applyFreeSocialDesign(slides, { preset: PRESET, formato, deckDesign: DECK, plan: plan(), ...extra });
const overlap = (a, b) => a && b && Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) + 0.1 && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y) + 0.1;

describe('Livre social: ativação explícita e contrato próprio', () => {
  it('distingue Livre social de Livre apresentação e de estilos antigos', () => {
    expect(SOCIAL_FREE_PRESET_ID).toBe('social_free');
    expect(isFreeSocialPreset(PRESET)).toBe(true);
    expect(isFreeSocialPreset('social_free')).toBe(true);
    expect(isFreeSocialPreset({ isFree: true, productKind: 'apresentacao' })).toBe(false);
    expect(isFreePresentationPreset(PRESET)).toBe(false);
    expect(isFreePresentationPreset({ id: 'presentation_free', isFree: true })).toBe(true);
    expect(isFreeSocialPreset('social_revista')).toBe(false);
  });

  it('sem opt-in devolve os mesmos cards, sem campos ou recomposição', () => {
    const source = cards();
    expect(applyFreeSocialDesign(source, { preset: { id: 'social_revista' }, plan: plan() })).toBe(source);
    expect(applyFreeSocialDesign(source)).toBe(source);
  });

  it('normaliza os mesmos enums e aceita as 9 famílias sociais mais as 10 geometrias retrato', () => {
    expect(SOCIAL_FREE_FAMILY_KEYS).toHaveLength(19);
    expect(SOCIAL_FREE_LAYOUT_KEYS).toContain('coverBleed');
    expect(normalizeSocialFreeDesign({ family: 'revista', photo: 'sem', ground: 'arte', block: 'tabela', layout: 'compare' }))
      .toMatchObject({ family: 'revista', photo: 'none', ground: 'art', block: 'comparison', layout: 'compare' });
    expect(normalizeSocialFreeDesign({ family: 'swiss', photo: 'metade' })).toMatchObject({ family: 'swiss', photo: 'half' });
    expect(normalizeSocialFreeDesign({ family: 'inventada', layout: 'coordenadas-livres' }, { family: 'minimal' }).family).toBe('minimal');
  });

  it('o compositor social encaminha deck e plano só no preset livre', () => {
    const slides = applySocialVisualComposition(cards(), { preset: PRESET, formato: 'carrossel', deckDesign: DECK, plan: plan() });
    expect(slides.every(isFreeSocialSlide)).toBe(true);
    for (const [index, slide] of slides.entries()) {
      expect(slide.socialDeckDesign.palette.bg).toBe(DECK.palette.bg);
      expect(slide.socialPlan.scene).toEqual(plan().cards[index].scene);
      expect(slide.socialPlan.visualDirection).toEqual(plan().visualDirection);
      expect(slide).not.toHaveProperty('presentationPresetId');
      expect(slide).not.toHaveProperty('presentationCompositionId');
      expect(hasPresentationDesign(slide, 'editorial')).toBe(false);
    }
  });
});

describe('Livre social: medidas reais de 1080 e sem perda de conteúdo', () => {
  it.each(FORMATS)('%s: texto, foto, ordem, âncora, zonas seguras e leitura preservados', (formato) => {
    const source = cards();
    const before = structuredClone(source);
    const slides = compose(formato, source);
    expect(source).toEqual(before);
    expect(slides.map(s => s.id)).toEqual(source.map(s => s.id));
    for (const [index, slide] of slides.entries()) {
      for (const key of ['title', 'subtitle', 'bodyAfterImage', 'imageQuery', 'visualBible', 'personAnchor']) expect(slide[key]).toEqual(source[index][key]);
      expect(slide.socialFreeDesign.family).toBe(families[index]);
      expect(slide.canvas.source).toBe('social-preset');
      expect(slide.socialArt.formato).toBe(formato);
      expect(slide.titleSize * 1080 * 0.084 / 100).toBeGreaterThanOrEqual(28);
      expect(slide.subSize * 1080 * 0.028 / 100).toBeGreaterThanOrEqual(28);
      expect(slide.bodyAfterSize * 1080 * 0.018 / 100).toBeGreaterThanOrEqual(28);
      for (const key of ['title', 'subtitle', 'evidence']) {
        const zone = slide.canvas.zones[key];
        if (!zone) continue;
        expect(zone.x).toBeGreaterThanOrEqual(0);
        expect(zone.x + zone.w).toBeLessThanOrEqual(100);
        expect(zone.y).toBeGreaterThanOrEqual(SAFE[formato][0] - 0.01);
        expect(zone.y + zone.h).toBeLessThanOrEqual(100 - SAFE[formato][1] + 0.01);
        expect(zone.h).toBeGreaterThan(0);
      }
      expect(overlap(slide.canvas.zones.title, slide.canvas.zones.subtitle)).toBe(false);
      for (const key of ['titleColor', 'subtitleColor', 'textColor']) {
        const bg = slide.socialFreeTextSurfaces?.[key === 'titleColor' ? 'title' : 'subtitle'] || slide.customBg;
        expect(wcagContrast(slide[key], bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(slides.map(s => s.showSwipeCue)).toEqual([true, false, false, false, false, false, false, false]);
    expect(slides[0].socialFunction).toBe('cover');
    expect(slides[7].socialFunction).toBe('closing');
    expect(slides.filter(s => s.socialFreeDesign.ground === 'art')).toHaveLength(2);
    expect(socialFreeDeckViolations(slides, { formato })).toEqual([]);
  });

  it('card sem foto não gera imagem, mas mídia persistida continua visível', () => {
    const source = cards();
    source[3] = { ...source[3], bgImage: 'blob:upload', bgImageId: 'img_upload', bgImageAssetId: 'asset_upload', bgImageSource: 'upload', photoFraming: 'manual', bgX: 28, bgZoom: 130 };
    const slides = compose('carrossel', source);
    expect(slideSkipsImageGeneration(slides[1])).toBe(true);
    expect(slideSkipsImageGeneration(slides[0])).toBe(false);
    expect(slides[3].socialFreeDesign.photo).not.toBe('none');
    expect(slides[3].presentationSuppressPhoto).not.toBe(true);
    expect(slides[3].canvas.zones.photo.w).toBeGreaterThan(2);
    for (const key of ['bgImage', 'bgImageId', 'bgImageAssetId', 'bgImageSource', 'photoFraming', 'bgX', 'bgZoom']) expect(slides[3][key]).toBe(source[3][key]);
    expect(slideSkipsImageGeneration({ imageQuery: '' })).toBe(false);
  });

  it('nunca três geometrias iguais, mesmo quando o roteiro repete o mesmo design', () => {
    const source = cards().map(s => ({ ...s, imageQuery: '' }));
    const repeated = plan();
    repeated.cards = repeated.cards.map(c => ({ ...c, design: { family: 'minimal', layout: 'devRule', ground: 'bg', photo: 'none', block: 'none' } }));
    const slides = compose('carrossel', source, { plan: repeated });
    expect(slides.every(isFreeSocialSlide)).toBe(true);
    expect(socialFreeDeckViolations(slides).filter(v => /rhythm/.test(v.code))).toEqual([]);
    expect(slides.some(s => s.socialFreeDesignOverride?.reason === 'rhythm_geometry')).toBe(true);
  });

  it('acusa título longo da capa sem encurtá-lo nem inventar CTA', () => {
    const source = cards();
    source[0].title = 'Uma frase original com mais de oito palavras que precisa de revisão';
    const slides = compose('carrossel', source);
    expect(slides[0].title).toBe(source[0].title);
    expect(slides[7].subtitle).toBe(source[7].subtitle);
    expect(socialFreeDeckViolations(slides).some(v => v.code === 'social_free_cover_words' && v.slideIndex === 0)).toBe(true);
  });

  it.each(FORMATS)('%s: reserva a logo e o rodapé sem reduzir o piso', (formato) => {
    const brand = { logo: 'blob:logo', logoPosition: 'tr', logoSize: 150, footerBarLeft: 'APOTEOSE', footerBarCenter: 'PROPOSTA', footerBarRight: '2026' };
    const slides = compose(formato, cards(), { brand });
    const footer = footerChromeReservePct(resolvePresetChrome(brand), formato);
    const bottom = Math.min(100 - SAFE[formato][1], 100 - footer - (formato === 'stories' && footer ? STORIES_FOOTER_LIFT * 100 : 0));
    const height = formato === 'stories' ? 1920 : formato === 'quadrado' ? 1080 : 1350;
    const logo = { x: (1080 - 1080 * 0.045 - 150) / 1080 * 100, y: 1080 * 0.045 / height * 100, w: 150 / 1080 * 100, h: 150 / height * 100 };
    for (const slide of slides) for (const key of ['title', 'subtitle', 'evidence']) {
      const zone = slide.canvas.zones[key];
      if (!zone) continue;
      expect(zone.y + zone.h).toBeLessThanOrEqual(bottom + 0.01);
      expect(overlap(zone, logo)).toBe(false);
    }
  });
});

describe('Livre social: escolhas manuais e vistas gravadas têm prioridade', () => {
  it('restyle protege estilo próprio, canvas manual e offsets antes dos overrides', () => {
    const source = cards();
    source[1] = { ...source[1], visualPresetId: 'meu-estilo', customBg: '#123456' };
    source[2] = { ...source[2], canvas: { enabled: true, userEdited: true, zones: { title: { x: 7, y: 20, w: 80, h: 20 } } } };
    source[3] = { ...source[3], elementOffsets: { title: { x: 9, y: 11 } } };
    const slides = restyleSocialSlides(source, { preset: PRESET, formato: 'carrossel', overrides: { canvas: null, elementOffsets: {}, customBg: null }, deckDesign: DECK, plan: plan() });
    for (const index of [1, 2, 3]) expect(slides[index]).toBe(source[index]);
    expect(isFreeSocialSlide(slides[0])).toBe(true);
  });

  it('vistas de formato usam zonas próprias e conservam a edição feita naquele formato', () => {
    const slides = compose();
    const slide = slides[2];
    const before = structuredClone(slide);
    const patch = socialFormatPatch(slide, 'stories');
    expect(patch.socialArt.formato).toBe('stories');
    expect(patch.canvas.zones).not.toEqual(slide.canvas.zones);
    const manual = { x: 11, y: 22, w: 72, h: 28 };
    const views = { stories: { slides: { [slide.id]: { titleSize: 82, canvas: { ...patch.canvas, userEdited: true, zones: { ...patch.canvas.zones, title: manual } } } } } };
    const displayed = slideForFormatDisplay(slide, 'stories', views, 'editorial');
    expect(displayed.titleSize).toBe(82);
    expect(displayed.canvas.zones.title).toEqual(manual);
    expect(slide).toEqual(before);
    expect(socialFormatPatch({ ...slide, canvas: { ...slide.canvas, userEdited: true } }, 'stories')).toEqual({});
  });

  it('não recompõe a mesma vista salva; abrir o Feed devolve o card original', () => {
    const slide = compose()[0];
    expect(socialFormatPatch(slide, 'carrossel')).toEqual({});
    expect(slideForFormatDisplay(slide, 'carrossel', {}, 'editorial')).toBe(slide);
  });

  it.each(['quadrado', 'stories'])('geração inicial em %s também ganha geometria de Feed ao trocar a vista', (formato) => {
    const slide = compose(formato)[2];
    const original = structuredClone(slide);
    const displayed = slideForFormatDisplay(slide, 'carrossel', {}, 'editorial');
    expect(displayed.socialArt.formato).toBe('carrossel');
    expect(displayed.canvas.zones).not.toEqual(slide.canvas.zones);
    expect(displayed.title).toBe(slide.title);
    expect(slide).toEqual(original);
    const edited = applyFormatEdit({ slides: [slide], fmt: 'carrossel', formatViews: {}, creativePreset: 'editorial' }, 0, { titleSize: 72 });
    expect(edited.slides[0]).toBe(slide);
    expect(slideForFormatDisplay(slide, 'carrossel', edited.formatViews, 'editorial').titleSize).toBe(72);
    expect(slideForFormatDisplay(slide, formato, edited.formatViews, 'editorial').titleSize).toBe(slide.titleSize);
  });

  it('upload explícito num card sem foto cria uma área visível e mantém contexto, texto e recorte', () => {
    const slide = { ...compose('stories')[1], bgImage: 'blob:upload', bgImageId: 'upload-tardio', bgImageSource: 'upload',
      photoFraming: 'manual', bgX: 21, bgY: 67, bgZoom: 120 };
    const before = structuredClone(slide);
    const next = { ...slide, ...socialFreePhotoPatch(slide) };
    expect(next.socialFreeDesign.photo).not.toBe('none');
    expect(next.socialFreeDesign.ground).not.toBe('art');
    expect(next.presentationSuppressPhoto).toBe(false);
    expect(next.canvas.zones.photo.w * next.canvas.zones.photo.h).toBeGreaterThan(400);
    expect(next.socialArt).toMatchObject({ formato: 'stories', index: 1, count: 8, fn: slide.socialArt.fn });
    for (const key of ['title', 'subtitle', 'eyebrowText', 'bgImage', 'bgImageId', 'bgImageSource', 'photoFraming', 'bgX', 'bgY', 'bgZoom']) expect(next[key]).toEqual(slide[key]);
    expect(slide).toEqual(before);
    expect(socialFreePhotoPatch({ title: 'Legado', bgImage: 'blob:upload' })).toEqual({});
  });

  it('upload em canvas manual revela a zona de foto escolhida sem refazer nenhum texto', () => {
    const base = compose()[1];
    const photo = { x: 74, y: 40, w: 18, h: 20 };
    const slide = { ...base, bgImage: 'blob:manual', canvas: { ...base.canvas, userEdited: true, zones: { ...base.canvas.zones, photo } },
      elementOffsets: { title: { x: 1, y: 2 } }, titleSize: 97 };
    const next = { ...slide, ...socialFreePhotoPatch(slide) };
    expect(next.presentationSuppressPhoto).toBe(false);
    expect(next.canvas).toEqual(slide.canvas);
    expect(next.titleSize).toBe(97);
    expect(next.elementOffsets).toBe(slide.elementOffsets);
  });

  it('upload em canvas manual sem slot usa o espaço livre sem deslocar as zonas editadas', () => {
    const base = compose()[1];
    const zones = { title: { x: 8, y: 18, w: 35, h: 25 }, subtitle: { x: 8, y: 48, w: 35, h: 25 }, photo: { x: 96, y: 94, w: 1, h: 1 } };
    const slide = { ...base, bgImage: 'blob:manual', canvas: { ...base.canvas, userEdited: true, zones }, elementOffsets: { title: { x: 2, y: 1 } } };
    const next = { ...slide, ...socialFreePhotoPatch(slide) };
    expect(next.presentationSuppressPhoto).toBe(false);
    expect(next.canvas.zones.title).toBe(zones.title);
    expect(next.canvas.zones.subtitle).toBe(zones.subtitle);
    expect(next.elementOffsets).toBe(slide.elementOffsets);
    expect(next.canvas.zones.photo.w * next.canvas.zones.photo.h).toBeGreaterThan(300);
    expect(overlap(next.canvas.zones.photo, { ...zones.title, x: 10, y: 19 })).toBe(false);
    expect(overlap(next.canvas.zones.photo, zones.subtitle)).toBe(false);
  });

  it('sem espaço livre, o upload vira fundo protegido sem mover texto, tamanho ou offsets manuais', () => {
    const base = compose()[1];
    const zones = { title: { x: 7.5, y: 8.5, w: 85, h: 35 }, subtitle: { x: 7.5, y: 43.5, w: 85, h: 48 }, photo: { x: 96, y: 94, w: 1, h: 1 } };
    const slide = { ...base, bgImage: 'blob:manual', canvas: { ...base.canvas, userEdited: true, zones }, titleSize: 91, subSize: 113 };
    const next = { ...slide, ...socialFreePhotoPatch(slide) };
    expect(next.canvas.zones.title).toBe(zones.title);
    expect(next.canvas.zones.subtitle).toBe(zones.subtitle);
    expect(next.canvas.zones.photo).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(next.canvas.userEdited).toBe(true);
    expect(next).toMatchObject({ titleSize: 91, subSize: 113, presentationSuppressPhoto: false, socialFreeDesign: { photo: 'full', ground: 'photo' } });
    expect(next.socialScrimMin).toBeGreaterThan(0);
    for (const key of ['titleColor', 'subtitleColor', 'textColor']) expect(wcagContrast(next[key], next.socialFreeTextSurfaces.title)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Livre social: geometria de blocos e tipografia vinculada ao deck', () => {
  const comparison = { type: 'comparison', variant: 'pairs', headers: ['A marca é', 'Sem ser'], rows: [
    ['Brasileira', 'sem caricatura'], ['Sofisticada', 'sem pretensão'], ['Irreverente', 'sem infantilidade'], ['Acolhedora', 'sem ser genérica'],
    ['Plural', 'sem dispersão'], ['Urbana', 'sem frieza'], ['Autoral', 'sem ser inacessível'],
  ] };
  const steps = { type: 'steps', items: [{ title: 'Hip-hop e funk', body: '' }, { title: 'Eletrônica e remixes', body: '' }, { title: 'Clássicos nacionais', body: 'Releituras para a pista.' }] };
  const blockCard = (formato, block, media = false) => {
    const source = cards();
    source[3] = { ...source[3], title: 'Uma identidade de contrastes', subtitle: '', bodyAfterImage: '', presentationBlocks: [block],
      ...(media ? { bgImage: 'blob:foto-enviada', bgImageId: 'img_enviada', bgImageSource: 'upload' } : {}) };
    const nextPlan = plan();
    nextPlan.cards[3].design = { family: 'swiss', ground: 'inverse', photo: 'none', block: block.type };
    return { source: source[3], slide: compose(formato, source, { plan: nextPlan })[3] };
  };

  it('usa a fonte do deck também no apoio e no chapéu, pelas chaves reais do renderer', () => {
    const slide = compose()[1];
    for (const key of ['subtitle', 'bodyAfterImage', 'eyebrow']) expect(getTextFont(slide, key, 'Wrong fallback')).toBe('"Inter", sans-serif');
  });

  it('chapéu fica acima da camada da foto cheia, sem ficar apenas presente no DOM', () => {
    const nextPlan = plan();
    nextPlan.cards[2].design = { family: 'cinematic', ground: 'photo', photo: 'full', block: 'none' };
    const slide = compose('carrossel', cards(), { plan: nextPlan })[2];
    const elements = socialChromeElements(slide.socialArt, { frame: { w: 1080, h: 1350 }, brand: {}, tokens: socialChromeTokens({}, { slide }) });
    const eyebrow = elements.find(item => item.text === slide.eyebrowText);
    expect(eyebrow).toBeDefined();
    expect(eyebrow.z).toBeGreaterThan(2);
  });

  it.each(FORMATS)('%s: lista e tabela de 7 pares permanecem inteiras e fora das caixas de texto', (formato) => {
    for (const block of [steps, comparison]) {
      const { source, slide } = blockCard(formato, block);
      const { title, subtitle, evidence } = slide.canvas.zones;
      expect(slide.presentationBlocks).toEqual(source.presentationBlocks);
      expect(overlap(title, evidence)).toBe(false);
      expect(overlap(subtitle, evidence)).toBe(false);
      expect(evidence.y + evidence.h).toBeLessThanOrEqual(100 - SAFE[formato][1] + 0.01);
      expect(slide.socialArt.density).toBe('ok');
    }
  });

  it.each(FORMATS)('%s: foto enviada e comparação ocupam áreas distintas sem perder conteúdo', (formato) => {
    const { source, slide } = blockCard(formato, { ...comparison, rows: comparison.rows.slice(0, 3) }, true);
    const { title, subtitle, photo, evidence } = slide.canvas.zones;
    expect(slide.presentationBlocks).toEqual(source.presentationBlocks);
    expect(slide.bgImage).toBe(source.bgImage);
    expect(slide.presentationSuppressPhoto).toBe(false);
    expect(photo.w * photo.h).toBeGreaterThan(300);
    expect(overlap(title, photo)).toBe(false);
    expect(overlap(subtitle, photo)).toBe(false);
    expect(overlap(evidence, photo)).toBe(false);
    expect(slide.socialArt.density).toBe('ok');
  });

  it.each(FORMATS)('%s: as 19 famílias preservam foto, zona segura e piso legível', (formato) => {
    for (const family of SOCIAL_FREE_FAMILY_KEYS) {
      const source = cards();
      source[2] = { ...source[2], title: 'Presença e movimento', subtitle: 'Uma ideia que aproxima pessoas.', bodyAfterImage: 'Apoio sem reduzir a leitura.', bgImage: 'blob:foto' };
      const nextPlan = plan();
      nextPlan.cards[2].design = { family, ground: 'bg', photo: 'half', block: 'none' };
      const slide = compose(formato, source, { plan: nextPlan })[2];
      expect(slide.socialFreeDesign.family, family).toBe(family);
      expect(slide.presentationSuppressPhoto, family).toBe(false);
      expect(slide.canvas.zones.photo.w * slide.canvas.zones.photo.h, family).toBeGreaterThan(300);
      expect(slide.socialArt.density, family).toBe('ok');
      expect(slide.bodyAfterSize * 1080 * 0.018 / 100, family).toBeGreaterThanOrEqual(28);
      for (const key of ['title', 'subtitle']) {
        const zone = slide.canvas.zones[key];
        expect(zone.y, `${family}/${key}`).toBeGreaterThanOrEqual(SAFE[formato][0]);
        expect(zone.y + zone.h, `${family}/${key}`).toBeLessThanOrEqual(100 - SAFE[formato][1] + 0.01);
      }
    }
  });
});
